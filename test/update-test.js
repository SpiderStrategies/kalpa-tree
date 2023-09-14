import { test } from 'tape'
import * as d3 from 'd3-selection'
import update from '../lib/update.js'
import contents from '../lib/contents.js'

test('setup', function (t) {
  d3.select(document.body)
    .append('ul')
      .attr('class', 'nodes-container')
    .selectAll('li')
      .data([{y: 1, _y: 0 * 10, _x: 1}, {y: 2, _y: 1 * 10, _x: 2}, {y: 3, _y: 2 * 10, _x: 3}])
      .enter()
        .append('li')
        .append('div')
          .attr('class', 'node-contents')
          .text(function (d) { return d.y })
  t.end()
})

test('update adjusts node styles', function (t) {
  var updater = update({
      prefix: '-webkit-',
      _onToggle: Function.prototype,
      nodes: [[]],
      _rtlTransformX: x => x, // mock an identity function
      options: {
        transientId: -1,
        height: 10,
        label: function () {
          // filler
        },
        indentableSelector: ':first-child',
        contents,
        accessors: {
          id: 'id'
        }
      },
      el: {
        select: function () {
          return {
            classed: function (clazz, value) {
              t.equal(clazz, 'has-transient', 'setting has-transient class')
              t.ok(!value, 'has-transient is false')
              return this
            }
          }
        }
      }
    })
    , nodes = d3.select('ul.nodes-container').selectAll('li')

  nodes.call(updater)

  nodes.each(function (d, i) {
    var node = d3.select(this)
    t.equal(node.style('opacity'), '1', 'opacity set to 1')
    t.equal(node.style('-webkit-transform'), 'translate(0px, ' + (i * 10) + 'px)', 'transform y based on index height')
    t.equal(node.select('.node-contents').style('-webkit-transform'), 'translate(' + (i + 1) + 'px, 0px)', 'node contents x transform based on original y')
  })
  t.end()
})

test('teardown', function (t) {
  d3.select('ul.nodes-container').remove()
  t.end()
})
