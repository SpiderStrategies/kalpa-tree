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
  var tree = new Tree({stream: stream()}).render()
  t.equal(Object.keys(tree._nodeData).length, nodes.length, '_nodeData contains all data')
  t.equal(tree.root.length, 2, 'two root nodes')
  t.equal(tree.node[0].length, 4, '4 list elements displayed')
  tree.collapseAll()
  setTimeout(function () {
    t.equal(tree.node[0].length, 2, '2 list elements displayed after a collapse all')
    tree.el.remove()
    t.end()
  }, 400)

})
