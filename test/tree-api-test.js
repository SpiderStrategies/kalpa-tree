import { test } from 'tape'
import { Readable } from 'stream'
import Tree from '../index.js'
import css from './../dist/tree.css'
import stream from './tree-stream.js'
import data from './tree.json'

test('get', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.deepEqual(tree.get(), tree.root, 'get returns root by default')
    t.deepEqual(tree.get(1002), tree.nodes[1002], 'get returns a node by id')
    t.ok(tree.get(1006), 'get returns nodes that are hidden')
    tree.el.remove()
    t.end()
  })
})

test('parent', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.deepEqual(tree.parent(1002), tree.get(1001), 'returns a nodes parent by id')
    t.deepEqual(tree.parent(tree.get(1002)), tree.get(1001), 'returns a nodes parent by object')
    t.ok(!tree.parent(1001), 'returns null for root')
    tree.el.remove()
    t.end()
  })
})

test('children', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.equal(tree.children(1001).length, 2, 'root has two children')
    t.equal(tree.children(1007).length, 0, 'a leaf has no children')
    t.equal(tree.children(1058).length, 5, 'a collapsed node has children')

    var children = tree.children(1003)
    t.equal(children.length, 10, '1003 has ten children')

    tree.edit([{id: 1006, visible: false}, {id: 1007, visible: false}])
    t.deepEqual(children, tree.children(1003), '1003 has the same number of children')
    tree.el.remove()
    t.end()
  })
})

test('siblings', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    t.ok(!tree.previousSibling(1001), 'root has no previous sibling')
    t.ok(!tree.nextSibling(1001), 'root has no next sibling')

    t.deepEqual(tree.nextSibling(1007), tree.get(1008), 'correct next sibling')
    t.deepEqual(tree.previousSibling(1008), tree.get(1007), 'correct previous sibling')

    tree.edit([{id: 1006, visible: false}, {id: 1007, visible: false}])
    t.deepEqual(tree.nextSibling(1005), tree.get(1006), 'next sibling includes invisible nodes')
    t.deepEqual(tree.previousSibling(1008), tree.get(1007), 'previous sibling includes invisible nodes')
    tree.remove()
    t.end()
  })
})

test('moves a node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var orgParent = tree._layout[1003].parent
      , orgChildrenLength = orgParent._allChildren.length

    t.notOk(tree._layout[1003].parent.children, 'new parent is not expanded')
    tree.move(1003, 1025)
    process.nextTick(function () {
      t.equal(orgParent._allChildren.length, orgChildrenLength - 1, 'original parent is missing a child')
      t.deepEqual(tree._layout[1003].parent, tree._layout[1025], 'moved node has new parent')
      t.equal(tree._layout[1003].parent.children.length, 5, 'new parent is expanded')
      t.deepEqual(tree._layout[1025]._allChildren[tree._layout[1025]._allChildren.length -1], tree._layout[1003], '1003 was pushed to end of 1025')
      t.end()
    })
  })
})

test('moves a node without showing new layout', function (t) {
   var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var orgParent = tree._layout[1003].parent
      , orgChildrenLength = orgParent._allChildren.length

    t.notOk(tree._layout[1003].parent.children, 'new parent is not expanded')
    tree.move(1003, 1025, null, false)

    process.nextTick(function () {
      t.equal(orgParent._allChildren.length, orgChildrenLength - 1, 'original parent is missing a child')
      t.deepEqual(tree._layout[1003].parent, tree._layout[1025], 'moved node has new parent')
      t.notOk(tree._layout[1003].parent.children, 'new parent is still not expanded')
      t.end()
    })
  })
})

test('moves a node with index', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var orgParent = tree._layout[1003].parent
      , orgChildrenLength = orgParent._allChildren.length

    tree.move(1003, 1025, 2)

    process.nextTick(function () {
      t.deepEqual(tree._layout[1025]._allChildren[2], tree._layout[1003], '1003 was set as third child of 1025')
      t.end()
    })
  })
})

test('copies a node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var orgParent = tree._layout[1003].parent
       , orgChildrenLength = orgParent._allChildren.length

    tree.copy(1003, 1025, undefined, function (d) {
      d.id = d.id + 10000
      return d
    })

    process.nextTick(function () {
      t.equal(orgParent._allChildren.length, orgChildrenLength, 'original parent has its children')
      t.deepEqual(tree._layout[11003].parent, tree._layout[1025], 'moved node has new parent')
      t.end()
    })
  })
})

test('copies a node to a specific index of a parent', function (t) {
  let s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    let orgParent = tree._layout[1003].parent
      , orgChildrenLength = orgParent._allChildren.length

    tree.copy(1003, 1025, 2, function (d) {
      d.id = d.id + 10000
      return d
    })

    process.nextTick(function () {
      t.deepEqual(tree._layout[11003].parent, tree._layout[1025], 'moved node has new parent')
      t.deepEqual(tree._layout[1025]._allChildren[2], tree._layout[1003 + 10000], 'copied top level node was set as third child of 1025')
      t.end()
    })
  })
})

test('emits change:height events', function (t) {
  t.plan(1)
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.on('change:height', () => {
      t.pass('change:height event emitted')
    })
    tree.select(1003)
    t.end()
  })
})

test('selects a node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.select(1003)

    var selected = tree.selected()
    t.deepEqual(selected, tree.get(1003), 'selected gives us the selected node')
    t.ok(tree._layout[1003].selected,  '_layout selected node is selected')
    t.ok(tree._layout[1003].children, 'selected node is expanded')

    tree.collapseAll()
    process.nextTick(function () {
      // wait for the tree to be collapsed, then select a deep leaf.
      tree.select(1004)
      // Make sure all ancestors of the selected node are also expanded.
      var leaf = tree._layout[1004]
      t.equal(leaf.id, tree.selected().id, 'selected returns the correct node')
      t.ok(leaf.parent.children, '01 has children')
      t.ok(leaf.parent.parent.children, 'P1 has children')
      t.ok(leaf.parent.parent.parent.children, 'Root has children')
      tree.el.remove()
      t.end()
    })
  })
})

test('deselects a node', function (t) {
  let s = stream()
    , tree = new Tree({
      stream: s,
      initialSelection: '1003'
    }).render()

  tree.on('rendered', function () {
    let selected = tree.selected()
    t.ok(selected.id, 1003, '1003 is selected')
    t.ok(tree._layout[selected.id].selected, 'layout node is marked `selected`')
    tree.select()

    t.notOk(tree.selected(), 'tree no longer has a selected node')
    t.notOk(tree._layout[selected.id].selected, '1003 layout node no longer marked `selected`')
    t.end()
  })
})

test('select a node adds transitions by default', function (t) {
  t.plan(3)

  var s = stream()
    , container = document.createElement('div')
    , tree = new Tree({stream: s})
    , fly = tree._fly

  container.className = 'container'
  container.style.height = '700px'
  document.body.appendChild(container)
  container.appendChild(tree.render().el.node())

  tree.on('rendered', function () {
    t.ok(!tree.el.select('.tree').classed('transitions'), 'tree el does not have transitions by default')

    tree.on('selected', function () {
      t.ok(!tree.el.select('.tree').classed('transition'), 'tree transitions class not there after toggle')
      tree.el.remove()
      container.remove()
      t.end()
    })

    tree._fly = function () {
      t.ok(tree.el.select('.tree').classed('transitions'), 'tree has transitions class applied')
      fly.apply(tree, arguments)
    }

    tree.select(1002)
  })
})

test('marks freshly selected nodes as `selecting`', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    var redraw = tree._forceRedraw
    tree._forceRedraw = function () {
      var n = tree.el.selectAll('.tree li.node.selecting')
      t.equal(n.size(), 1, 'we have a selecting node')
      redraw.apply(this, arguments)
    }
    tree.on('select', function () {
      t.equal(tree.el.selectAll('.tree li.node.selecting').size(), 0, 'no `selecting` nodes after select event')
      tree.el.remove()
      t.end()
    })
    t.equal(tree.el.selectAll('.tree li.node.selecting').size(), 0, 'no `selecting` nodes')
    tree.select(1015)
  })
})

test('selected nodes descendants transition from correct location', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.select(1004, {animate: false}) // Expand 1004 (M1)
    tree.select(1015, {animate: false}) // Expand 1015 (This has a different parent)
    // Now collapse P1 so the tree is basically collapsed
    tree.toggle({id: 1002}, {animate: false})

    // The tree is in a state we want for this test. If P1 is clicked, it will expand, and show grandchildren
    // because two of its children (1004 and 1015) were previously expanded

    // Verify the previous comment
    t.equal(tree.el.node().querySelectorAll('.tree ul li').length, 3, 'tree has 3 visible')

    var updater = tree.updater
    tree.updater = function () {
      // Enter called by now, so the node is in the dom.
      var n = tree.el.select('.tree ul li.node:nth-child(17)')
        , _translate = /translate\((.*)\)/.exec(n.attr('style'))[0]
      t.equal(n.datum().id, 1016, 'selected the correct node')
      t.equal(_translate, 'translate(0px, 36px)', '1016 enters at 1002 spot')
      t.end()
    }
    tree.toggle({id: 1002})
  })
})

test('selects a node without animations', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    t.ok(!tree.el.select('.tree').classed('transitions'), 'tree el does not have transitions by default')
    var toggler = tree.toggle
    tree.toggle = function () {
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
      toggler.apply(tree, arguments)
      process.nextTick(function () {
        t.ok(!tree.el.select('.tree').classed('transition'), 'tree transitions class not there after toggle')
        tree.el.remove()
        t.end()
      })
    }
    tree.select(1002, {animate: false})
  })
})

test('select will not toggle an already expanded node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.expandAll()
    tree.select(1003)
    t.ok(tree._layout[1003].children, 'previously expanded node is still expanded after select')

    tree.el.remove()
    t.end()
  })
})

test('selects a node with options', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , calls = 0

  tree.on('rendered', function () {
    tree.on('select', function (node) {
      t.equal(node.label, 'O1', 'select event provides real node, not layout node')
      t.equal(node.id, 1003, 'select node event is correct')
    })

    tree.select(1058, {silent: true})
    tree.select(1003, {toggleOnSelect: false})

    t.ok(++calls, 1, 'select only fired once')
    tree.el.remove()
    t.end()
  })
})

test('select disables animations if selected node parent is not visible', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var updater = tree.updater
      tree.updater = function () {
        t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
        updater.apply(tree, arguments)
        tree.el.remove()
        t.end()
      }
      tree.select(1009)
    })
  })
  tree.render()
})

test('select scrolls into view', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.el.select('.tree')
             .style('overflow', 'auto')
             .style('height', '36px')
    document.body.appendChild(tree.el.node())
    t.equal(tree.el.select('.tree').node().scrollTop, 0, 'scroll top is 0')
    tree.select(1029, {animate: false})
    t.ok(tree.el.select('.tree').node().scrollTop > 0, 'scroll top is larger than 0')
    tree.remove()
    t.end()
  })
})

test('select does not scroll if node is within viewport', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.el.select('.tree')
             .style('overflow', 'auto')
             .style('height', '150px')

    document.body.appendChild(tree.el.node())
    tree.select(1058, {animate: false})
    t.equal(tree.el.select('.tree').node().scrollTop, 0, 'scroll top is 0')
    tree.remove()
    t.end()
  })
})

test('getSelectedEl returns the selected node\'s dom element', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  tree.on('rendered', function () {
    tree.select(1003)

    var data = tree.selected()
      , el = tree.selectedEl()
    process.nextTick(function () {
      t.equal(data.label, el.querySelector('.label').innerHTML, 'selected dom node label is correct')
      tree.el.remove()
      t.end()
    })
  })
})

test('editable', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.editable()
    t.ok(el.querySelector('.tree.editable'), 'there is an tree editable object')
    t.ok(tree.isEditable(), 'the tree is editable')

    tree.editable()
    t.ok(!el.querySelector('.tree.editable'), 'there is not an tree editable object')
    t.ok(!tree.isEditable(), 'the tree is not editable')

    tree.el.remove()
    t.end()
  })
})

test('expand', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var d = tree.get(1002)
    tree.expand(d) // 1002 is the first child of root
    t.ok(tree._layout[1002].children, 'node should have children')
    t.ok(!tree._layout[1002]._children, 'node should not have hidden children')
    t.equal(el.querySelectorAll('.tree ul li').length, 8, 'root + children + first child expanded')
    t.end()
  })
})

test('collapse', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var d = tree.get(1002)
    tree.collapse(d) // 1002 is the first child of root
    t.ok(!tree._layout[1002].children, 'node should not have children')
    t.equal(el.querySelectorAll('.tree ul li').length, 3, 'root + children + first child expanded')
    t.end()
  })
})

test('expand all', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    var el = tree.el.node()
    process.nextTick(function () {
      t.equal(el.querySelectorAll('.tree ul li').length, 3, 'tree has 3 nodes initially')
      tree.expandAll()
      t.equal(el.querySelectorAll('.tree ul li').length, data.length, 'all nodes should be visible')
      tree.el.remove()
      t.end()
    }, 1000)

  })
  tree.render()
})

test('expand all disables animations if there are too many nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, maxAnimatable: 3})

  tree.on('rendered', function () {
    // Wait for default end to remove transitions, which is applied on initial render
    process.nextTick(function () {
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree el does not have transitions')
      var updater = tree.updater
      tree.updater = function () {
        t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
        updater.apply(tree, arguments)
        process.nextTick(function () {
          t.ok(!tree.el.select('.tree').classed('transitions'), 'tree transitions class not applied after toggle')
          tree.el.remove()
          t.end()
        })
      }
      tree.expandAll()
    })

  })
  tree.render()
})

test('collapseTo', function (t) {
  var s = stream()
    , tree = new Tree({stream:s, maxAnimatable: 0}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.expandAll()
    tree.collapseTo(3)
    t.equal(el.querySelectorAll('.tree ul li').length, 37, 'root + its children + grandchildren should be visible')
    tree.el.remove()
    t.end()
  })

})

test('collapse all', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.expandAll()
  tree.collapseAll() // exit nodes have a 300ms duration, so we have to pause until they are removed
  setTimeout(function () {
    t.equal(el.querySelectorAll('.tree ul li').length, 3, 'root + its children should be visible')
    tree.el.remove()
    t.end()
  }, 400)
})

test('collapse all disables animations if there are too many nodes alredy expanded', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, maxAnimatable: 5})

  tree.on('rendered', function () {
    tree.select(1006)
    process.nextTick(function () {
      t.ok(tree.node.size() > 5, 'there are more nodes than our set maxAnimatable')
      t.ok(!tree.el.select('.tree').classed('transitions'), 'tree el does not have transitions')
      var updater = tree.updater
      tree.updater = function () {
        t.ok(!tree.el.select('.tree').classed('transitions'), 'tree does not have transitions class applied')
        updater.apply(tree, arguments)
        process.nextTick(function () {
          t.ok(!tree.el.select('.tree').classed('transitions'), 'tree transitions class not applied after toggle')
          tree.el.remove()
          t.end()
        })
      }
      tree.collapseAll()
    })
  })
  tree.render()
})

test('removes a node by id', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    var el = tree.el.node()

    tree.expandAll() // start expanded

    t.equal(Object.keys(tree.nodes).length, data.length, 'starts with all nodes')
    t.equal(Object.keys(tree._layout).length, data.length, 'starts with all nodes in layout')

    tree.removeNode(1002)
    t.equal(Object.keys(tree.nodes).length, 7, 'nodes were removed from nodes')
    t.equal(Object.keys(tree._layout).length, 7, 'nodes were removed from _layout')

    setTimeout(function () {
      var node = el.querySelector('.tree ul li:nth-child(2)')
      t.equal(el.querySelectorAll('.tree ul li').length, 7, 'removed nodes no longer in the dom')
      t.end()
    }, 400)
  })
  tree.render()
})

test('removes a node by data object', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      tree.removeNode(tree.get(1002))
      t.equal(Object.keys(tree.nodes).length, 7, 'nodes were removed from nodes')
      t.equal(Object.keys(tree._layout).length, 7, 'nodes were removed from _layout')
      tree.remove()
      t.end()
    })
  })
  tree.render()
})

test('removes root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      tree.removeNode(1001)
      t.ok(!tree.root, 'root was removed')
      t.equal(Object.keys(tree.nodes).length, 0, 'no nodes in tree.nodes')
      t.equal(Object.keys(tree._layout).length, 0, 'no nodes in _layout')
      setTimeout(function () {
        t.equal(el.querySelectorAll('li').length, 0, 'no li nodes in tree')
        tree.remove()
        t.end()
      }, 400)
    })
  })
  tree.render()
})

test('removeNode calls `enter` when the tree is performance tuned', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, performanceThreshold: 0})
    , container = document.createElement('div')

  container.style.height = '50px'
  document.body.appendChild(container)

  tree.on('rendered', function () {
    container.appendChild(tree.el.node())
    process.nextTick(function () {
      tree.expandAll()
      tree.removeNode(1003)

      setTimeout(function () {
        t.equal(tree.el.node().querySelectorAll('li.node').length, 4, '4 li.node in tree')
        tree.remove()
        container.remove()
        t.end()
      }, 400)
    })
  })
  tree.render()
})

test('adds a new root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      tree.removeNode(1001)
      setTimeout(function () {
        t.ok(!tree.root, 'root was removed')

        tree.add({
          id: 1001010101,
          label: 'Newest root',
          color: 'green',
          nodeType: 'root'
        })
        t.equal(Object.keys(tree.nodes).length, 1, 'one node in tree.nodes')
        t.equal(Object.keys(tree._layout).length, 1, 'one node in _layout')
        t.equal(tree.el.node().querySelectorAll('li').length, 1, 'one li node in tree')
        t.ok(tree.root, 'tree has a root')
        tree.remove()
        t.end()
      }, 400)
    })
  })
  tree.render()
})

test('prevents add for a node w/ that id', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    var d = tree.add({
      id: 1001
    })
    t.ok(!d, 'd is undefined')
    t.end()
  })
  tree.render()
})

test('adds a node to a parent at some index', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var d = tree.add({
      id: 1001010102,
      label: 'Newest node',
      color: 'green',
      nodeType: 'metric'
    }, 1070, 0)

    process.nextTick(function () {
      t.deepEqual(tree._layout[1001010102].parent, tree._layout[1070], 'new node\'s parent is correct')
      t.equal(tree.nodes[1001010102], d, 'node was added to nodes')
      t.end()
    })
  })
})

test('adds a node to a parent without children', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var d = tree.add({
      id: 1001010101,
      label: 'Newest node',
      color: 'green',
      nodeType: 'metric'
    }, 1070)

    process.nextTick(function () {
      t.deepEqual(tree._layout[1001010101].parent, tree._layout[1070], 'new node\'s parent is correct')
      t.equal(tree.nodes[1001010101], d, 'node was added to nodes')
      t.end()
    })
  })
})

test('adds a node to a parent', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.expandAll()

    var d = tree.add({
      id: 3020,
      label: 'Newest node',
      color: 'green',
      nodeType: 'metric'
    }, 1003)

    process.nextTick(function () {
      t.deepEqual(tree._layout[3020].parent, tree._layout[1003], 'new node\'s parent is correct')
      t.equal(tree.nodes[3020], d, 'node was added to nodes')
      t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node', 'new node label is correct')
      t.end()
    })
  })
})

test('adds a node to a parent and before sibling', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.expandAll()

    var d = tree.add({
      id: 3020,
      label: 'Newest node sibling',
      color: 'green',
      nodeType: 'metric'
    }, 1003, 1) // Add as the second node

    process.nextTick(function () {
      t.equal(tree._layout[1003].children.indexOf(tree._layout[3020]), 1, 'new node index is correct in parent\'s children')
      t.deepEqual(tree._layout[3020].parent.children[2], tree._layout[1005], 'sibling 1005 is after the new node')
      t.equal(tree.nodes[3020], d, 'stored the node in nodes')
      t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node sibling', 'new node label is correct')
      t.end()
    })
  })
})

test('add node toggles tree nodes if parent is selected', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    // Select the parent, but keep it collapsed
    tree.select(1003, {toggleOnSelect: false})
    t.ok(!tree._layout[1003].children, 'selected node is not expanded so it does not have children')
    t.equal(el.querySelectorAll('.tree ul li.node').length, 8, '8 nodes visible')

    var redraw = tree._forceRedraw
    tree._forceRedraw = function () {
      // Intercept this call to verify the parent is expanded
      t.ok(tree._layout[1003].children, 'parent is now expanded')
      t.equal(el.querySelectorAll('.tree ul li.node').length, 18, '18 nodes visible')
      tree._forceRedraw = redraw // for next time

      process.nextTick(function () {
        t.equal(el.querySelectorAll('.tree ul li.node').length, 19, '19 nodes visible')
        t.end()
      })
    }
    var d = tree.add({
      id: 3020,
      label: 'Newest node sibling',
      color: 'green',
      nodeType: 'metric'
    }, 1003)

  })
})

test('addAll adds a bunch of nodes', function (t) {
   var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.expandAll()
    t.equal(el.querySelectorAll('.tree ul li.node').length, 37, '37 nodes visible')
    t.equal(Object.keys(tree.nodes).length, 37, '37 tree nodes')
    let parent = 1001
      , nodes = [
        {data: {id: 393030384, label: 'New Node 1', parentId: parent, color: 'gray', nodeType: 'metric'}, parent: parent},
        {data: {id: 393030385, label: 'New Node 2', parentId: parent, color: 'gray', nodeType: 'metric'}, parent: parent}]

    tree.addAll(nodes)
    t.equal(Object.keys(tree.nodes).length, 39, '39 tree nodes')

    process.nextTick(function () {
      t.equal(el.querySelectorAll('.tree ul li.node').length, 39, '39 nodes visible')
      t.end()
    })
  })
})

test('edits a node (patch=true - default)', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.edit({
      id: 1001,
      label: 'New label for root',
      color: 'green'
    })

    var d = tree.get(1001)
    t.equal(d.label, 'New label for root', 'label changed')
    t.equal(d.color, 'green', 'color changed')
    t.equal(d.nodeType, 'root', 'nodeType remained the same')

    process.nextTick(function () {
      t.equal(el.querySelector('.tree ul li:nth-child(1) .label').innerHTML, 'New label for root', 'dom label changed')
      t.end()
    })
  })
})

test('edits a node with patch=false', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.edit({
      id: 1001,
      type: 'foo',
      color: 'green'
    }, {patch: false})

    var d = tree.get(1001)
    t.notOk(d.label, 'label removed')
    t.notOk(d.nodeType, 'nodetype no longer set')
    t.equal(d.color, 'green', 'color changed')
    t.equal(d.type, 'foo', 'type set')

    process.nextTick(function () {
      t.equal(el.querySelector('.tree ul li:nth-child(1) .label').innerHTML, '', 'dom label changed to unset value ')
      t.end()
    })
  })
})

test('edit changes class name on a node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    t.notOk(el.querySelectorAll('.tree ul li.node.foo').length, 'No nodes with class name of `foo`')
    tree.edit({
      id: 1001,
      className: 'foo',
    })

    t.equal(el.querySelector('.tree ul li.node.foo .label').innerHTML, 'Huge Scorecard', '1001 has classname of foo')

    tree.edit({
      id: 1001,
      className: 'foo bar',
    })

    t.equal(el.querySelector('.tree ul li.node.foo.bar .label').innerHTML, 'Huge Scorecard', '1001 has classnames of foo and bar')

    let n = tree.get(1001)
    // To remove a class name, you have to do an edit with `patch: false`
    delete n.className
    tree.edit(n, {patch: false})

    t.notOk(el.querySelectorAll('.tree ul li.node.foo').length, 'No nodes with class name of `foo`')

    // Give 1001 a class name
    tree.edit({
      id: 1001,
      className: 'foobar',
    })

    t.equal(el.querySelector('.tree ul li.node.foobar .label').innerHTML, 'Huge Scorecard', '1001 has classname of foobar')

    // check stream updates
    var editStream = new Readable({objectMode: true})
      , i = 1002

    editStream._read = function () {
      var id = i++
      if (id < 1004) {
        return editStream.push({id: id, label: 'Patched ' + id })
      }
      editStream.push(null)
    }

    editStream.on('end', function () {
      // The tree waits for the `end` event to draw. Allow that draw to take place, then inspect DOM
      process.nextTick(function () {
        t.equal(el.querySelector('.tree ul li.node.foobar .label').innerHTML, 'Huge Scorecard', '1001 still has classname of foobar')
        t.equal(tree.get(1003).label, 'Patched 1003', '1003 patched')
        tree.remove()
        t.end()
      })
    })
    tree.edit(editStream)

  })
})

test('edit the tree by array of changes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, indicator: true}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    tree.edit([{id: 1002, color: 'red', nodeType: 'perspective', label: 'Patched 1002'}])

    var d = tree.get(1002)
    t.equal(d.label, 'Patched 1002', 'labels are equal')
    t.equal(d.color, 'red', 'colors are equal')
    t.equal(d.nodeType, 'perspective', 'nodeType changed')

    process.nextTick(function () {
      var node = el.querySelector('.tree ul li:nth-child(2)')
      t.equal(node.querySelector('.label').innerHTML, 'Patched 1002', 'dom label changed')
      t.ok(node.querySelector('.indicator.red'), 'red indicator exists')
      tree.remove()
      t.end()
    })
  })
})

test('edit changes nodes visibility', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      tree.expandAll()

      tree.edit([{id: 1006, visible: false}, {id: 1008, visible: false}, {id: 1058, visible: false}])

      var n1 = tree._layout[1006]
      t.equal(n1.parent.children.length, n1.parent._allChildren.length - 2, 'parent has two invisible nodes')

      var n2 = tree._layout[1058]
      t.equal(n2.parent.children.length, n2.parent._allChildren.length - 1, '1058 parent is missing 1058')
      t.equal(n2.parent.children.indexOf(n2), -1, 'expanded n2 parent does not have 1058 as a child')

      tree.edit([{id: 1058, visible: true}])
      t.equal(n2.parent.children.indexOf(n2), 1, 'expanded n2 parent now contains 1058')
      t.end()
    })
  })

  tree.render()
})

test('patch visibility toggling', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    var el = tree.el.node()
      , parent = tree._layout[1003]

    tree.expandAll()

    var originalIndex = parent.children.indexOf(tree._layout[1006])

    // Set visible: false on 1006
    tree.edit([{id: 1006, visible: false}])
    t.equal(parent.children.length, parent._allChildren.length - 1, '1003 has an invisible node')
    t.equal(parent.children.length, 9, '1003 is missing 1006')

    // Set visible: true on 1006
    tree.edit([{id: 1006, visible: true}])

    t.equal(parent.children.length, parent._allChildren.length, '1003 does not have invisible nodes')
    t.equal(parent.children.indexOf(tree._layout[1006]), originalIndex, '1006 was restored to original location')

    tree.edit([{id: 1006, visible: false}, {id: 1007, visible: false}, {id: 1008, visible: false}])
    tree.edit([{id: 1008, visible: true}])

    t.equal(parent.children.length, 8, '1003 has two invisible nodes')

    var p = -Infinity
    parent.children.forEach(function (node) {
      t.ok(node.id > p, 'node id ' + node.id + ' is greater than prev node id ' + p)
      p = node.id
    })

    t.end()
  })
  tree.render()
})

test('edit the tree with stream of data events containing the changes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()
    , editStream = new Readable({objectMode: true})
    , i = 1002

  editStream._read = function () {
    var id = i++
    if (id < 1004) {
      return editStream.push({id: id, label: 'Patched ' + id })
    }
    editStream.push(null)
  }

  tree.on('rendered', function () {
    editStream.on('end', function () {
      t.equal(tree.get(1002).label, 'Patched 1002', '1002 labels are equal')
      t.equal(tree.get(1003).label, 'Patched 1003', '1003 labels are equal')
      tree.remove()
      t.end()
    })
    tree.edit(editStream)
  })
})

test('toggle a specific node', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  tree.on('rendered', function () {
    var d = tree.get(1002)
    tree.toggle(d) // 1002 is the first child of root
    t.ok(tree._layout[1002].children, 'node should have children')
    t.ok(!tree._layout[1002]._children, 'node should not have hidden children')
    t.equal(el.querySelectorAll('.tree ul li').length, 8, 'root + children + first child expanded')
    t.end()
  })
})

test('click toggler listener', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}, {})

  tree.on('rendered', function () {
    setTimeout(function () {
      var node = tree._layout[1002]
      t.ok(!node.children, 'first child has hidden children')
      tree.node.nodes()[1].querySelector('.toggler').click()
      t.ok(node.children, 'first child has children after click event')
      tree.remove()
      t.end()
    }, 10)
  })
  tree.render()
})

test('click toggler disabled on root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rendered', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      t.ok(tree.get().children, 'root starts with exposed children')
      tree.node.nodes()[0].querySelector('.toggler').click()
      t.ok(tree.get().children, 'root has exposed children after we tried to toggle')
      t.end()
    })
  })

  tree.render()
})

test('sets `tree-overflow` based on scrollable content', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})
    , container = document.createElement('div')

  container.style.height = '100px'
  document.body.appendChild(container)
  tree.on('rendered', function () {
    container.appendChild(tree.el.node())
    t.ok(tree.el.select('.tree').classed('tree-overflow'), 'tree has `tree-overflow`')
    container.style.height = '2000px'
    tree.resize()
    t.notOk(tree.el.select('.tree').classed('tree-overflow'), 'tree does not have `tree-overflow`')

    tree.resize(10000) // exaggerate number of nodes
    t.ok(tree.el.select('.tree').classed('tree-overflow'), 'tree is marked `tree-overflow` with visibleNodes set')
    container.remove()

    t.end()
  })

  tree.render()
})

test('emits `rebind:exit` with nodes being removed', function (t) {
  t.plan(2)
  let s = stream()
    , tree = new Tree({stream: s})

  tree.on('rebind:exit', selection => {
    t.ok(data, 'rebind:exit called')
    t.equal(selection.size(), 34, 'nodes removed')
    t.end()
  })

  tree.render()

  tree.on('rendered', function () {
    tree.expandAll() // Show everything
    tree.collapseAll() // Collapse which will remove a bunch of nodes
  })
})

test('emits `rebind` event when rebinding data', function (t) {
  t.plan(1)
  var s = stream()
    , tree = new Tree({stream: s})

  tree.on('rebind', function (data) {
    t.ok(data, 'rebind called')
    t.end()
  })

  tree.render()
})

test('returns expanded nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  t.plan(4)

  tree.on('rendered', () => {
    t.equal(tree.expandedNodes().length, 1, 'one expanded node')
    t.equal(tree.expandedNodes()[0].id, 1001, 'root is only expanded node')

    tree.select(1003)

    t.equal(tree.expandedNodes().length, 3, 'three expanded nodes')

    tree.expandAll()
    t.equal(tree.expandedNodes().length, Object.keys(tree.nodes).length, 'All nodes are expanded')

    t.end()
  })
  tree.render()
})
