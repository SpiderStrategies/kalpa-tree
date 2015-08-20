var test = require('tape').test
  , d3 = require('d3')
  , Readable = require('stream').Readable
  , Tree = require('../')
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('get', function (t) {
  var tree = new Tree({stream: stream()}).render()

  t.deepEqual(tree.get(), tree.root, 'get returns root by default')
  t.deepEqual(tree.get(1002), tree.nodes[1002], 'get returns a node by id')
  t.ok(tree.get(1006), 'get returns nodes that are hidden')
  tree.el.remove()
  t.end()
})

test('parent', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.deepEqual(tree.parent(1002), tree.get(1001), 'returns a nodes parent by id')
  t.deepEqual(tree.parent(tree.get(1002)), tree.get(1001), 'returns a nodes parent by object')
  t.ok(!tree.parent(1001), 'returns null for root')
  tree.el.remove()
  t.end()
})

test('children', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.equal(tree.children(1001).length, 2, 'root has two children')
  t.equal(tree.children(1007).length, 0, 'a leaf has no children')
  t.equal(tree.children(1058).length, 5, 'a collapsed node has children')

  var children = tree.children(1003)
  t.equal(children.length, 10, '1003 has ten children')

  tree.patch([{id: 1006, visible: false}, {id: 1007, visible: false}])
  t.deepEqual(children, tree.children(1003), '1003 has the same number of children')
  tree.el.remove()
  t.end()
})

test('siblings', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  s.on('end', function () {
    t.ok(!tree.previousSibling(1001), 'root has no previous sibling')
    t.ok(!tree.nextSibling(1001), 'root has no next sibling')

    t.deepEqual(tree.nextSibling(1007), tree.get(1008), 'correct next sibling')
    t.deepEqual(tree.previousSibling(1008), tree.get(1007), 'correct previous sibling')

    tree.patch([{id: 1006, visible: false}, {id: 1007, visible: false}])
    t.deepEqual(tree.nextSibling(1005), tree.get(1006), 'next sibling includes invisible nodes')
    t.deepEqual(tree.previousSibling(1008), tree.get(1007), 'previous sibling includes invisible nodes')
    tree.remove()
    t.end()
  })
})

test('moves a node', function (t) {
  var tree = new Tree({stream: stream()}).render()
     , el = tree.el.node()
     , orgParent = tree._layout[1003].parent
     , orgChildrenLength = orgParent._allChildren.length

  tree.move(1003, 1025)

  process.nextTick(function () {
    t.equal(orgParent._allChildren.length, orgChildrenLength - 1, 'orginal parent is missing a child')
    t.deepEqual(tree._layout[1003].parent, tree._layout[1025], 'moved node has new parent')
    t.deepEqual(tree._layout[1025]._allChildren[tree._layout[1025]._allChildren.length -1], tree._layout[1003], '1003 was pushed to end of 1025')
    t.end()
  })
})

test('copies a node', function (t) {
  var tree = new Tree({stream: stream()}).render()
     , el = tree.el.node()
     , orgParent = tree._layout[1003].parent
     , orgChildrenLength = orgParent._allChildren.length

  tree.copy(1003, 1025, function (d) {
    d.id = d.id + 10000
    return d
  })

  process.nextTick(function () {
    t.equal(orgParent._allChildren.length, orgChildrenLength, 'orginal parent has its children')
    t.deepEqual(tree._layout[11003].parent, tree._layout[1025], 'moved node has new parent')
    t.end()
  })
})

test('selects a node', function (t) {
  var tree = new Tree({stream: stream()}).render()
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

test('select a node adds transitions by default', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  s.on('end', function () {
    t.ok(!tree.el.select('.tree').classed('transitions'), 'tree el does not have transitions by default')
    var toggler = tree.toggle
    tree.toggle = function () {
      toggler.apply(tree, arguments)
      t.ok(tree.el.select('.tree').classed('transitions'), 'tree has transitions class applied')
      process.nextTick(function () {
        t.ok(!tree.el.select('.tree').classed('transition'), 'tree transitions class not there after toggle')
        tree.el.remove()
        t.end()
      })
    }
    tree.select(1002)
  })
})

test('selects a node without animations', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  s.on('end', function () {
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
  var tree = new Tree({stream: stream()}).render()

  tree.expandAll()
  tree.select(1003)
  t.ok(tree._layout[1003].children, 'previously expanded node is still expanded after select')

  tree.el.remove()
  t.end()
})

test('selects a node with options', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , calls = 0

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

test('select disables animations if selected node parent is not visible', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
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
  var tree = new Tree({stream: stream()}).render()
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

test('select does not scroll if node is within viewport', function (t) {
  var tree = new Tree({stream: stream()}).render()
  tree.el.select('.tree')
           .style('overflow', 'auto')
           .style('height', '150px')

  document.body.appendChild(tree.el.node())
  tree.select(1058, {animate: false})
  t.equal(tree.el.select('.tree').node().scrollTop, 0, 'scroll top is 0')
  tree.remove()
  t.end()
})

test('getSelectedEl returns the selected node\'s dom element', function (t) {
  var tree = new Tree({stream: stream()}).render()

  tree.select(1003)

  var data = tree.selected()
    , el = tree.selectedEl()
  process.nextTick(function () {
    t.equal(data.label, el.querySelector('.label').innerHTML, 'selected dom node label is correct')
    tree.el.remove()
    t.end()
  })
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
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
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

  s.on('end', function () {
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

  s.on('end', function () {
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

  s.on('end', function () {
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

  s.on('end', function () {
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

test('prevents add for a node w/ that id', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
    var d = tree.add({
      id: 1001
    })
    t.ok(!d, 'd is undefined')
    t.end()
  })
  tree.render()
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

  process.nextTick(function () {
    t.deepEqual(tree._layout[3020].parent, tree._layout[1003], 'new node\'s parent is correct')
    t.equal(tree.nodes[3020], d, 'node was added to nodes')
    t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node', 'new node label is correct')
    t.end()
  })
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

  process.nextTick(function () {
    t.equal(tree._layout[1003].children.indexOf(tree._layout[3020]), 1, 'new node index is correct in parent\'s children')
    t.deepEqual(tree._layout[3020].parent.children[2], tree._layout[1005], 'sibling 1005 is after the new node')
    t.equal(tree.nodes[3020], d, 'stored the node in nodes')
    t.equal(el.querySelector('.tree ul li:last-child .label').innerHTML, 'Newest node sibling', 'new node label is correct')
    t.end()
  })
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

  process.nextTick(function () {
    t.equal(el.querySelector('.tree ul li:nth-child(1) .label').innerHTML, 'New label for root', 'dom label changed')
    t.end()
  })
})

test('patch the tree by array of changes', function (t) {
  var tree = new Tree({stream: stream(), indicator: true}).render()
    , el = tree.el.node()

  tree.patch([{id: 1002, color: 'red', nodeType: 'perspective', label: 'Patched 1002'}])

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

test('patch changes nodes visibility', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      tree.expandAll()

      tree.patch([{id: 1006, visible: false}, {id: 1008, visible: false}, {id: 1058, visible: false}])

      var n1 = tree._layout[1006]
      t.equal(n1.parent.children.length, n1.parent._allChildren.length - 2, 'parent has two invisible nodes')

      var n2 = tree._layout[1058]
      t.equal(n2.parent.children.length, n2.parent._allChildren.length - 1, '1058 parent is missing 1058')
      t.equal(n2.parent.children.indexOf(n2), -1, 'expanded n2 parent does not have 1058 as a child')

      tree.patch([{id: 1058, visible: true}])
      t.equal(n2.parent.children.indexOf(n2), 1, 'expanded n2 parent now contains 1058')
      t.end()
    })
  })

  tree.render()
})

test('patch visibility toggling', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})

  s.on('end', function () {
    var el = tree.el.node()
      , parent = tree._layout[1003]

    tree.expandAll()

    var originalIndex = parent.children.indexOf(tree._layout[1006])

    // Set visible: false on 1006
    tree.patch([{id: 1006, visible: false}])
    t.equal(parent.children.length, parent._allChildren.length - 1, '1003 has an invisible node')
    t.equal(parent.children.length, 9, '1003 is missing 1006')

    // Set visible: true on 1006
    tree.patch([{id: 1006, visible: true}])

    t.equal(parent.children.length, parent._allChildren.length, '1003 does not have invisible nodes')
    t.equal(parent.children.indexOf(tree._layout[1006]), originalIndex, '1006 was restored to original location')

    tree.patch([{id: 1006, visible: false}, {id: 1007, visible: false}, {id: 1008, visible: false}])
    tree.patch([{id: 1008, visible: true}])

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
  tree.remove()
  t.end()
})

test('toggle a specific node', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()

  var d = tree.get(1002)
  tree.toggle(d) // 1002 is the first child of root
  t.ok(tree._layout[1002].children, 'node should have children')
  t.ok(!tree._layout[1002]._children, 'node should not have hidden children')
  t.equal(el.querySelectorAll('.tree ul li').length, 8, 'root + children + first child expanded')
 t.end()
})

test('click toggler listener', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}, {})

  s.on('end', function () {
    setTimeout(function () {
      var node = tree._layout[1002]
      t.ok(!node.children, 'first child has hidden children')
      tree.node[0][1].querySelector('.toggler').click()
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

  s.on('end', function () {
    process.nextTick(function () {
      var el = tree.el.node()
      t.ok(tree.get().children, 'root starts with exposed children')
      tree.node[0][0].querySelector('.toggler').click()
      t.ok(tree.get().children, 'root has exposed children after we tried to toggle')
      t.end()
    })
  })

  tree.render()
})
