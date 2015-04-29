var test = require('tape').test
  , Tree = require('../')
  , Readable = require('stream').Readable
  , nodes = [{
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

  s.on('end', function () {
    t.equal(Object.keys(tree.nodes).length, nodes.length, 'nodes contains all data')
    t.equal(Object.keys(tree._layout).length, nodes.length, '_layout contains all data')
    t.equal(tree.root.length, 2, 'two root nodes')
    t.equal(tree.node[0].length, 4, '4 list elements displayed')

    var rootClz = false
    tree.node.each(function () {
      if (d3.select(this).classed('root')) {
        rootClz = true
      }
    })
    t.ok(!rootClz, 'no nodes have root class')
    tree.collapseAll()
    setTimeout(function () {
      t.equal(tree.node[0].length, 2, '2 list elements displayed after a collapse all')
      tree.el.remove()
      t.end()
    }, 400)
  })
})

test('allows addition of new root elements', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  s.on('end', function () {
    t.equal(tree.root.length, 2, 'two root nodes')

    tree.add({label: 'New root node', id: 1010})
    t.equal(tree.root.length, 3, 'three root nodes')
    t.equal(tree.node[0].length, 5, '5 list elements displayed')
    t.end()
  })
})

test('allows addition of new root elements at an index', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  s.on('end', function () {
    tree.add({label: 'New root node', id: 1010}, null, 0)
    t.equal(tree.root.length, 3, 'three root nodes')
    t.equal(tree.root[0].id, 1010, 'first root node is the new node')
    t.equal(tree.node[0][0].querySelector('.label').innerHTML, 'New root node', 'first dom node is the new node')
    t.end()
  })
})

test('root nodes can be removed', function (t) {
  var s = stream()
    , tree = new Tree({stream: s, forest: true}).render()

  s.on('end', function () {
    tree.removeNode(1002)
    t.equal(tree.root.length, 1, 'one root node')
    t.equal(tree.root[0].id, 1001, 'only root is 1001')
    t.equal(Object.keys(tree._layout).length, 1, 'one _layout node')
    t.equal(Object.keys(tree.nodes).length, 1, 'one node in nodes')
    t.end()
  })
})
