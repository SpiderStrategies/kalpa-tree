import Tree from '../index'
import * as http from 'http'
import JSONStream from 'JSONStream'

let bt = document.querySelector('.tree-bottom-toolbar')
  , container = document.querySelector('.container')
  , flip = false // hack
  , tree

bt.querySelector('.expand-all').onclick = function () {
  if (flip) {
    tree.collapseAll()
    this.innerHTML = 'Expand All'
  } else {
    tree.expandAll()
    this.innerHTML = 'Collapse All'
  }
  flip = !flip
}

document.querySelector('.patch').addEventListener('click', function () {
  http.get('/tree-patch.json', function (res) {
    tree.patch(res.pipe(JSONStream.parse([true])))
  })
})

document.querySelector('#search').addEventListener('keyup', function () {
  tree.search(this.value)
})

bt.querySelector('.state-toggler').onclick = function () {
  tree.editable()
}

;[].forEach.call(document.querySelectorAll('.coord'), function (coord) {
  coord.addEventListener('blur', function () {
    container.style[this.id] = this.value  + 'px'
  })
})

document.querySelector('#select').addEventListener('change', function () {
  tree.select(this.value)
})

// http.get('/documents.json', function (res) {
// http.get('/15-k-nodes.json', function (res) {
http.get('/sms-tree.json', function (res) {
  let stream = res.pipe(JSONStream.parse([true]))

  tree = new Tree({
      stream,
      accessors: {
        icon: 'nodeType'
      },
      initialSelection: 1005
    })

  stream.on('end', () => {
    console.log('stream ended')
  })

  tree.on('rendered', () => {
    console.log('tree is rendered in the dom')
  })

  tree.on('error', function (e) {
    console.log('tree error', e)
  })

  tree.on('move', function (node, newParent, previousParent, newIndex, prevIndex) {
    console.log(node)
    console.log(previousParent)
    console.log(newParent)
    console.log(newIndex)
    console.log(prevIndex)
  })

  // Let's be naughty for demo usage
  window.tree = tree

  container.appendChild(tree.render().el.node())

  tree.on('select', function (node) {
    console.log(node)
  })
})
