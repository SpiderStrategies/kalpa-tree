import { test } from 'tape'
import layout from '../lib/layout.js'

function tree () {
  return {
    id: 1,
    children: [{
      id: 2,
      children: [{id: 3}, {id: 4}]
    }, {
      id: 5
    }]
  }
}

test('generates a forest tree', function (t) {
  var forest = [{
      id: 1,
      children: [{
        id: 2,
        children: [{id: 3}, {id: 4}]
      }, {
        id: 5
      }]
    }, {
      id: 6
    }, {
      id: 7,
      children: [{
        id: 8
      }]
    }
  ]

  var l = layout(20, 40, 0, function (d) {
            return d.children
          })
    , nodes = l(forest)

  t.equal(nodes.length, 8, '8 nodes in tree')

  t.equal(nodes[0].depth, 0, 'first root has depth 0')
  t.equal(nodes[0]._x, 0, 'first root _x')
  t.equal(nodes[0]._y, 0, 'first root _y')

  t.equal(nodes[5].depth, 0, 'second root has depth 0')
  t.equal(nodes[5]._x, 0, 'second root _x')
  t.equal(nodes[5]._y, 200, 'second root _y')
  t.equal(nodes[6].depth, 0, 'third root has depth 0')
  t.equal(nodes[6]._x, 0, 'third root _x')
  t.equal(nodes[6]._y, 240, 'third root _y')
  t.equal(nodes[7].depth, 1, 'last root first child depth')
  t.equal(nodes[7]._x, 20, 'last root first child _x')
  t.equal(nodes[7]._y, 280, 'last root first child _y')
  t.end()
})

test('generates a forest tree with hidden roots', function (t) {
  var forest = [{
      id: 1,
      children: [{
        id: 2,
        children: [{id: 3}, {id: 4}]
      }, {
        id: 5
      }]
    }, {
      id: 6,
      visible: false
    }, {
      id: 7,
      visible: false,
      children: [{
        id: 8
      }]
    }
  ]

  var l = layout(20, 40, 0, function (d) {
            return d.children
          })
    , nodes = l(forest)

  t.equal(nodes.length, 5, '5 nodes in tree')
  t.end()
})

test('generates an empty tree', function (t) {
  var l = layout()
  t.plan(1)
  t.deepEqual(l(null), [], 'empty tree with null root')
  t.end()
})

test('generates a tree layout', function (t) {
  var l = layout(20, 40, 0, function (d) {
        return d.children
      })
    , nodes = l(tree())

  t.equal(nodes.length, 5, '5 nodes in tree')
  t.equal(nodes[0].depth, 0, 'root has depth 0')
  t.equal(nodes[0]._x, 0, 'root _x')
  t.equal(nodes[0]._y, 0, 'root _y')
  t.equal(nodes[1].depth, 1, 'depth 1 set for first child')
  t.equal(nodes[1]._x, 20, '_x set for first child')
  t.equal(nodes[1]._y, 40, '_y for first child')

  t.equal(nodes[2].depth, 2, 'depth 1 set for first grandchild')
  t.equal(nodes[2]._x, 40, '_x set for first grandchild')
  t.equal(nodes[2]._y, 80, '_y for first grandchild')

  t.equal(nodes[4].depth, 1, 'depth 1 set for second child')
  t.equal(nodes[4]._x, 20, '_x set for second child')
  t.equal(nodes[4]._y, 160, '_y set for second child')
  t.end()
})

test('applies a root offset', function (t) {
  var l = layout(20, 40, 10, function (d) {
        return d.children
      })
    , nodes = l(tree())

  t.equal(nodes[0]._y, 0, 'root _y does not use offset')
  t.equal(nodes[1]._y, 50, 'first child includes offset')
  t.equal(nodes[2]._y, 90, 'first grand child includes offset')

  t.end()
})
