var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , stream = require('./tree-stream')

test('search', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  s.on('end', function () {
    t.equal(tree.node.size(), 3, '3 initial nodes')
    tree.search('M')
    t.equal(tree.node.size(), 25, '25 nodes visible')
    var clazzed = true
    tree.node.each(function (n) {
      if (!d3.select(this).classed('search-result')) {
        clazzed = false
      }
    })
    t.ok(clazzed, 'all nodes have search-result class')
    t.equal()
    t.equal(tree.nodes[d3.select(tree.node[0][0]).datum().id].label, 'M1', 'M1 is the first result')
    tree.select(d3.select(tree.node[0][3]).datum().id)
    t.equal(tree.node.size(), 18, '18 nodes visible')
    clazzed = false
    tree.node.each(function (n) {
      if (d3.select(this).classed('search-result')) {
        clazzed = true
      }
    })
    t.ok(!clazzed, 'no nodes have search-result class')
    tree.remove()
    t.end()
  })
})

test('search allows different characters', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  s.on('end', function () {
    tree.search('as\\')
    t.equal(tree.node.size(), 0, '0 nodes visible')
    t.end()
  })
})
