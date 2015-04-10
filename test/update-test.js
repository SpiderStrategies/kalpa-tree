var test = require('tape').test
  , d3 = require('d3')
  , update = require('../lib/update')

test('setup', function (t) {
  d3.select(document.body)
    .append('ul')
      .attr('class', 'nodes-container')
    .selectAll('li')
      .data([{y: 1}, {y: 2}, {y: 3}])
      .enter()
        .append('li')
        .append('div')
          .attr('class', 'node-contents')
          .text(function (d) { return d.y })
  t.end()
})

test('update adjusts node styles', function (t) {
  var updater = update({prefix: '-webkit-', options: { height: 10 }})
  var nodes = d3.select('ul.nodes-container').selectAll('li')

  nodes.call(updater)

  nodes.each(function (d, i) {
    var node = d3.select(this)
    t.equal(node.style('opacity'), '1', 'opacity set to 1')
    t.equal(node.style('-webkit-transform'), 'matrix(1, 0, 0, 1, 0, ' + (i * 10) + ')', 'transform y based on index height')
    t.equal(node.select('.node-contents').style('-webkit-transform'), 'matrix(1, 0, 0, 1, ' + (d.y) + ', 0)', 'node contents x transform based on original y')
  })
  t.end()
})

test('update stores private fields', function (t) {
  var updater = update({prefix: '-webkit-', options: { height: 100 }})
  var nodes = d3.select('ul.nodes-container').selectAll('li')
  nodes.call(updater)

  nodes.each(function (d, i) {
    t.equal(d._x, d.y, '_x is equal to original y')
    t.equal(d._y, i * 100, '_y is equal to index * height')
  })

  nodes.data([{y: 10}, {y: 20}, {y: 30}]).call(updater)

  nodes.each(function (d, i) {
    t.equal(d._x, d.y, '_x is equal to original y')
    t.equal(d._y, i * 100, '_y is equal to index * height')
  })
  t.end()
})

test('teardown', function (t) {
  d3.select('ul.nodes-container').remove()
  t.end()
})
