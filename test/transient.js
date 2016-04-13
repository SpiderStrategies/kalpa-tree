var test = require('tape').test
  , Tree = require('../')
  , stream = require('./tree-stream')

test('allows transient nodes', function (t) {
  var s = stream()
    , tree = new Tree({stream: s}).render()

  t.equal(tree.options.transientId, -1, '-1 transientId by default')

  s.on('end', function () {
    tree.expandAll()
    tree.addTransient({
      label: 'New transient',
      color: 'green',
      nodeType: 'metric'
    }, 1003)

    t.deepEqual(tree._layout[tree.options.transientId].parent, tree._layout[1003], 'transient node\'s parent is correct')
    t.equal(tree.el.select('.tree ul li.transient').size(), 1, 'transient node in the dom')
    t.equal(tree.el.select('.tree ul li.transient').datum().id, tree.options.transientId, 'transient id stored')
    t.equal(tree.el.select('.tree ul li.transient .label').text(), 'New transient', 'correct transient node label')

    tree.editTransient({
      label: 'Foobar'
    })

    t.equal(tree.el.select('.tree ul li.transient .label').text(), 'Foobar', 'transient label changed')

    tree.removeTransient()

    // wait for transitions
    setTimeout(function () {
      // add a new transient
      tree.addTransient({
        label: 'New transient',
        color: 'green',
        nodeType: 'metric'
      }, 1003)
      t.equal(tree.el.select('.tree ul li.transient').size(), 1, 'have another transient')
      tree.saveTransient(20100)

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
