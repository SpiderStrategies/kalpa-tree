var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('render populates data from stream', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.equal(tree._nodeData.length, data.length, '_nodeData contains all data')
  tree.el.remove()
  t.end()
})

test('displays root and its children by default', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.equal(tree.node.size(), 3, '3 nodes by default')
  tree.el.remove()
  t.end()
})

test('displays a node as selected on render', function (t) {
  var tree = new Tree({
    stream: stream(),
    initialSelection: 1003
  })

  tree.on('select', function () {
    t.fail('should not fire select on initial selection')
  })

  tree.render()
  t.equal(tree.node.size(), 8, '3 nodes by default')
  tree.el.remove()
  t.end()
})
