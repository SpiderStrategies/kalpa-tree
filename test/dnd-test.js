var test = require('tape').test
  , Tree = require('../')
  , stream = require('./tree-stream')
  , Dnd = require('../lib/dnd')

function before (next) {
  var tree = new Tree({stream: stream()}).render()
    , dnd = new Dnd(tree)
  tree.select(1004) // so it's expanded
  // Mock d3.event
  d3.event = new Event
  d3.event.sourceEvent = new Event
  next(tree, dnd)
}

test('drag does not work if start is not called', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.drag()
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    tree.remove()
    t.end()
  })
})

test('dnd dependent on edit mode', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.start()
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    tree.editable()
    dnd.start({y: 0}) // set y to zero to prevent dragging
    t.ok(dnd._dragging, 'tree marked as dragging')
    tree.remove()
    t.end()
  })
})

test('start followed by end will clear timeout', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(dnd.timeout, 'timeout exists')
    dnd.end.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(dnd.timeout, 'timeout does not exists')
    tree.remove()
    t.end()
  })
})

test('creates a traveler after timeout', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node[0][3], [tree._layout[1004], 3])
    setTimeout(function () {
      var traveler = tree.el.select('.traveling-node')
        , src = d3.select(tree.node[0][3])
      t.ok(traveler.size(), 1, 'traveling node exists as a sibling')
      t.ok(src.classed('placeholder'), 'original node is denoted as placeholder')
      t.equal(traveler.attr('style'), src.attr('style'), 'traveler uses original node style')
      t.equal(traveler.select('.node-contents').attr('style'), src.select('.node-contents').attr('style'), 'node-contents share style')
      t.equal(traveler.select('.node-contents .label').text(), src.select('.node-contents .label').text(), 'labels match')

      var travelerData = traveler.datum()
      t.equal(travelerData._initialParent, 1003, 'stores initial parent on the traveler')
      t.deepEqual(travelerData._source, tree._layout[1004], 'stores source node on the travler')
      t.deepEqual(travelerData.i, 3, 'sets i')
      t.deepEqual(travelerData.embedded, false, 'embedded is false by default')
      dnd.end.apply(tree.node[0][3], [tree._layout[1004], 3])
      tree.remove()
      t.end()
    }, 400)
  })
})

test('creates a traveler on first drag ', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(dnd.timeout, 'timeout was set')
    d3.event.y = tree._layout[1004]._y + 20// new y location
    dnd.drag.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
    t.ok(!dnd.timeout, 'timeout was cleared')
    t.ok(tree.el.select('.traveling-node').size(), 1, 'traveling node exists as a sibling')
    dnd.end.apply(tree.node[0][3], [tree._layout[1004], 3])
    tree.remove()
    t.end()
  })
})

test('drag moves traveler', function (t) {
  before(function (tree, dnd) {
    var node = tree.node[0][3]
      , data = tree._layout[1004]
    tree.editable()
    process.nextTick(function () {
      dnd.start.apply(node, [data, 3])
      t.ok(dnd.timeout, 'timeout was set')
      d3.event.y = data._y
      dnd.drag.apply(node, [data, 3])
      t.equal(tree.el.select('.traveling-node').datum()._y, data._y - tree.options.height / 2, 'traveler _y starts centered on the the src')
      d3.event.y = data._y + 200// new y location
      dnd.drag.apply(node, [data, 3])
      process.nextTick(function () {})
      t.ok(tree.el.select('.traveling-node').datum()._y > data._y, 'traveler _y moved down')
      t.equal(tree.el.select('.traveling-node').datum().i, 8, 'moved down nodes')
      t.equal(tree.el.select('.traveling-node').attr('style'), tree.prefix + 'transform: translate(0px, 290px); opacity: 1;', 'transform changed')
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(60px,0px)', '60px y indentation')
      d3.event.y = 290 // move the node up a little
      dnd.drag.apply(node, [data, 3])

      // now it should be embedded
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(80px,0px)', '80px y indentation')
      dnd.end.apply(node, [data, 3])
      tree.remove()
      t.end()
    })
  })
})

test('drag changes data', function (t) {
  before(function (tree, dnd) {
    var node = tree.node[0][3]
      , data = tree._layout[1004]

    tree.editable()
    dnd.start.apply(node, [data, 3])
    d3.event.y = 290
    dnd.drag.apply(node, [data, 3])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(n.label, 'M1', 'moved node label is correct')
      t.equal(newParent.label, 'M5', 'moved node new parent label is correct')
      t.equal(previousParent.label, 'O1', 'moved node previous parent label is correct')
      t.equal(newIndex, 0, 'new index is correct')
      t.equal(previousIndex, 0, 'previous index is correct')
      tree.remove()
      t.end()
    })
    dnd.end.apply(node, [data, 3])
  })
})

test('escape keypress cancels dnd', function (t) {
  before(function (tree, dnd) {
    var node = tree.node[0][3]
      , data = tree._layout[1004]
      , originalParent = data.parent.id
      , originalIndex = data.parent._allChildren.indexOf(data)

    tree.editable()
    dnd.start.apply(node, [data, 3])
    d3.event.y = 290
    dnd.drag.apply(node, [data, 3])

    d3.event.keyCode = 27
    dnd._escape()

    tree.on('move', function () {
      t.fail('move should not have been called')
    })

    t.equal(data.parent.id, originalParent, 'original parent equal new parent')
    t.equal(data.parent._allChildren.indexOf(data), originalIndex, 'original index equal new index')

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
    dnd.start.apply(tree.node[0][3], [tree._layout[1004], 3])
    d3.event.y = tree._layout[1004]._y + 20// new y location
    keypress()
    dnd.drag.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
    dnd.end.apply(tree.node[0][3], [tree._layout[1004], 3])
    t.ok(tree.el.select('.tree').classed('dragging', true), 'tree not longer has dragging class')
    keypress()

    t.equal(escapeCalls, 1, 'end removes keydown listener')
    t.equal(tree.el.select('.traveling-node').size(), 0, 'traveling node is out of the dom')
    t.ok(!dnd.traveler, 'traveler is null')
    tree.remove()
    t.end()
  })
})
