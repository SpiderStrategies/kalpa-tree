var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('get', function (t) {
  var tree = new Tree({stream: stream()}).render()

  t.deepEqual(tree.get(), tree._nodeData[0], 'get returns root by default')
  t.deepEqual(tree.get(1002), tree._nodeData[0].children[0], 'get returns a node by id')
  t.ok(tree.get(1006), 'get returns nodes that are hidden')
  tree.el.remove()
  t.end()
})

test('selects a node', function (t) {
  var tree = new Tree({stream: stream()}).render()
  tree.select(1003)

  var selected = tree.getSelected()
  t.deepEqual(selected.datum(), tree.get(1003), 'getSelected gives us the selected node')
  t.ok(tree.get(1003).selected,  'selected node is selected')
  t.ok(tree.get(1003).children, 'selected node is expanded')

  tree.collapseAll()
  setTimeout(function () {
    // wait for the tree to be collapsed, then select a deep leaf.
    tree.select(1004)
    // Make sure all ancestors of the selected node are also expanded.
    var leaf = tree.getSelected().datum()
    t.ok(leaf.parent.children, '01 has children')
    t.ok(leaf.parent.parent.children, 'P1 has children')
    t.ok(leaf.parent.parent.parent.children, 'Root has children')
    tree.el.remove()
    t.end()
  }, 400)
})

test('select will not toggle an already expanded node', function (t) {
  var tree = new Tree({stream: stream()}).render()

  tree.expandAll()
  tree.select(1003)
  t.ok(tree.get(1003).children, 'previously expanded node is still expanded after select')

  tree.el.remove()
  t.end()
})

test('selects a node with options', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , calls = 0

  tree.on('select', function (d) {
    t.ok(d._children, 'selected node is not expanded')
  })

  tree.select(1058, {silent: true})
  tree.select(1003, {toggleOnSelect: false})

  t.ok(++calls, 1, 'select only fired once')
  tree.el.remove()
  t.end()
})

test('editable', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.editable()
  t.ok(el.querySelector('.tree.editable'), 'there is an tree editable object')
  t.ok(tree.isEditable(), 'the tree is editable')

  tree.editable()
  t.ok(!el.querySelector('.tree.editable'), 'there is not an tree editable object')
  t.ok(!tree.isEditable(), 'the tree is not editable')

  tree.el.remove()
  t.end()
})

test('expand all', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  t.equal(el.querySelectorAll('.tree ul li').length, 3, 'tree has 3 nodes initially')
  tree.expandAll()
  tree.node.each(function (d) {
    t.ok(!d._children, 'node should have no hidden children')
  })
  t.equal(el.querySelectorAll('.tree ul li').length, data.length, 'all nodes should be visible')
  tree.el.remove()
  t.end()
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

test('toggle a specific node', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  var d = tree.get(1002)
  tree.toggle(d) // 1002 is the first child of root
  t.ok(d.children, 'node should have children')
  t.ok(!d._children, 'node should not have hidden children')
  t.equal(el.querySelectorAll('.tree ul li').length, 8, 'root + children + first child expanded')
  t.equal(el.querySelector('.tree ul li:nth-child(4) .label').innerHTML, 'O1', 'P2 first child is visible')

  // Now toggle again
  tree.toggle(tree.get(1002))
  t.ok(!d.children, 'node should not have children')
  t.ok(d._children, 'node should have hidden children')

  // pause since exit has a 300 duration
  setTimeout(function () {
    t.equal(el.querySelectorAll('.tree ul li').length, 3, 'root + children visible')
    tree.el.remove()
    t.end()
  }, 400)
})

test('click toggler listener', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , node = tree.get(1002)
  t.ok(node._children, 'first child has hidden children')
  tree.node[0][1].querySelector('.toggler').click()
  t.ok(node.children, 'first child has children after click event')
  t.end()
})

test('click toggler disabled on root', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  t.ok(tree.get().children, 'root starts with exposed children')
  tree.node[0][0].querySelector('.toggler').click()
  t.ok(tree.get().children, 'root has exposed children after we tried to toggle')
  t.end()
})
