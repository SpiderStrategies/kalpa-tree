var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , stream = require('./tree-stream')
  , Transform = require('stream').Transform

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

test('search ignores `visible: false` nodes', function (t) {
  var map = new Transform( { objectMode: true } )
    , hiddens = [1002, 1003, 1081]

  map._transform = function(obj, encoding, done) {
    if (hiddens.indexOf(obj.id) !== -1) {
      obj.visible = false
    }
    this.push(obj)
    done()
  }

  var s = stream().pipe(map)
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  s.on('end', function () {
    t.equal(tree.node.size(), 2, '2 initial nodes')
    tree.search('O1')
    t.equal(tree.node.size(), 0, '0 nodes visible')
    tree.remove()
    t.end()
  })
})

test('search for null clears search', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , el = tree.el.node()

  s.on('end', function () {
    t.equal(tree.node.size(), 3, '3 initial nodes')
    tree.search('M')
    t.equal(tree.node.size(), 25, '25 nodes visible')
    tree.search(null)
    var clazzed = false
    tree.node.each(function (n) {
      if (d3.select(this).classed('search-result')) {
        clazzed = true
      }
    })
    t.ok(!clazzed, 'no nodes have search-result class')
    t.equal(tree.node.size(), 3, '3 nodes visible')
    tree.remove()
    t.end()
  })
})
