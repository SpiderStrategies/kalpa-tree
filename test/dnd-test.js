var test = require('tape').test
  , Tree = require('../')
  , css = require('./../dist/tree.css')
  , stream = require('./tree-stream')
  , Dnd = require('../lib/dnd')
  , Event = require('./_event')
  , d3 = require('d3-selection')

function before (next, opts) {
  opts = opts || {
    stream: stream()
  }

  var tree = new Tree(opts).render()
    , dnd = new Dnd(tree)
    , container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  document.body.appendChild(container)
  container.appendChild(tree.el.node())

  opts.stream.on('end', function () {
    tree.select(1004) // so it's expanded
    // Mock d3.event
    d3.event = new Event
    d3.event.sourceEvent = new Event
    d3.event.sourceEvent.type = 'mouse'
    d3.event.sourceEvent.which = 1
    next(tree, dnd)
  })
}

test('fires dnd events', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    var calls = 0
    tree.on('dndstart', function () {
      calls++
    })
    tree.on('dndcancel', function () {
      calls++
    })
    tree.on('dndstop', function () {
      calls++
    })
    dnd.start.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    dnd._dragging = true
    d3.event.y = tree._layout[1004]._y + 20// new y location
    dnd.drag.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    d3.event.keyCode = 27
    dnd._escape()
    tree.remove()
    document.querySelector('.container').remove()
    t.equal(calls, 3, 'all 3 events fired')
    t.end()
  })
})

test('drag does not work if start is not called', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.drag()
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('dnd dependent on edit mode', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.start()
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    t.notOk(dnd._travelerTimeout, 'traveler timeout not created')
    tree.editable()
    dnd.start({y: 100})
    t.ok(dnd._travelerTimeout, 'created the traveler timeout, so dnd will be starting')
    clearTimeout(dnd._travelerTimeout)

    dnd._end()
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('dnd prevented if displaying search results', function (t) {
  before(function (tree, dnd) {
    tree.search('M')
    tree.editable()
    t.notOk(dnd._travelerTimeout, 'tree traveler timeout not created (not dragging)')
    dnd.start({y: 100})
    t.notOk(dnd._travelerTimeout, 'tree traveler timeout still not created (not dragging)')
    dnd._end()
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('cannot move root', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start({y: 0})
    t.ok(!dnd._dragging, 'tree not marked as dragging because trying to move root')
    dnd._end()
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('start followed by end will clear timeout', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    t.ok(dnd._travelerTimeout, 'timeout exists')
    dnd.end.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    t.notOk(dnd._travelerTimeout, 'timeout does not exist')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('creates a traveler after timeout', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    setTimeout(function () {
      var traveler = tree.el.select('.traveling-node')
        , src = d3.select(tree.node.nodes()[3])
      t.ok(traveler.size(), 1, 'traveling node exists as a sibling')
      t.ok(src.classed('placeholder'), 'original node is denoted as placeholder')
      t.equal(traveler.attr('style'), 'transform: translate(0px, 108px);', 'traveler uses original node position')
      t.equal(traveler.select('.node-contents').attr('style'), src.select('.node-contents').attr('style'), 'node-contents share style')
      t.equal(traveler.select('.node-contents .label').text(), src.select('.node-contents .label').text(), 'labels match')

      var travelerData = traveler.datum()
      t.equal(travelerData._initialParent, 1003, 'stores initial parent on the traveler')
      t.deepEqual(travelerData._source, tree._layout[1004], 'stores source node on the travler')
      t.deepEqual(travelerData.embedded, false, 'embedded is false by default')
      dnd.end.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    }, 400)
  })
})

test('creates a traveler on first drag ', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    dnd._dragging = true
    t.ok(dnd._travelerTimeout, 'timeout was set')
    d3.event.y = tree._layout[1004]._y + 20// new y location
    dnd.drag.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
    t.ok(!dnd._travelerTimeout, 'timeout was cleared')
    t.ok(tree.el.select('.traveling-node').size(), 1, 'traveling node exists as a sibling')
    dnd.end.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('drag moves traveler', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]
    tree.editable()
    process.nextTick(function () {
      dnd.start.apply(node, [data, 3])
      dnd._dragging = true
      t.ok(dnd._travelerTimeout, 'timeout was set')
      d3.event.y = data._y
      dnd.drag.apply(node, [data, 3])
      t.equal(tree.el.select('.traveling-node').datum()._y, data._y - tree.options.height / 2, 'traveler _y starts centered on the the src')
      d3.event.y = data._y + 200// new y location
      dnd.drag.apply(node, [data, 3])
      t.ok(tree.el.select('.traveling-node').datum()._y > data._y, 'traveler _y moved down')
      var _translate = /translate\((.*)\)/.exec(tree.el.select('.traveling-node').attr('style'))[0]
      t.equal(_translate, 'translate(0px, 290px)', 'transform changed')
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(60px,0px)', '60px y indentation')
      d3.event.y = 290 // move the node up a little
      dnd.drag.apply(node, [data, 3])

      // now it should be embedded
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(80px,0px)', '80px y indentation')
      dnd.end.apply(node, [data, 3])
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
  })
})

test('drag changes data', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]

    tree.editable()
    dnd.start.apply(node, [data, 3])
    dnd._dragging = true
    d3.event.y = 290
    dnd.drag.apply(node, [data, 3])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(n.label, 'M1', 'moved node label is correct')
      t.equal(newParent.label, 'M5', 'moved node new parent label is correct')
      t.equal(previousParent.label, 'O1', 'moved node previous parent label is correct')
      t.equal(newIndex, 0, 'new index is correct')
      t.equal(previousIndex, 0, 'previous index is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(node, [data, 3])
  })
})

test('escape keypress cancels dnd', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]
      , originalParent = data.parent.id
      , originalIndex = data.parent._allChildren.indexOf(data)

    tree.editable()
    dnd.start.apply(node, [data, 3])
    dnd._dragging = true
    d3.event.y = 290
    dnd.drag.apply(node, [data, 3])

    d3.event.keyCode = 27
    dnd._escape()

    tree.on('move', function () {
      t.fail('move should not have been called')
    })

    t.equal(data.parent.id, originalParent, 'original parent equal new parent')
    t.equal(data.parent._allChildren.indexOf(data), originalIndex, 'original index equal new index')

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('end cleans up', function (t) {
  function keypress () {
    var keyEvent = document.createEvent('KeyboardEvent')
    keyEvent.initKeyboardEvent('keydown', true, false, null, 27, false, 27, false, 27, 27)
    window.dispatchEvent(keyEvent)
  }

  before(function (tree, dnd) {
    tree.editable()
    var escapeCalls = 0
    dnd._escape = function () {
      escapeCalls++
    }
    dnd.start.apply(tree.node.nodes()[3], [tree._layout[1004], 3])

    setTimeout(function() {
      dnd._dragging = true
      d3.event.y = tree._layout[1004]._y + 20// new y location
      keypress()
      dnd.drag.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
      t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
      dnd.end.apply(tree.node.nodes()[3], [tree._layout[1004], 3])
      t.ok(tree.el.select('.tree').classed('dragging', true), 'tree not longer has dragging class')
      keypress()

      t.equal(escapeCalls, 1, 'end removes keydown listener')
      t.equal(tree.el.select('.traveling-node').size(), 0, 'traveling node is out of the dom')
      t.ok(!dnd.traveler, 'traveler is null')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    }, 400)
  })
})

test('dnd autoscrolls', function (t) {
  before(function (tree, dnd) {
    document.querySelector('.container').style.height = '250px'

    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]
    tree.editable()
    tree.expandAll()

    process.nextTick(function () {
      dnd.start.apply(node, [data, 3])
      dnd._dragging = true
      d3.event.y = data._y
      dnd.drag.apply(node, [data, 3])
      // t.equal(tree.el.select('.traveling-node').datum()._y, data._y - tree.options.height / 2, 'traveler _y starts centered on the the src')
      t.equal(tree.el.select('.tree').node().scrollTop, 0, 'tree is at the top')
      d3.event.y = 10000 // Way towards the bottom
      dnd.drag.apply(node, [data, 3])

      t.ok(dnd._autoscrollTimeout, 'autoscroll timeout set')
      setTimeout(function () {
        // By the time this fired, the autoScroll should have increased
        t.ok(tree.el.select('.tree').node().scrollTop > 100, 'tree scrolled down')
        var _translate = /translate\((.*)\)/.exec(tree.el.select('.traveling-node').attr('style'))[0]
        t.equal(_translate, 'translate(0px, 214px)', 'traveling node moved down')
        dnd.end.apply(node, [data, 3])
        tree.remove()
        document.querySelector('.container').remove()
        t.end()
      }, 500)

    })
  })
})

test('disable non-metrics dropped onto metrics', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1058]

    tree.options.droppable = function (d, parent) {
      if (d.nodeType === 'metric') {
        // Metrics can go anywhere
        return true
      } else if (parent.nodeType === 'metric') {
        // Can't move a non-metric onto a metric
        return false
      } else {
        return true
      }
    }

    tree.editable()
    dnd.start.apply(node, [data, 3])
    dnd._dragging = true
    d3.event.y = 290 // This would move 1058 onto 1008 which is a metric
    dnd.drag.apply(node, [data, 3])

    t.equal(data._x, tree._layout[1008]._x, '1058 is a sibling of 1008')

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'O1', 'moved node new parent label is correct')
      t.equal(newIndex, 5, 'new index is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(node, [data, 3])
  })
})

test('moves a node below root, when root is detached', function (t) {
  before(function (tree, dnd) {

    tree.editable()
    // Move 1005 under 1004
    var m2 = tree.node.nodes()[4]
      , m2d = tree._layout[1005]

    dnd.start.apply(m2, [m2d, 4])
    dnd._dragging = true
    d3.event.y = 5
    dnd.drag.apply(m2, [m2d, 4])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'Huge Scorecard', 'moved node new parent label is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(m2, [m2d, 4])
  }, {
    stream: stream(),
    rootHeight: 36
  })
})

test('marks traveler as illegal if its too deep', function (t) {
  before(function (tree, dnd) {
    tree.options.droppable = function (d, parent) {
      if (d.nodeType === 'metric') {
        // Metrics can go anywhere
        return true
      } else if (parent.nodeType === 'metric') {
        // Can't move a non-metric onto a metric
        return false
      } else {
        return true
      }
    }

    tree.editable()
    // Move 1005 under 1004
    var m2 = tree.node.nodes()[4]
      , m2d = tree._layout[1005]

    dnd.start.apply(m2, [m2d, 4])
    dnd._dragging = true
    d3.event.y = 150
    dnd.drag.apply(m2, [m2d, 4])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'M1', 'moved node new parent label is correct')

      process.nextTick(function () {
        // Now move 1006 under 1005
        var m3 = tree.node.nodes()[5]
          , m3d = tree._layout[1006]

        dnd.start.apply(m3, [m3d, 5])
        dnd._dragging = true
        d3.event.y = 190
        dnd.drag.apply(m3, [m3d, 5])

        tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
          t.equal(newParent.label, 'M2', 'M3 moved node new parent label is correct')

          // Now we have
          //...
          //  m1
          //    m2
          //      m3
          //  m4
          //...
          // Grab a non metric (i.e. 1058) and try to throw it under M3
          process.nextTick(function () {
            // Now move 1006 under 1005
            var nonMetric = tree.node.nodes()[17]
              , nonMetricData = tree._layout[1058]

            dnd.start.apply(nonMetric, [nonMetricData, 17])
            dnd._dragging = true
            d3.event.y = 190
            dnd.drag.apply(nonMetric, [nonMetricData, 17])

            t.ok(dnd.traveler.datum().illegal, 'traveler is illegal')
            t.ok(dnd.traveler.classed('illegal'), 'traveler has illegal classname')

            dnd.end.apply(nonMetric, [nonMetricData, 17])
            t.equal(nonMetricData.parent.id, 1001, 'back to root parent')
            tree.remove()
            document.querySelector('.container').remove()
            t.end()
          })
        })
        dnd.end.apply(m3, [m3d, 5])
      })

    })
    dnd.end.apply(m2, [m2d, 4])
  })
})

test('multiple moves with embedded traveler if target node equals the previous node', function (t) {
  // See issue #252
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[4], [tree._layout[1005], 4])
    dnd._dragging = true

    var moves = [102,119]
    moves.forEach(function (pos) {
      d3.event.y = pos
      dnd.drag.apply(tree.node.nodes()[4], [tree._layout[1005], 4])
    })

    // now it should be embedded
    t.ok(dnd.traveler.datum().embedded, 'the traveler is embedded')
    t.equal(tree._layout[1005]._y, 108, '1005 is the first child, at 108')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})
