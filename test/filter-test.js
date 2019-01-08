var test = require('tape').test
  , d3 = require('d3-selection')
  , css = require('./../dist/tree.css')
  , Tree = require('../')
  , stream = require('./tree-stream')
  , Transform = require('stream').Transform
  , PassThrough = require('stream').PassThrough

function container () {
  var container = document.createElement('div')
  container.className = 'container'
  container.style.height = '10000px'
  document.body.appendChild(container)
  return container
}

test('filter call is noop if not displaying filter results', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  s.on('end', function () {
    tree.select(1058)
    t.equal(tree.node.size(), 8, '8 initial nodes')
    tree.filter()
    t.equal(tree.node.size(), 8, '8 nodes displayed after filter for null')
    tree.filter()
    t.equal(tree.node.size(), 8, '8 nodes displayed because it should not toggle')
    tree.remove()
    t.end()
  })
})

test('filter function shows by nodeType', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , c = container()

  c.appendChild(tree.el.node())

  s.on('end', function () {
    tree.select(1058)
    t.equal(tree.node.size(), 8, '8 initial nodes')
    tree.filter(function (d) {
      return d.nodeType === 'metric'
    })
    t.equal(tree.node.size(), 24, '24 metric nodes')
    tree.remove()
    c.remove()
    t.end()
  })
})

test('search', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , c = container()

  c.appendChild(tree.el.node())

  s.on('end', function () {
    t.equal(tree.node.size(), 3, '3 initial nodes')
    tree.search('M')
    t.equal(tree.node.size(), 25, '25 nodes visible')
    t.ok(tree.el.select('.tree').classed('filtered-results'), 'tree has filtered-results class')
    t.ok(tree._filteredResults, 'tree stored _filteredResults data')
    t.equal(tree.nodes[d3.select(tree.node.nodes()[0]).datum().id].label, 'M1', 'M1 is the first result')
    tree.select(d3.select(tree.node.nodes()[3]).datum().id)
    t.equal(tree.node.size(), 18, '18 nodes visible')
    t.ok(!tree.el.select('.tree').classed('filtered-results'), 'tree does not have filtered-results class')
    t.ok(!tree._filteredResults, 'tree no longer has _filteredResults data')
    tree.remove()
    c.remove()
    t.end()
  })
})

test('search allows different characters', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

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
    , c = container()

  c.appendChild(tree.el.node())

  s.on('end', function () {
    t.equal(tree.node.size(), 3, '3 initial nodes')
    tree.search('M')
    t.equal(tree.node.size(), 25, '25 nodes visible')
    tree.search(null)
    t.ok(!tree.el.select('.tree').classed('filtered-results'), 'tree does not have filtered-results class')
    t.equal(tree.node.size(), 3, '3 nodes visible')
    tree.remove()
    c.remove()
    t.end()
  })
})

test('empty forest null search', function (t) {
  let tree = new Tree({stream: new PassThrough, forest: true}).render()
  tree.search(null)
  t.ok(!tree.el.select('.tree').classed('filtered-results'), 'tree does not have filtered-results class')
  t.end()
})

test('clearing search does not fire select event', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  s.on('end', function () {
    tree.on('select', function () {
      t.fail('should not fire select')
    })
    tree.search('M')
    tree.search(null)
    tree.remove()
    t.end()
  })
})

test('shows selected search result in a collapsed tree', function (t) {
  var s = stream()
    , tree = new Tree({ stream: s }).render()
    , c = container()

  c.appendChild(tree.el.node())

  s.on('end', function () {
    tree.expandAll()
    tree.search('M')
    t.equal(tree.node.size(), 25, '25 nodes visible')
    t.ok(tree.el.select('.tree').classed('filtered-results'), 'tree showing filtered-results')
    tree.node.nodes()[3].click() // Click on M4
    t.equal(tree.node.size(), 18, '18 nodes visible') // Not all nodes from previous expandAll
    t.ok(!tree.el.select('.tree').classed('filtered-results'), 'tree not showing filtered-results')
    tree.remove()
    t.end()
  })
})

test('ignores rootHeight overrides while showing results', function (t) {
  var s = stream()
    , tree = new Tree({
      stream: s,
      rootHeight: 50
    }).render()

  s.on('end', function () {
    t.ok(tree.el.select('.tree').classed('detached-root'), 'detached root')
    t.equal(tree.el.select('.tree ul li:nth-child(2)').datum()._y, 50, 'second node is at 50')
    tree.search('M')
    t.ok(!tree.el.select('.tree').classed('detached-root'), 'tree not showing a detached root')
    t.equal(tree.el.select('.tree ul li:nth-child(2)').datum()._y, 36, 'second node is at 36 (regular height)')
    tree.search(null)

    setTimeout(function () {
      t.ok(tree.el.select('.tree').classed('detached-root'), 'tree back to detached root')
      t.equal(tree.el.select('.tree ul li:nth-child(2)').datum()._y, 50, 'second node back at 50')
      tree.remove()
      t.end()
    }, 400)
  })
})

test('forces tree into performance mode when filtering', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()
    , c = container()
  c.style.height = '100px'
  c.appendChild(tree.el.node())

  s.on('end', function () {
    tree.select(1058)
    t.equal(tree.node.size(), 8, '8 initial nodes') // Not in performance mode, so all nodes will be there
    tree.filter(function (d) {
      return d.nodeType === 'metric'
    })
    t.equal(tree.node.size(), 5, '5 metric nodes')
    t.ok(tree.options.performanceThreshold, 1000, 'resets performanceThreshold to default')
    tree.remove()
    c.remove()
    t.end()
  })
})
