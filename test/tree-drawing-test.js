import { test } from 'tape'
import * as d3 from 'd3-selection'
import Tree from '../index.js'
import { Transform } from 'stream'
import { Readable } from 'stream'
import stream from './tree-stream'
import data from './tree.json'

test('multiple trees have their own options', function (t) {
  var tree1 = new Tree({stream: stream(), depth: 390}).render()
    , tree2 = new Tree({stream: stream() }).render()

  t.notDeepEqual(tree1.options, tree2.options, 'options should not be shared')
  tree1.el.remove()
  tree2.el.remove()
  t.end()
})

test('emits node events', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})
    , nodes = []

  tree.on('node', function (node) {
    nodes.push(node)
  })

  tree.on('rendered', function () {
    t.equal(nodes.length, data.length, 'node event emitted for each node in stream')
    tree.remove()
    t.end()
  })
  tree.render()
})

test('render populates data from stream', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.equal(Object.keys(tree.nodes).length, data.length, 'nodes contains all data')
    tree.remove()
    t.end()
  })
})

test('allow label element overrides', function (t) {
  t.plan(3)
  var s = stream()
    , that = null
    , tree = new Tree({
    stream: s,
    label: function (selection) {
      that = this
      selection.html(function (d) {
                 return 'Foo<span>Bar</span>'
               })
               .classed('quux', true)
    }
  }).render()

  tree.on('rendered', function () {
    t.equal(tree, that, 'tree label `this` is bound to the tree')
    t.equal(tree.el.node().querySelectorAll('.tree ul li:first-child .label')[0].innerHTML, 'Foo<span>Bar</span>', 'label override sets html')
    t.equal(tree.el.node().querySelectorAll('.tree ul li:first-child .label.quux').length, 1, 'label override sets class')
    tree.remove()
    t.end()
  })
})

test('allows node contents overrides', function (t) {
  var s = stream()
    , tree = new Tree({
    stream: s,
    contents: function (selection) {
      selection.each(function (data) {
        var node = d3.select(this)
                     .selectAll('.node-child')
                     .data(function (d) {
                       return [d]
                     })

        node.enter()
            .append('div')
              .attr('class', 'node-child')
              .text(function (d) { return 'node-child-' + d.id })
      })
    }
  }).render()

  tree.on('rendered', function () {
    t.equal(tree.el.node().querySelectorAll('.tree ul li:first-child')[0].innerHTML, '<div class="node-child" style="-webkit-transform:translate(0px,0px)">node-child-1001</div>', 'node contents overriden')
    tree.remove()
    t.end()
  })
})

test('allows additional class names to be set on the node', function (t) {
  var map = new Transform( { objectMode: true } )

  map._transform = function(obj, encoding, done) {
    if (obj.id === 1001) {
      obj.className = 'foo'
    }
    this.push(obj)
    done()
  }

  var s = stream()
    , mapStream = s.pipe(map)
    , tree = new Tree({
      stream: mapStream
    }).render()

  tree.on('rendered', function () {
    var foo = tree.el.node().querySelector('.tree li.node.foo')

    t.equal(tree.el.node().querySelectorAll('.tree li.node.foo').length, 1, '1 node with class name of `foo`')
    t.equal(foo.dataset.id, '1001', 'node 1001 has class foo')
    tree.remove()
    t.end()
  })
})

test('tree can be editable on initial render based on options', function (t) {
  var s = stream()
    , tree = new Tree({
      stream: s,
      editable: true
    }).render()

  tree.on('rendered', function () {
    t.ok(tree.el.node().querySelector('.tree.editable'), 'tree is marked as editable')
    t.ok(tree.isEditable(), 'the tree is editable according to its api')
    tree.remove()
    t.end()
  })
})

test('does not apply indicator class to label-mask by default', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask').length, 1, 'we have a label mask')
    t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask.indicator').length, 0, 'label mask is missing an indicator class')
    tree.remove()
    t.end()
  })
})

test('does not set ie-trident on tree-container in chrome', function (t) {
  navigator.__defineGetter__('userAgent', function () {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36'
  })
  navigator.__defineGetter__('appVersion', function () {
    return '5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36'
  })
  var tree = new Tree({stream: stream() }).render()
  t.notOk(tree.el.classed('ie-trident'), 'ie-trident not set on chrome')
  tree.remove()
  t.end()
})

test('sets ie-trident on tree-container in IE11', function (t) {
  navigator.__defineGetter__('userAgent', function (){
    return 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; rv:11.0) like Gecko'
  })
  navigator.__defineGetter__('appVersion', function (){
    return '5.0 (Windows NT 6.1; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; rv:11.0) like Gecko'
  })

  var tree = new Tree({stream: stream() }).render()
  t.ok(tree.el.classed('ie-trident'), 'ie-trident set on IE11')
  tree.remove()
  t.end()
})

test('render populates and hides visible: false nodes', function (t) {
  var map = new Transform( { objectMode: true } )
    , hiddens = [1002, 1070, 1081]

  map._transform = function(obj, encoding, done) {
    if (hiddens.indexOf(obj.id) !== -1) {
      obj.visible = false
    }
    this.push(obj)
    done()
  }

  var s = stream()
    , mapStream = s.pipe(map)
    , tree = new Tree({stream: mapStream }).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.expandAll()
    t.equal(Object.keys(tree.nodes).length, data.length, 'nodes contains all data')
    t.equal(Object.keys(tree._layout).length, data.length, '_layout contains all data')
    t.equal(el.querySelectorAll('.tree ul li').length, 5, 'visible: false nodes are not displayed')

    var n1 = tree._layout[1001]
    t.equal(n1._allChildren.length, 2, 'root has 2 total children')
    t.equal(n1.children.length, 1, 'root children do not display invisible nodes')

    var n2 = tree._layout[1070]
    t.equal(n2.parent._allChildren.indexOf(n2), 1, '1070 parent _invisibleNodes contains 1070')
    t.equal(n2.parent.children.indexOf(n2), -1, '1070 parents children does contain 1070')
    tree.remove()
    t.end()
  })
})

test('initial render respects `collapsed` property on the nodes', (t) => {
  t.plan(5)
  var map = new Transform( { objectMode: true } )
    , expand = [1002, 1070, 1081]

  map._transform = function(obj, encoding, done) {
    if (expand.indexOf(obj.id) !== -1) {
      obj.collapsed = false
    }
    this.push(obj)
    done()
  }

  var s = stream()
    , mapStream = s.pipe(map)
    , tree = new Tree({stream: mapStream }).render()

  tree.on('rendered', function () {
    let expandedNodes = tree.expandedNodes()
                            .map(node => node.id)

    t.equal(expandedNodes.length, 4, '4 expanded nodes')

    t.equal(expandedNodes[0], 1001, 'root expanded')

    expand.forEach(id => {
      t.ok(expandedNodes.indexOf(id) != -1, `${id} is expanded`)
    })

    t.end()
  })
})

test('displays root and its children by default', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      t.equal(tree.node.size(), 3, '3 nodes by default')
      tree.remove()
      t.end()
    })
  })
  tree.render()
})

test('root node has a class of root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.ok(d3.select(tree.node.nodes()[0]).classed('root'), 'root node has root class')
    tree.node.each(function (d, i) {
      if (i !== 0) {
        t.ok(!d3.select(this).classed('root'), 'non root nodes do not have root class')
      }
    })
    tree.remove()
    t.end()
  })
})

test('top tree node has denoted class', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , container = document.createElement('div')

  document.body.appendChild(container)

  tree.on('rendered', function () {
    t.ok(tree.el.select('.tree li.node[data-id="1001"]').classed('kalpa-top-node'), 'root node (top) has `kalpa-top-node` class')
    t.equal(tree.el.selectAll('.tree li.node.kalpa-top-node').size(), 1, 'only one kalpa-top-node')
    tree.remove()
    container.remove()
    t.end()
  })
})

test('tree drawing adjusts `tree-overflow` based on bound node data', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , container = document.createElement('div')

  container.style.height = '50px'

  document.body.appendChild(container)
  tree.on('rendered', function () {
    container.appendChild(tree.el.node())
    t.ok(tree.el.select('.tree').classed('tree-overflow'), 'tree overflow set')
    tree.remove()
    container.remove()
    t.end()
  })
})

test('displays a node as selected on render', function (t) {
  var s = stream()
    , tree = new Tree({
    stream: s,
    initialSelection: '1003'
  })

  tree.on('select', function () {
    t.fail('should not fire select on initial selection')
  })

  tree.on('rendered', function () {
    process.nextTick(function () {
      t.equal(tree.node.size(), 18, '3 nodes by default')
      tree.remove()
      t.end()
    })
  })
  tree.render()
})

test('emits stream on errors on tree', function (t) {
  var stream = new Readable({objectMode: true})
  stream._read = function () {
    this.emit('error', new Error('Blue Smoke'))
  }

  var tree = new Tree({
    stream: stream
  })

  tree.on('error', function (e) {
    t.ok(e, 'error event')
    t.equal(e.message, 'Blue Smoke', 'error message matches')
    tree.remove()
    t.end()
  })

  tree.render()
})

test('adjust root node size', function (t) {
  var s = stream()
    , tree = new Tree({
      stream: s,
      height: 36,
      rootHeight: 50
    }).render()

  tree.on('rendered', function () {
    t.equal(tree._rootOffset, 14, 'sets root offset')
    t.ok(tree.el.select('.tree').classed('detached-root'), 'tree has detached-root class')
    t.equal(tree.node.data()[0]._y, 0, 'root _y is 0')
    t.equal(tree.node.data()[1]._y, 50, 'first node starts at root height')
    t.equal(tree.node.data()[2]._y, 86, 'second node includes root offset')
    tree.remove()
    t.end()
  })
})

test('rebind stores private fields', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
  tree.on('rendered', function () {
    // Once the tree has rendered, the class should have been removed
    tree.node.data().forEach(function (d, i) {
      t.equal(d._y, i * tree.options.height, '_y is equal to index * height')
    })

    tree.remove()
    t.end()
  })
})

test('renders without transitions', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.once('node', function () {
    // By the time the first data event fires, the tree should not have the 'transitions' class
    t.ok(!tree.el.select('.tree').classed('transitions'), 'tree nodes do not have the transitions class applied')
  })

  tree.render()
  tree.on('rendered', function () {
    // Once the tree has rendered, the class should have been removed
    t.ok(!tree.node.classed('transitions'), 'tree nodes transitions class removed')
    tree.remove()
    t.end()
  })
})

test('transitioning-node applied to entering nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var node = tree._layout[1002]
      t.ok(!node.children, 'first child has hidden children')
      var redraw = tree._forceRedraw
      tree._forceRedraw = function () {
        t.equal(tree.el.selectAll('li.node.transitioning-node').size(), 5, '5 new nodes have transitioning-node')
        tree._forceRedraw = redraw
        tree._forceRedraw()
        process.nextTick(function () {
          t.equal(tree.el.selectAll('li.node.transitioning-node').size(), 0, 'transitioning-node has been removed')
          t.end()
        })

      }
      tree.node.nodes()[1].click() // click the first child
    })
  })
  tree.render()
})

test('disables transitions animation if opts.maxAnimatable is exceeded', function (t) {
  t.plan(3)
  var s = stream()
    , tree = new Tree({stream: s, maxAnimatable: 3}).render()

  tree.on('rendered', function () {
    var toggler = tree.toggle

    tree.on('selected', function () {
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class after toggle')
      tree.remove()
      t.end()
    })

    tree.toggle = function () {
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
      toggler.apply(tree, arguments)
    }

    t.ok(!tree._layout[1003].children, 10, '1003 hidden nodes')
    tree.select(1002)
  })
})

test('sets icon class on svg', function (t) {
  var stream = new Readable({objectMode: true})

  stream._read = function () {
    stream.push({
      id: 1001,
      label: 'Folder A',
      color: 'red',
      icon: 'root'
    })
    stream.push(null)
  }
  var tree = new Tree({stream: stream}).render()

  tree.on('rendered', function () {
    t.equal(tree.el.select('.tree ul li.node:first-child svg.icon').attr('class'), 'icon red has-color icon-root', 'svg icon classes set')
    t.end()
  })
})

test('non-colored icons do not have `has-color` class', function (t) {
  var stream = new Readable({objectMode: true})

  stream._read = function () {
    stream.push({
      id: 1001,
      label: 'Folder A',
      icon: 'root'
    })
    stream.push(null)
  }
  var tree = new Tree({stream: stream}).render()

  tree.on('rendered', function () {
    t.ok(tree.el.select('.tree ul li.node:first-child svg.icon').classed('icon'), 'svg icon classes set')
    t.ok(tree.el.select('.tree ul li.node:first-child svg.icon').classed('icon-root'), 'svg icon-root classes set')
    t.notOk(tree.el.select('.tree ul li.node:first-child svg.icon').classed('has-color'), 'svg does not have `has-color`')
    t.end()
  })
})

test('sets toggler class based on node state', function (t) {
  var stream = new Readable({objectMode: true})
    , data = [{
      id: 1001,
      label: 'Huge Scorecard',
      color: 'red',
      nodeType: 'root'
    }, {
      id: 1002,
      label: 'P1',
      parentId: 1001,
      color: 'red',
      nodeType: 'perspective'
    }, {
      id: 1058,
      label: 'P2',
      parentId: 1001,
      color: 'green',
      nodeType: 'perspective'
    }, {
      id: 1098,
      label: 'O1',
      parentId: 1058,
      visible: false,
      color: 'green',
      nodeType: 'objective'
    }]

  stream._read = function () {
    let node = data.shift()

    stream.push(node || null)
  }

  var tree = new Tree({stream: stream}).render()

  tree.on('rendered', function () {
    t.ok(tree.el.selectAll('.tree ul li:nth-child(1) .toggler').classed('expanded'), 'root toggler is marked expanded')
    t.ok(tree.el.selectAll('.tree ul li:nth-child(2) .toggler').classed('leaf'), 'P1 toggler is marked as leaf')
    t.ok(tree.el.selectAll('.tree ul li:nth-child(3) .toggler').classed('leaf'), 'P2 toggler is marked as leaf')

    tree.edit({
      id: 1098,
      visible: true
    })

    t.ok(tree.el.selectAll('.tree ul li:nth-child(3) .toggler').classed('collapsed'), 'P2 toggler is marked as collapsed')
    t.end()
  })
})

test('double click toggle does not break with transitioning nodes', function (t) {
  // See #404
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    tree.expandAll()
    process.nextTick(function () {
      t.equal(tree.el.selectAll('li.node').size(), 37, 'all nodes initially visible')
      tree.node.nodes()[1].querySelector('.toggler').click()
      tree.node.nodes()[1].querySelector('.toggler').click()
      setTimeout(function () {
        t.equal(tree.el.selectAll('li.node').size(), 37, 'all nodes visible after two fast clicks on the first node')
        t.end()
      }, 500)

    })
  })
  tree.render()
})

test('slow stream with api call before end', function (t) {
  var stream = require('stream').Readable({objectMode: true})
    , data = [{
        id: 1001,
        label: 'Huge Scorecard',
        color: 'red',
        nodeType: 'root'
      }, {
        id: 1002,
        label: 'P1',
        parentId: 1001,
        color: 'red',
        nodeType: 'perspective'
      }, {
        id: 1058,
        label: 'P2',
        parentId: 1001,
        color: 'green',
        nodeType: 'perspective'
      }]
    , i = 0

  stream._read = function () {
     if (data[i]) {
      setTimeout(function () {
        stream.push(data[i++])
      }, 10)
      return
    }
    stream.push(null)
  }

  var tree = new Tree({stream: stream}).render()

  tree.on('node', function () {
    if (i === 2) {
      // after root, on 2nd node, mark it editable
      tree.editable()
    }
  })

  tree.on('rendered', function () {
    t.equal(tree.el.selectAll('.tree ul li.node').size(), 3, 'three nodes in tree')
    t.end()
  })
})
