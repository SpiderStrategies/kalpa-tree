import { test } from 'tape'
import Tree from '../'
import css from './../dist/tree.css'
import stream from './tree-stream'
import Dnd from '../lib/dnd'
import event from './event'
import * as d3 from 'd3-selection'

document.head.innerHTML = `<style>${css}</style>`

function before (next, opts) {
  opts = opts || {
    stream: stream(),
    dndDelay: 0 // Don't delay tests by default
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
    next(tree, dnd)
  })
}

test('fires dnd events', function (t) {
  t.plan(15)
  before(function (tree, dnd) {
    tree.editable()
    var calls = 0

    tree.on('dndstart', function (eventData) {
      t.pass('dndstart fired')
      t.deepEqual(eventData.el, tree.node.nodes()[3], 'dndstart eventData contains moving dom node')
      t.deepEqual(eventData.traveler, dnd.traveler.node(), 'dndstart eventData contains the traveling node')
      t.deepEqual(eventData.layout, tree._layout[1004], 'dndstart eventData contains moving node data')
      t.deepEqual(eventData.data, tree.nodes[1004], 'dndstart eventData contains the bound node data')
    })
    tree.on('dndmove', function (eventData) {
      t.pass('dndmove fired')
      t.deepEqual(eventData.traveler, dnd.traveler.node(), 'dndmove eventData contains the traveling node')
      t.deepEqual(eventData.layout, tree._layout[1004], 'dndmove eventData contains moving node data')
      t.deepEqual(eventData.data, tree.nodes[1004], 'dndmove eventData contains the bound node data')
    })
    tree.on('dndcancel', function () {
      t.pass('dndcancel fired')
    })
    tree.on('dndstop', function (eventData) {
      t.pass('dndstop fired')
      t.deepEqual(eventData.el, tree.node.nodes()[3], 'dndstop eventData contains moving dom node')
      t.deepEqual(eventData.traveler, dnd.traveler.node(), 'dndstop eventData contains the traveling node')
      t.deepEqual(eventData.layout, tree._layout[1004], 'dndstop eventData contains moving node data')
      t.deepEqual(eventData.data, tree.nodes[1004], 'dndstop eventData contains the bound node data')
    })
    let e1 = event('mouse')
    dnd.start.apply(tree.node.nodes()[3], [e1, tree._layout[1004], 3])
    dnd._dragging = true

    let e2 = event('mouse')
    e2.y = tree._layout[1004]._y + 20 // new y location
    dnd.drag.apply(tree.node.nodes()[3], [e2, tree._layout[1004], 3])

    let e3 = event('keydown')
    e3.keyCode = 27
    dnd._escape( tree.node.nodes()[3], e3)
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('drag does not work if start is not called', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.drag({y: 0})
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('dndDelay option prevents dnd if mousedown + mouseup fires too quickly', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]
      , originalParent = data.parent.id
      , originalIndex = data.parent._allChildren.indexOf(data)

    tree.editable()
    let e1 = event('mouse')
    dnd.start.apply(node, [e1, data, 3])

    let e2 = event('mouse')
    e2.y = 290

    dnd.drag.apply(node, [e2, data, 3])

    tree.on('move', function () {
      t.fail('move should not have been called')
    })

    let e3 = event('mouse')
    dnd.end.apply(node, [e3, data, 3])

    t.equal(data.parent.id, originalParent, 'original parent equal new parent')
    t.equal(data.parent._allChildren.indexOf(data), originalIndex, 'original index equal new index')

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  }, {
    stream: stream()
  })
})

test('dnd dependent on edit mode', function (t) {
  before(function (tree, dnd) {
    t.ok(!dnd._dragging, 'tree not marked as dragging')
    dnd.start()
    t.ok(!dnd._dragging, 'tree still not marked as dragging')
    t.notOk(dnd._travelerTimeout, 'traveler timeout not created')
    tree.editable()
    dnd.start(event('mouse'), {y: 100})
    t.ok(dnd._travelerTimeout, 'created the traveler timeout, so dnd will be starting')
    clearTimeout(dnd._travelerTimeout)

    dnd._end()
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('dnd prevented if displaying filtered results', function (t) {
  before(function (tree, dnd) {
    tree.search('M')
    tree.editable()
    t.notOk(dnd._travelerTimeout, 'tree traveler timeout not created (not dragging)')
    dnd.start(event('mouse'), {y: 100})
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
    dnd.start(event('mouse'), {y: 0})
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
    dnd.start.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])
    t.ok(dnd._travelerTimeout, 'timeout exists')
    dnd.end.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])
    t.notOk(dnd._travelerTimeout, 'timeout does not exist')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('creates a traveler after timeout', function (t) {
  before(function (tree, dnd) {
    tree.editable()

    // Give 1004 an extra classname so we can test if the traveler inherits that class
    tree.edit({id: 1004, className: 'foo'})

    dnd.start.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])
    setTimeout(function () {
      var traveler = tree.el.select('.traveling-node')
        , src = d3.select(tree.node.nodes()[3])

      t.ok(traveler.size(), 1, 'traveling node exists as a sibling')
      t.ok(traveler.classed('selected'), 'traveler node is marked `selected`')
      t.ok(traveler.classed('foo'), 'placeholder inherits src node classnames')
      t.ok(src.classed('placeholder'), 'original node is denoted as placeholder')
      t.equal(traveler.attr('style'), 'transform: translate(0px, 108px);', 'traveler uses original node position')
      t.equal(traveler.select('.node-contents').attr('style'), src.select('.node-contents').attr('style'), 'node-contents share style')
      t.equal(traveler.select('.node-contents .label').text(), src.select('.node-contents .label').text(), 'labels match')

      var travelerData = traveler.datum()
      t.equal(travelerData._initialParent, 1003, 'stores initial parent on the traveler')
      t.deepEqual(travelerData._source, tree._layout[1004], 'stores source node on the travler')
      t.deepEqual(travelerData.embedded, false, 'embedded is false by default')
      dnd.end.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    }, 400)
  })
})

test('creates a traveler on first drag ', function (t) {
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])
    dnd._dragging = true
    t.ok(dnd._travelerTimeout, 'timeout was set')
    let e1 = event('mouse')
    e1.y = tree._layout[1004]._y + 20// new y location
    dnd.drag.apply(tree.node.nodes()[3], [e1, tree._layout[1004], 3])
    t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
    t.ok(!dnd._travelerTimeout, 'timeout was cleared')
    t.ok(tree.el.select('.traveling-node').size(), 1, 'traveling node exists as a sibling')
    dnd.end.apply(tree.node.nodes()[3], [e1, tree._layout[1004], 3])
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
      dnd.start.apply(node, [event('mouse'), data, 3])
      dnd._dragging = true
      t.ok(dnd._travelerTimeout, 'timeout was set')

      let e1 = event('mouse')
      e1.y = data._y
      dnd.drag.apply(node, [e1, data, 3])
      t.equal(tree.el.select('.traveling-node').datum()._y, data._y - tree.options.height / 2, 'traveler _y starts centered on the the src')
      e1.y = data._y + 200// new y location
      dnd.drag.apply(node, [e1, data, 3])
      t.ok(tree.el.select('.traveling-node').datum()._y > data._y, 'traveler _y moved down')
      var _translate = /translate\((.*)\)/.exec(tree.el.select('.traveling-node').attr('style'))[0]
      t.equal(_translate, 'translate(0px, 290px)', 'transform changed')
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(60px, 0px); width: calc(100% - 60px)', '60px y indentation')
      e1.y = 290 // move the node up a little
      dnd.drag.apply(node, [e1, data, 3])

      // now it should be embedded
      t.equal(tree.el.select('.traveling-node').select('.node-contents').attr('style'), tree.prefix + 'transform:translate(80px, 0px); width: calc(100% - 80px)', '80px y indentation')
      dnd.end.apply(node, [e1, data, 3])
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
  })
})

test('drag moves traveler in RTL mode', function (t) {
  function rtlBefore(next) {
    let opts = {
      stream: stream(),
      dndDelay: 0 // Don't delay tests by default
    }

    // Set the document's direction to RTL
    document.documentElement.setAttribute('dir', 'rtl')

    var rtlTree = new Tree(opts).render(),
        rtlTreeDnd = new Dnd(rtlTree),
        container = document.createElement('div')

    container.className = 'rtl-container'
    container.style.height = '700px'
    document.body.appendChild(container)

    container.appendChild(rtlTree.el.node())

    opts.stream.on('end', function () {
      rtlTree.select(1004) // Ensure it's expanded
      next(rtlTree, rtlTreeDnd) // Continue after tree is ready
    })
  }

  rtlBefore(function (rtlTree, rtlTreeDnd) {
    var node = rtlTree.node.nodes()[3],
        data = rtlTree._layout[1004]

    rtlTree.editable()

    process.nextTick(function () {
      rtlTreeDnd.start.apply(node, [event('mouse'), data, 3])
      rtlTreeDnd._dragging = true
      t.ok(rtlTreeDnd._travelerTimeout, 'timeout was set')

      let e1 = event('mouse')
      e1.y = data._y
      rtlTreeDnd.drag.apply(node, [e1, data, 3])
      t.equal(rtlTree.el.select('.traveling-node').datum()._y, data._y - rtlTree.options.height / 2, 'traveler _y starts centered on the src')

      e1.y = data._y + 200 // new y location
      rtlTreeDnd.drag.apply(node, [e1, data, 3])
      t.ok(rtlTree.el.select('.traveling-node').datum()._y > data._y, 'traveler _y moved down')

      var _translate = /translate\((.*)\)/.exec(rtlTree.el.select('.traveling-node').attr('style'))[0]
      t.equal(_translate, 'translate(0px, 290px)', 'transform changed')

      // Check the RTL-specific transform
      t.equal(rtlTree.el.select('.traveling-node').select('.node-contents').attr('style'), rtlTree.prefix + 'transform:translate(-60px, 0px); width: calc(100% - 60px)', '60px y indentation for RTL')

      e1.y = 290 // move the node up a little
      rtlTreeDnd.drag.apply(node, [e1, data, 3])

      // now it should be embedded
      t.equal(rtlTree.el.select('.traveling-node').select('.node-contents').attr('style'), rtlTree.prefix + 'transform:translate(-80px, 0px); width: calc(100% - 80px)', '80px y indentation for RTL')

      rtlTreeDnd.end.apply(node, [e1, data, 3])
      rtlTree.remove()

      // Cleanup: remove RTL setting and container
      document.documentElement.removeAttribute('dir')
      document.querySelector('.rtl-container').remove()

      t.end()
    })
  })
})

test('drag changes data', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]

    tree.editable()
    dnd.start.apply(node, [event('mouse'), data, 3])
    dnd._dragging = true

    let e1 = event('mouse')
    e1.y = 290

    t.equal(tree.nodes[1004].parentId, 1003, 'original node parentId set')
    dnd.drag.apply(node, [e1, data, 3])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(n.label, 'M1', 'moved node label is correct')
      t.equal(newParent.label, 'M5', 'moved node new parent label is correct')
      t.equal(previousParent.label, 'O1', 'moved node previous parent label is correct')
      t.equal(tree.nodes[1004].parentId, newParent.id, 'source node parentId has changed')
      t.equal(newIndex, 0, 'new index is correct')
      t.equal(previousIndex, 0, 'previous index is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(node, [e1, data, 3])
  })
})

test('escape keypress cancels dnd', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1004]
      , originalParent = data.parent.id
      , originalIndex = data.parent._allChildren.indexOf(data)

    tree.editable()
    dnd.start.apply(node, [event('mouse'), data, 3])
    dnd._dragging = true

    let e1 = event('mouse')
    e1.y = 290
    dnd.drag.apply(node, [e1, data, 3])

    let e2 = event('mouse')
    e2.keyCode = 27
    dnd._escape(null, e2)

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
    dnd.start.apply(tree.node.nodes()[3], [event('mouse'), tree._layout[1004], 3])

    setTimeout(function() {
      dnd._dragging = true
      let e1 = event('mouse')
      e1.y = tree._layout[1004]._y + 20// new y location
      keypress()
      dnd.drag.apply(tree.node.nodes()[3], [e1, tree._layout[1004], 3])
      t.ok(tree.el.select('.tree').classed('dragging', true), 'tree has dragging class')
      dnd.end.apply(tree.node.nodes()[3], [e1, tree._layout[1004], 3])
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
      dnd.start.apply(node, [event('mouse'), data, 3])
      dnd._dragging = true
      let e1 = event('mouse')
      e1.y = data._y
      dnd.drag.apply(node, [e1, data, 3])
      // t.equal(tree.el.select('.traveling-node').datum()._y, data._y - tree.options.height / 2, 'traveler _y starts centered on the the src')
      t.equal(tree.el.select('.tree').node().scrollTop, 0, 'tree is at the top')
      e1.y = 10000 // Way towards the bottom
      dnd.drag.apply(node, [e1, data, 3])

      t.ok(dnd._autoscrollTimeout, 'autoscroll timeout set')
      setTimeout(function () {
        // By the time this fired, the autoScroll should have increased
        t.ok(tree.el.select('.tree').node().scrollTop > 100, 'tree scrolled down')
        var _translate = /translate\((.*)\)/.exec(tree.el.select('.traveling-node').attr('style'))[0]
        t.equal(_translate, 'translate(0px, 214px)', 'traveling node moved down')
        dnd.end.apply(node, [e1, data, 3])
        tree.remove()
        document.querySelector('.container').remove()
        t.end()
      }, 500)

    })
  })
})

test('`movable` allows control to prevent if a node can be dnd\d', function (t) {
  t.plan(3)
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1058]
      , that = null

    tree.options.movable = function (d, parent) {
      that = this // save to test later
      return d.nodeType !== 'metric'
    }

    tree.editable()

    t.equal(tree.el.selectAll('.node').size(), 18, '18 nodes')
    t.equal(tree.el.selectAll('.node.movable').size(), 8, '8 movable nodes')
    t.equal(that, tree, 'movable `this` (our that) is bound to the tree')

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('droppable call node has original state', function (t) {
  t.plan(1)
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1058]
      , that = null

    tree.options.droppable = function (d, parent) {
      t.deepEqual(d.beforeDragState, { index: 1, parent: 1001 }, 'before drag state stored')
      return true
    }

    tree.editable()
    dnd.start.apply(node, [event('mouse'), data, 3])
    dnd._dragging = true

    let e1 = event('mouse')
    e1.y = 290
    dnd.drag.apply(node, [e1, data, 3])
    dnd.end.apply(node, [e1, data, 3])

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('restores tree if dropped illegally', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1058]
      , that = null

    tree.options.droppable = function (d, parent) {
      return false
    }

    t.equal(data._x, tree._layout[1058]._x, '1058 is a sibling of 1008')

    tree.editable()
    dnd.start.apply(node, [event('mouse'), data, 3])
    dnd._dragging = true
    let e1 = event('mouse')
    e1.y = 290
    dnd.drag.apply(node, [e1, data, 3])
    dnd.end.apply(node, [e1, data, 3])

    t.equal(data._x, tree._layout[1058]._x, '1058 is still a sibling of 1008')

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.fail('should not fire move')
    })

    tree.remove()
    document.querySelector('.container').remove()
    t.end()

  })
})

test('disable non-metrics dropped onto metrics', function (t) {
  before(function (tree, dnd) {
    var node = tree.node.nodes()[3]
      , data = tree._layout[1058]
      , that = null

    tree.options.droppable = function (d, parent) {
      that = this
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
    dnd.start.apply(node, [event('mouse'), data, 3])
    dnd._dragging = true
    let e1 = event('mouse')
    e1.y = 290 // This would move 1058 onto 1008 which is a metric
    dnd.drag.apply(node, [e1, data, 3])

    t.equal(that, tree, 'droppable this is the tree')
    t.equal(data._x, tree._layout[1008]._x, '1058 is a sibling of 1008')

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'O1', 'moved node new parent label is correct')
      t.equal(newIndex, 5, 'new index is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(node, [e1, data, 3])
  })
})

test('moves a node below root, when root is detached', function (t) {
  before(function (tree, dnd) {

    tree.editable()
    // Move 1005 under 1004
    var m2 = tree.node.nodes()[4]
      , m2d = tree._layout[1005]

    dnd.start.apply(m2, [event('mouse'), m2d, 4])
    dnd._dragging = true

    let e1 = event('mouse')
    e1.y = 5
    dnd.drag.apply(m2, [e1, m2d, 4])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'Huge Scorecard', 'moved node new parent label is correct')
      tree.remove()
      document.querySelector('.container').remove()
      t.end()
    })
    dnd.end.apply(m2, [e1, m2d, 4])
  }, {
    stream: stream(),
    rootHeight: 36,
    dndDelay: 0
  })
})

test('allows a traveler to be illegal near the root node', function (t) {
  before(function (tree, dnd) {
    tree.options.droppable = function () {
      return false
    }

    tree.editable()

    var m2 = tree.node.nodes()[4]
      , m2d = tree._layout[1005]

    dnd.start.apply(m2, [event('mouse'), m2d, 4])
    dnd._dragging = true
    let e1 = event('mouse')
    e1.y = -50
    dnd.drag.apply(m2, [e1, m2d, 4])

    t.ok(dnd.traveler.datum().illegal, 'traveler is illegal')
    t.ok(dnd.traveler.classed('illegal'), 'traveler has illegal classname')

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})

test('marks traveler as illegal if dropping onto a transient node', function (t) {
  t.plan(1)
  before(function (tree, dnd) {
    tree.editable()

    var _t = tree.addTransient({
      label: 'New transient',
      color: 'green',
      nodeType: 'metric'
    }, 1003)

    tree.options.droppable = function () {
      // This will only be called once, because the first time the illegal check fires, it will return true bc
      // we're dropping onto a transient node
      t.pass('droppable called')
      return true
    }

    var m2 = tree.node.nodes()[10]
      , m2d = tree._layout[1013]

    dnd.start.apply(m2, [event('mouse'), m2d, 10])
    dnd._dragging = true
    let e1 = event('mouse')
    e1.y = 475
    dnd.drag.apply(m2, [e1, m2d, 10])
    dnd.end.apply(m2, [e1, m2d, 4])

    tree.remove()
    document.querySelector('.container').remove()
    t.end()
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

    dnd.start.apply(m2, [event('mouse'), m2d, 4])
    dnd._dragging = true
    let e1 = event('mouse')
    e1.y = 150
    dnd.drag.apply(m2, [e1, m2d, 4])

    tree.once('move', function (n, newParent, previousParent, newIndex, previousIndex) {
      t.equal(newParent.label, 'M1', 'moved node new parent label is correct')

      process.nextTick(function () {
        // Now move 1006 under 1005
        var m3 = tree.node.nodes()[5]
          , m3d = tree._layout[1006]

        dnd.start.apply(m3, [event('mouse'), m3d, 5])
        dnd._dragging = true

        let e2 = event('mouse')
        e2.y = 190
        dnd.drag.apply(m3, [e2, m3d, 5])

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

            dnd.start.apply(nonMetric, [event('mouse'), nonMetricData, 17])
            dnd._dragging = true
            let e3 = event('mouse')
            e3.y = 190
            dnd.drag.apply(nonMetric, [e3, nonMetricData, 17])

            t.ok(dnd.traveler.datum().illegal, 'traveler is illegal')
            t.ok(dnd.traveler.classed('illegal'), 'traveler has illegal classname')

            dnd.end.apply(nonMetric, [event('mouse'), nonMetricData, 17])
            t.equal(nonMetricData.parent.id, 1001, 'back to root parent')
            tree.remove()
            document.querySelector('.container').remove()
            t.end()
          })
        })
        dnd.end.apply(m3, [event('mouse'), m3d, 5])
      })

    })
    dnd.end.apply(m2, [event('mouse'), m2d, 4])
  })
})

test('multiple moves with embedded traveler if target node equals the previous node', function (t) {
  // See issue #252
  before(function (tree, dnd) {
    tree.editable()
    dnd.start.apply(tree.node.nodes()[4], [event('mouse'), tree._layout[1005], 4])
    dnd._dragging = true

    var moves = [102,119]
    moves.forEach(function (pos) {
      let e = event('mouse')
      e.y = pos
      dnd.drag.apply(tree.node.nodes()[4], [e, tree._layout[1005], 4])
    })

    // now it should be embedded
    t.ok(dnd.traveler.datum().embedded, 'the traveler is embedded')
    t.equal(tree._layout[1005]._y, 108, '1005 is the first child, at 108')
    tree.remove()
    document.querySelector('.container').remove()
    t.end()
  })
})
