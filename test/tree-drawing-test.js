var test = require('tape').test
  , d3 = require('d3')
  , Tree = require('../')
  , Transform = require('stream').Transform
  , Readable = require('stream').Readable
  , stream = require('./tree-stream')
  , data = require('./tree.json')

test('multiple trees have their own options', function (t) {
  var tree1 = new Tree({stream: stream(), depth: 390}).render()
    , tree2 = new Tree({stream: stream() }).render()

  t.notDeepEqual(tree1.options, tree2.options, 'options should not be shared')
  tree1.el.remove()
  tree2.el.remove()
  t.end()
})

test('emits node events', function (t) {
  var s = stream()
    , tree = new Tree({stream: s})
    , nodes = []

  tree.on('node', function (node) {
    nodes.push(node)
  })

  s.on('end', function () {
    t.equal(nodes.length, data.length, 'node event emitted for each node in stream')
    tree.el.remove()
    t.end()
  })
  tree.render()
})

test('render populates data from stream', function (t) {
  var tree = new Tree({stream: stream()}).render()
  t.equal(Object.keys(tree._nodeData).length, data.length, '_nodeData contains all data')
  tree.el.remove()
  t.end()
})

test('does not apply indicator class to label-mask by default', function (t) {
  var tree = new Tree({stream: stream()}).render()
    , el = tree.el.node()
  t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask').length, 1, 'we have a label mask')
  t.equal(el.querySelectorAll('.tree ul li:first-child .label-mask.indicator').length, 0, 'label mask is missing an indicator class')
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

test('emits stream on errors on tree', function (t) {
  var stream = new Readable({objectMode: true})
  stream._read = function () {
    this.emit('error', new Error('Blue Smoke'))
  }

  var tree = new Tree({
    stream: stream
  })

  tree.on('error', function (e) {
    t.ok(e, 'error event')
    t.equal(e.message, 'Blue Smoke', 'error message matches')
    tree.el.remove()
    t.end()
  })

  tree.render()
})

test('disables animations if opts.maxAnimatable is exceeded', function (t) {
  var tree = new Tree({stream: stream(), maxAnimatable: 3}).render()
    , tick = process.nextTick

  process.nextTick = function (fn) {
    process.nextTick = tick // back to normal
    t.ok(tree.node.classed('notransition'), 'tree nodes have notransition class applied')
    fn()
    process.nextTick(function () {
      t.ok(!tree.node.classed('notransition'), 'tree nodes notransition class removed')
      tree.el.remove()
      t.end()
    })
  }
  t.equal(tree.get(1003)._children.length, 10, 'has 10 hidden nodes')
  tree.select(1003)
})
