var test = require('tape').test
  , css = require('./../dist/tree.css')
  , Transform = require('stream').Transform
  , Tree = require('../')
  , stream = require('./tree-stream')
  , util = require('util')

function _container () {
  var container = document.createElement('div')
  container.className = 'container'
  container.style.height = '300px'
  document.body.appendChild(container)
  return container
}

var Extender = function () {
  Transform.apply(this, arguments)
}

util.inherits(Extender, Transform)

Extender.prototype._transform = function (obj, encoding, done) {
  this.push(obj)

  if (obj.id === 1004) {
    // Append an extra 5000 nodes to 1004i
    for (var i = 1; i < 5000; i++) {
      var _id = 100000 + i
      this.push({id: _id, label: 'Extra Node ' + _id, parentId: 1004, nodeType: 'metric', color: 'red'})
    }
    return done()
  }

  done()
}

test('tree is in performance mode', function (t) {
  var s = stream().pipe(new Extender({objectMode: true}))
    , container = _container()
    , tree = new Tree({stream: s}).render()
  container.appendChild(tree.el.node())

  s.on('end', function () {
    tree.expandAll()
    t.equal(tree.el.node().querySelectorAll('.tree ul li').length, Math.floor(300 / tree.options.height) + 3, 'Show a subset of nodes based on scroll height')

    t.ok(tree._tuned, 'tree is tuned')
    // Check height overrides
    t.equal(tree.el.select('.tree ul').node().style.height, Object.keys(tree.nodes).length * tree.options.height + 'px', 'Overrides .tree ul height')
    tree.collapseAll()
    t.ok(!tree._tuned, 'tree is no longer tuned')
    t.equal(tree.el.select('.tree ul').node().style.height, 'auto', 'Sets height back to auto')

    // Check selecting a node that's hidden from performance tuning
    tree.expandAll()
    t.equal(tree.el.select('.tree').node().scrollTop, 0, 'scroll top is 0')

    tree.select(104000)

    t.equal(tree.el.select('.tree ul li.node[data-id="104000"]').size(), 1, '104000 is in the dom')
    t.equal(tree.el.select('.tree').node().scrollTop, 144108, 'scroll top adjusted')

    // Remove the style since the browser is a global nightmare
    document.querySelector('head style').remove()
    container.remove()

    t.end()
  })
})
