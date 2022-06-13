import { test } from 'tape'
import css from './../dist/tree.css'
import { Transform } from 'stream'
import Tree from '../index.js'
import stream from './tree-stream.js'
import util from 'util'

document.head.innerHTML = `<style>${css}</style>`

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
  var s = stream()
    , extender = s.pipe(new Extender({objectMode: true}))
    , container = _container()
    , tree = new Tree({stream: extender}).render()
  container.appendChild(tree.el.node())

  tree.on('rendered', function () {
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

    container.remove()
    t.end()
  })
})

test('collapsing a large tuned tree scrolls the nodes into view', function (t) {
  var s = stream()
    , extender = s.pipe(new Extender({objectMode: true}))
    , container = _container()
    , tree = new Tree({stream: extender})

  tree.on('rendered', function () {
    console.log('tree rendered')
    tree.expandAll()
    tree.el.select('.tree').node().scrollTop = 10

    tree.collapseAll()
    t.equal(tree.el.select('.tree').node().scrollTop, 0, 'scrolled to 0')

    container.remove()
    t.end()
  })
  tree.render()
  container.appendChild(tree.el.node())
})
