var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , Transform = require('stream').Transform
  , Readable = require('stream').Readable
  , stream = require('./tree-stream')
  , data = require('./tree.json')

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

  s.on('end', function () {
    t.equal(nodes.length, data.length, 'node event emitted for each node in stream')
    tree.remove()
    t.end()
  })
  tree.render()
})

test('render populates data from stream', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  s.on('end', function () {
    t.equal(Object.keys(tree.nodes).length, data.length, 'nodes contains all data')
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

  s.on('end', function () {
    t.equal(tree.el.node().querySelectorAll('.tree ul li:first-child')[0].innerHTML, '<div class="node-child" style="-webkit-transform:translate(0px,0px)">node-child-1001</div>', 'node contents overriden')
    tree.remove()
    t.end()
  })
})

test('does not apply indicator class to label-mask by default', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  s.on('end', function () {
    t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask').length, 1, 'we have a label mask')
    t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask.indicator').length, 0, 'label mask is missing an indicator class')
    tree.remove()
    t.end()
  })
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

  var s = stream().pipe(map)
    , tree = new Tree({stream: s }).render()
    , el = tree.el.node()

  s.on('end', function () {
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

test('displays root and its children by default', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
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

  s.on('end', function () {
    t.ok(d3.select(tree.node[0][0]).classed('root'), 'root node has root class')
    tree.node.each(function (d, i) {
      if (i !== 0) {
        t.ok(!d3.select(this).classed('root'), 'non root nodes do not have root class')
      }
    })
    tree.remove()
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

  s.on('end', function () {
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

  s.on('end', function () {
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
  s.on('end', function () {
    // Once the tree has rendered, the class should have been removed
    tree.node.data().forEach(function (d, i) {
      t.equal(d._x, d.y, '_x is equal to original y')
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
  s.on('end', function () {
    // Once the tree has rendered, the class should have been removed
    t.ok(!tree.node.classed('transitions'), 'tree nodes transitions class removed')
    tree.remove()
    t.end()
  })
})

test('transitioning-node applied to entering nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
    process.nextTick(function () {
      var node = tree._layout[1002]
      t.ok(!node.children, 'first child has hidden children')
      tree.node[0][1].click() // click the first child
      t.equal(tree.el.selectAll('li.node.transitioning-node').size(), 5, '5 new nodes have transitioning-node')
      setTimeout(function () {
        t.equal(tree.el.selectAll('li.node.transitioning-node').size(), 0, 'transitioning-node has been removed')
        t.end()
      }, 400)
    })
  })
  tree.render()
})

test('disables animations if opts.maxAnimatable is exceeded', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, maxAnimatable: 3}).render()

  s.on('end', function () {
    var toggler = tree.toggle
    tree.toggle = function () {
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
      toggler.apply(tree, arguments)
      process.nextTick(function () {
        t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class after toggle')
        tree.remove()
        t.end()
      })
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

  stream.on('end', function () {
    t.equal(tree.el.select('.tree ul li.node:first-child svg.icon').attr('class'), 'icon red root', 'svg icon classes set')
    t.end()
  })
})
