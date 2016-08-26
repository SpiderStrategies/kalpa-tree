var test = require('tape').test
  , Tree = require('../')
  , stream = require('./tree-stream')

test('allows transient nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  t.equal(tree.options.transientId, -1, '-1 transientId by default')

  s.on('end', function () {
    tree.expandAll()

    t.ok(!tree.el.select('.tree').classed('has-transient'), 'tree does not have has-transient class')
    var _t = tree.addTransient({
      label: 'New transient',
      color: 'green',
      nodeType: 'metric'
    }, 1003)

    t.ok(tree.el.select('.tree').classed('has-transient'), 'tree has has-transient class')
    t.equal(tree.getTransient().label, 'New transient', 'getTransient returns transient node')
    t.deepEqual(tree._layout[tree.options.transientId].parent, tree._layout[1003], 'transient node\'s parent is correct')
    t.equal(tree.el.select('.tree ul li.transient').size(), 1, 'transient node in the dom')
    t.equal(tree.el.select('.tree ul li.transient').datum().id, tree.options.transientId, 'transient id stored')
    t.equal(tree.el.select('.tree ul li.transient .label').text(), 'New transient', 'correct transient node label')

    tree.editTransient({
      label: 'Foobar'
    })
    t.ok(tree.el.select('.tree').classed('has-transient'), 'tree has has-transient class')
    t.equal(tree.el.select('.tree ul li.transient .label').text(), 'Foobar', 'transient label changed')

    tree.moveTransient(_t, 1058)
    t.deepEqual(tree._layout[tree.options.transientId].parent, tree._layout[1058], 'transient node\'s has new parent')

    tree.removeTransient()
    t.ok(!tree.el.select('.tree').classed('has-transient'), 'tree does not have has-transient class')

    // wait for transitions
    setTimeout(function () {
      // add a new transient
      tree.addTransient({
        label: 'New transient',
        color: 'green',
        nodeType: 'metric'
      }, 1003)
      t.equal(tree.el.select('.tree ul li.transient').size(), 1, 'have another transient')
      t.ok(tree.el.select('.tree').classed('has-transient'), 'tree has has-transient class')
      tree.saveTransient(20100)
      t.ok(!tree.el.select('.tree').classed('has-transient'), 'tree does not have has-transient class')

      // wait for transitions
      setTimeout(function () {
        t.equal(tree.el.select('.tree ul li.transient').size(), 0, 'transient removed')
        var persisted = tree.el.select('.tree ul li.node[data-id="20100"]')
        t.equal(persisted.datum().id, 20100, 'persisted 20100')
        tree.el.remove()
        t.end()
      }, 300)
    }, 300)
  })
})
