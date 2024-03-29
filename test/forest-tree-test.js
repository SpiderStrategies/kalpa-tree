import { test } from 'tape'
import Tree from '../index.js'
import css from './../dist/tree.css'
import { Readable, Transform } from 'stream'
import Dnd from '../lib/dnd.js'
import * as d3 from 'd3-selection'
import event from './event.js'

document.head.innerHTML = `<style>${css}</style>`

var nodes = [{
  "id": 1001,
  "label": "Folder A"
}, {
  "id": 1002,
  "label": "Grumpy Cats"
}, {
  "id": 1003,
  "label": "Grumpy's life",
  "parentId": 1002
}, {
  "id": 1004,
  "label": "The cat's second birthday",
  "parentId": 1002
}]

function stream () {
  var stream = new Readable({objectMode: true})
    , data = JSON.parse(JSON.stringify(nodes))

  stream._read = function () {
    var n = data.shift()
    if (n) {
      return stream.push(n)
    }
    stream.push(null)
  }

  return stream
}

test('forest tree render populates multiple roots', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    tree.expandAll()
    t.equal(Object.keys(tree.nodes).length, nodes.length, 'nodes contains all data')
    t.equal(Object.keys(tree._layout).length, nodes.length, '_layout contains all data')
    t.equal(tree.root.length, 2, 'two root nodes')
    t.equal(tree.node.nodes().length, 4, '4 list elements displayed')

    var rootClz = false
    tree.node.each(function () {
      if (d3.select(this).classed('root')) {
        rootClz = true
      }
    })
    t.ok(!rootClz, 'no nodes have root class')
    tree.collapseAll()
    setTimeout(function () {
      t.equal(tree.node.nodes().length, 2, '2 list elements displayed after a collapse all')
      tree.el.remove()
      t.end()
    }, 400)
  })
})

test('allows addition of new root elements', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()
  tree.on('rendered', function () {
    t.equal(tree.root.length, 2, 'two root nodes')

    var totalNodes = Object.keys(tree.nodes).length
    tree.add({label: 'New root node', id: 1010})
    t.equal(tree.root.length, 3, 'three root nodes')
    t.equal(tree.node.nodes().length, 3, '3 list elements displayed')
    t.equal(Object.keys(tree.nodes).length, totalNodes + 1, 'one more node added to all nodes')
    t.equal(Object.keys(tree.nodes).length, Object.keys(tree._layout).length, '.nodes length equal _layout length ')
    t.end()
  })
})

test('allows addition of new root elements at an index', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    tree.add({label: 'New root node', id: 1010}, null, 0)
    t.equal(tree.root.length, 3, 'three root nodes')
    t.equal(tree.root[0].id, 1010, 'first root node is the new node')
    t.equal(tree.node.nodes()[0].querySelector('.label').innerHTML, 'New root node', 'first dom node is the new node')
    t.end()
  })
})

test('root nodes can be removed', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    tree.removeNode(1002)
    t.equal(tree.root.length, 1, 'one root node')
    t.equal(tree.root[0].id, 1001, 'only root is 1001')
    t.equal(Object.keys(tree._layout).length, 1, 'one _layout node')
    t.equal(Object.keys(tree.nodes).length, 1, 'one node in nodes')
    t.end()
  })
})

test('root nodes return their siblings', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    t.deepEqual(tree.nextSibling(1001), tree.get(1002), 'root has the next sibling')
    t.deepEqual(tree.previousSibling(1002), tree.get(1001), 'root has the previous sibling')
    t.ok(!tree.previousSibling(1001), 'first root has no previous sibling')
    t.ok(!tree.nextSibling(1002), 'last root has no next sibling')
    t.end()
  })
})

test('copies with explicit null to', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function (d) {
    t.equal(tree.root.length, 2, 'two root nodes')
    tree.copy(1003, null, null, function (n) {
      n.id *= 100
      return n
    })
    process.nextTick(function () {
      t.equal(tree.root.length, 3, 'three root nodes')
      t.deepEqual(tree.root[2], tree._layout[100300], 'last root node is 100300')
      t.end()
    })
  })
})

test('copies a node to a new root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    t.equal(tree.root.length, 2, 'two root nodes')
    tree.copy(1003, null, null, function (n) {
      n.id *= 100
      return n
    })

    process.nextTick(function () {
      t.equal(tree.root.length, 3, 'three root nodes')
      t.deepEqual(tree.root[2], tree._layout[100300], 'last root node is 100300')
      t.end()
    })
  })
})

test('moves a node to a new root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    tree.move(1003)

    process.nextTick(function () {
      t.equal(tree.root.length, 3, 'three root nodes')
      t.deepEqual(tree.root[2], tree._layout[1003], 'last root node is 1003')
      t.equal(tree._layout[1002]._allChildren.length, 1, '1002 has one child')

      tree.move(1004, null)
      t.equal(tree.root.length, 4, 'four root nodes')
      t.end()
    })
  })
})

test('moves a node to a new root at some position', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  tree.on('rendered', function () {
    tree.move(1003, null, 0)

    t.deepEqual(tree.root[0], tree._layout[1003], 'first root node is 1003')
    tree.move(1004, null, 1)
    t.deepEqual(tree.root[1], tree._layout[1004], 'second root node is 1004')
    t.equal(tree.root.length, 4, 'four root nodes')
    t.end()
  })
})

test('dnd allows a root nodes to change order', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true, dndDelay: 0}).render()
    , dnd = new Dnd(tree)
    , container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  document.body.appendChild(container)
  container.appendChild(tree.el.node())

  tree.on('rendered', function () {
    tree.select(1003, {animate: false})
    var node = tree.node.nodes()[2]
      , data = tree._layout[1003]

    let e = event('mouse')

    t.equal(tree.root.length, 2, 'two root nodes to start')

    tree.editable()
    dnd.start.apply(node, [e, data, 2])
    dnd._dragging = true
    e.y = 5
    dnd.drag.apply(node, [e, data, 2])

    dnd.end.apply(node, [e, data, 2])
    t.equal(tree.root.length, 3, 'three root nodes')

    var rootOrder = tree.root.map(function (node) { return node.id })
    t.deepEqual(rootOrder, [1003, 1001, 1002], 'root order is 1003, 1001, 1002')

    // Now move 1002 to the top
    node = tree.node.nodes()[2]
    data = tree._layout[1002]
    dnd.start.apply(node, [e, data, 2])
    dnd._dragging = true
    for (var i = data._y; i >= 0; i--) {
      e.y = i
      dnd.drag.apply(node, [e, data, 2])
    }
    dnd.end.apply(node, [e, data, 2])
    var newOrder = tree.root.map(function (node) { return node.id })
    t.deepEqual(newOrder, [1002, 1003, 1001 ], 'new root order is 1002, 1003, 1001')
    tree.remove()
    container.remove()
    t.end()
  })
})

test('dnd allows a node to become a new root', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true, dndDelay: 0}).render()
    , dnd = new Dnd(tree)
    , container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  document.body.appendChild(container)
  container.appendChild(tree.el.node())

  tree.on('rendered', function () {
    tree.select(1003, {animate: false})

    process.nextTick(function () {
      var node = tree.node.nodes()[2]
        , data = tree._layout[1003]
        , e = event('mouse')

      t.equal(tree.root.length, 2, 'two root nodes to start')

      tree.editable()
      dnd.start.apply(node, [e, data, 2])
      dnd._dragging = true
      e.y = 5
      dnd.drag.apply(node, [e, data, 2])
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(0px, 0px); width: calc(100% - 0px)', '0px y indentation')

      tree.on('move', function (n, newParent, previousParent, newIndex, previousIndex) {
        t.equal(n.id, 1003, 'moved node id matches 1003')
        t.ok(!newParent, 'no new parent')
        t.equal(previousParent.id, 1002, 'preview parent is 1002')
        t.equal(newIndex, 0, 'new index 0')
        t.equal(previousIndex, 0, 'prev index 0')

        t.equal(tree.root.length, 3, 'three root nodes')
        t.deepEqual(tree.root[0], data, 'new first root is the node moved')

        tree.remove()
        container.remove()
        t.end()
      })
      dnd.end.apply(node, [e, data, 2])
    })
  })
})

test('dnd flat forest', function (t) {
  var stream = new Readable({objectMode: true})
    , data = JSON.parse(JSON.stringify(nodes))
    , container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  document.body.appendChild(container)

  stream._read = function () {
    var n = data.shift()
    if (n) {
      delete n.parentId
      return stream.push(n)
    }
    stream.push(null)
  }

  var tree = new Tree({
      stream: stream,
      forest: true,
      droppable: function (node, parent) {
        return !parent // Only alow dropping onto root nodes
      },
      dndDelay: 0
    }).render()
    , dnd = new Dnd(tree)

  container.appendChild(tree.el.node())

  stream.on('end', function () {
    tree.select(1003, {animate: false})

    process.nextTick(function () {
      var node = tree.node.nodes()[2]
        , data = tree._layout[1003]
        , e = event('mouse')

      t.equal(tree.root.length, 4, 'four root nodes to start')

      tree.editable()
      dnd.start.apply(node, [e, data, 2])
      dnd._dragging = true

      e.y = 76 // This position would indent 1003 by default
      dnd.drag.apply(node, [e, data, 2])
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(0px, 0px); width: calc(100% - 0px)', '0px y indentation')

      e.y = 65 // This keeps moving 1003 up
      dnd.drag.apply(node, [e, data, 2])

      tree.on('move', function (n, newParent, previousParent, newIndex, previousIndex) {
        t.equal(n.id, 1003, 'moved node id matches 1003')
        t.ok(!newParent, 'no new parent')
        t.ok(!newParent, 'no previous parent')

        t.equal(newIndex, 1, 'new index 1')
        t.equal(previousIndex, 2, 'prev index 2')

        t.equal(tree.root.length, 4, 'still four root nodes')
        t.deepEqual(tree.root[1], data, 'node moved is at index 1 of root nodes')

        tree.remove()
        container.remove()
        t.end()
      })
      dnd.end.apply(node, [e, data, 2])
    })
  })
})

test('hides visible: false root nodes', function (t) {
  var map = new Transform( { objectMode: true } )
    , hiddens = [1002]

  map._transform = function (obj, encoding, done) {
    if (hiddens.indexOf(obj.id) !== -1) {
      obj.visible = false
    }
    this.push(obj)
    done()
  }

  var s = stream()
    , mapStream = s.pipe(map)
    , tree = new Tree({stream: mapStream, forest: true}).render()

  tree.on('rendered', function (d) {
    setTimeout(function () {
      t.equal(tree.root.length, 2, 'two root nodes')
      t.equal(tree.node.size(), 1, '1 node visible')
      t.end()
    }, 100)

  })
})
