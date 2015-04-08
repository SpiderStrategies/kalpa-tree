var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , Transform = require('stream').Transform
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('render populates data from stream', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.equal(Object.keys(tree._nodeData).length, data.length, '_nodeData contains all data')
  tree.el.remove()
  t.end()
})

test('render populates and hides visible: false nodes', function (t) {
  var map = new Transform( { objectMode: true } )
    , hiddens = [1006, 1007, 1008, 1058]

  map._transform = function(obj, encoding, done) {
    if (hiddens.indexOf(obj.id) !== -1) {
      obj.visible = false
    }
    this.push(obj)
    done()
  }

  var s = stream().pipe(map)
    , tree = new Tree({stream: s }).render()
    , el = tree.el.node()

  s.on('end', function () {
    tree.expandAll()
    t.equal(Object.keys(tree._nodeData).length, data.length, '_nodeData contains all data')
    t.equal(el.querySelectorAll('.tree ul li').length, 28, 'visible: false nodes are not displayed')

    var n1 = tree.get(1003)
    t.equal(n1._invisibleNodes.length, 3, '1003 has 3 invisible nodes')
    t.equal(n1.children.length, 7, '1003 children do not display invisible nodes')

    var n2 = tree.get(1058)
    t.ok(!n2.visible, 'deleted n2.visible')
    t.deepEqual(n2.parent._invisibleNodes[0], n2, '1058 parent _invisibleNodes contains 1058')
    tree.el.remove()
    t.end()
  })
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
