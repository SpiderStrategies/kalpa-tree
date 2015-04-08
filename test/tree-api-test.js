var test = require('tape').test
  , d3 = require('d3')
  , Readable = require('stream').Readable
  , Tree = require('../')
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('get', function (t) {
  var tree = new Tree({stream: stream()}).render()

  t.deepEqual(tree.get(), tree.root, 'get returns root by default')
  t.deepEqual(tree.get(1002), tree.root.children[0], 'get returns a node by id')
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

test('selects a node without animations', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , tick = process.nextTick

  process.nextTick = function (fn) {
    process.nextTick = tick // back to normal

    t.ok(tree.node.classed('notransition'), 'tree nodes have notransition class applied')
    fn()
    t.ok(!tree.node.classed('notransition'), 'tree nodes notransition class removed')
    tree.el.remove()
    t.end()
  }
  tree.select(1003, {animate: false})
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

test('removes a node by id', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.expandAll() // start expanded

  t.equal(Object.keys(tree._nodeData).length, data.length, 'starts with all nodes')
  tree.remove(1002)
  t.equal(Object.keys(tree._nodeData).length, 11, 'nodes were removed from _nodeData')

  setTimeout(function () {
    var node = el.querySelector('.tree ul li:nth-child(2)')
    t.equal(el.querySelectorAll('.tree ul li').length, 7, 'removed nodes no longer in the dom')
    t.end()
  }, 400)
})

test('removes a node by data object', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()
  tree.remove(tree.get(1002))
  t.equal(Object.keys(tree._nodeData).length, 11, 'nodes were removed from _nodeData')
  t.end()
})

test('prevents add for a node w/ that id', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  var d = tree.add({
    id: 1001
  })
  t.ok(!d, 'd is undefined')
  t.end()
})

test('adds a node to a parent', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.expandAll()

  var d = tree.add({
    id: 3020,
    label: 'Newest node',
    color: 'green',
    nodeType: 'metric'
  }, 1003)

  t.deepEqual(d.parent, tree.get(1003), 'new node\'s parent is correct')
  t.equal(tree._nodeData[3020], d, 'node was added to _nodeData')
  t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node', 'new node label is correct')
  t.end()
})

test('adds a node to a parent and before sibling', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.expandAll()

  var d = tree.add({
    id: 3020,
    label: 'Newest node sibling',
    color: 'green',
    nodeType: 'metric'
  }, 1003, 1) // Add as the second node

  t.equal(tree.get(1003).children.indexOf(d), 1, 'new node index is correct in parent\'s children')
  t.deepEqual(d.parent.children[2], tree.get(1005), 'sibling 1005 is after the new node')
  t.equal(tree._nodeData[3020], d, 'node was added to _nodeData')
  t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node sibling', 'new node label is correct')
  t.end()
})

test('edits a node', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.edit({
    id: 1001,
    label: 'New label for root',
    color: 'green'
  })

  var d = tree.get(1001)
  t.equal(d.label, 'New label for root', 'label changed')
  t.equal(d.color, 'green', 'color changed')
  t.equal(d.nodeType, 'root', 'nodeType remained the same')

  t.equal(el.querySelector('.tree ul li:nth-child(1) .label').innerHTML, 'New label for root', 'dom label changed')
  t.end()
})

test('patch the tree by array of changes', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.patch([{id: 1002, color: 'red', nodeType: 'perspective', label: 'Patched 1002'}])

  var d = tree.get(1002)
  t.equal(d.label, 'Patched 1002', 'labels are equal')
  t.equal(d.color, 'red', 'colors are equal')
  t.equal(d.nodeType, 'perspective', 'nodeType changed')

  var node = el.querySelector('.tree ul li:nth-child(2)')
  t.equal(node.querySelector('.label').innerHTML, 'Patched 1002', 'dom label changed')
  t.ok(node.querySelector('.indicator.red'), 'red indicator exists')
  t.end()
})

test('patch changes nodes visibility', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  tree.patch([{id: 1006, visible: false}, {id: 1008, visible: false}, {id: 1058, visible: false}])

  var n1 = tree.get(1006)
  t.equal(n1.parent._invisibleNodes.length, 2, '1006 and 1008 parent has _invisibleNodes')
  t.equal(n1.parent._children.length, 8, '1003 _children do not contain 1006 and 1008')

  var n2 = tree.get(1058)
  t.ok(!n2.visible, 'deleted n2.visible')
  t.deepEqual(n2.parent._invisibleNodes[0], n2, '1058 parent _invisibleNodes contains 1058')

  tree.expandAll()

  t.equal(n2.parent.children.indexOf(n2), -1, 'expanded n2 parent does not have 1058 as a child')

  tree.patch([{id: 1058, visible: true}])
  t.equal(n2.parent.children.indexOf(n2), 1, 'expanded n2 parent now contains 1058')
  t.end()
})

test('patch the tree with stream of data events containing the changes', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()
    , patchStream = new Readable({objectMode: true})
    , i = 1002

  patchStream._read = function () {
    var id = i++
    if (id < 1004) {
      return patchStream.push({id: id, label: 'Patched ' + id })
    }
    patchStream.push(null)
  }
  tree.patch(patchStream)
  t.equal(tree.get(1002).label, 'Patched 1002', '1002 labels are equal')
  t.equal(tree.get(1003).label, 'Patched 1003', '1003 labels are equal')
  t.end()
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
