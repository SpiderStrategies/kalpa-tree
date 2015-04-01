var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , defaults = {
    depth: 20, // indentation depth
    height: 36, // height of each row
    accessors: {
      id: 'id',
      label: 'label',
      icon: 'icon',
      color: 'color'
    }
  }
  , styles = window.getComputedStyle(document.documentElement, '')
  , prefix = Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)[0]
  , resize = require('./lib/resize')

/**
 * Create a new d3 tree with the given config.
 */
var Tree = function (options) {
  if (!options) {
    throw new Error('options are required')
  }
  if (!options.stream) {
    throw new Error('options.stream is required')
  }

  this.options = defaults
  for (var p in options) {
    if (p === 'accessors') {
      for (var pp in options.accessors) {
        this.options.accessors[pp] = options.accessors[pp]
      }
    } else {
      this.options[p] = options[p]
    }
  }

  this.resizer = resize(prefix)

  this.tree = d3.layout.tree()
                       .nodeSize([0, this.options.depth])
}

util.inherits(Tree, EventEmitter)

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElement('div'))
              .attr('class', 'tree-container')

  this.node = this.el.append('div')
                       .attr('class', 'tree')
                       .append('ul')
                         .selectAll('li.node')

  this._nodeData = []
  this.options.stream.on('data', function (n) {
    var p = (function (nodes) {
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].id === n.parentId) {
          return nodes[i]
        }
      }
    })(self._nodeData)

    self._nodeData.push(n)
    if (p) {
      n.parent = p
      if (p == self._nodeData[0]) {
        // if parent is the root, then push unto children so it's visible
        (p.children || (p.children = [])).push(n)
        self.draw()
      } else {
        // push to _children so it's hidden, no need to draw
        (p._children || (p._children = [])).push(n)
      }
    } else {
      // root, draw it.
      self.draw()
    }
  })
  .on('end', self.draw.bind(self))

  return this
}

Tree.prototype.resize = function () {
  var box = this.el.select('div.tree').node().parentNode.getBoundingClientRect()
  this.resizer.height(this.options.height)
  this.node.call(this.resizer)
}

Tree.prototype.draw = function (source) {
  var self = this

  this.node = this.node.data(this.tree.nodes(this._nodeData[0]), function (d) {
    return d[self.options.accessors.id]
  })

  var enter = this.node.enter().append('li')
      .attr('class', 'node')
      .on('click', this._onSelect.bind(this))
      .style(prefix + 'transform', function (d) {
        return 'translate(0px,' + (source ? source._y : d.y) + 'px)'
      })
      .style('opacity', 1e-6)

  // Add the node contents
  var contents = enter.append('div')
                        .attr('class', 'node-contents')
                        .attr('style', function (d) {
                          return prefix + 'transform:' + 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
                        })

  // Add the toggler
  contents.append('div')
          .attr('class', 'toggler')
            .append('svg')
            .on('click', this._onToggle.bind(this))
              .append('use')
                .attr('xlink:href', '#icon-collapsed')

  // icon to represent the node tpye
  contents.append('svg')
          .attr('class', 'icon')
            .append('use')

  contents.append('div')
         .attr('class', 'label')

  // Now the indicator light
  enter.append('div')
          .attr('class', 'indicator')

  // Update the color if it changed
  this.node.selectAll('div.indicator')
      .attr('class', function (d) {
        return 'indicator ' + d[self.options.accessors.color]
      })

  // The icon maybe changed
  this.node.selectAll('svg.icon')
           .attr('class', function (d) {
             return 'icon ' + d[self.options.accessors.color]
           })
           .selectAll('use')
            .attr('xlink:href', function (d) {
              return '#icon-' + d[self.options.accessors.icon]
            })

  // change the state of the toggle icon by adjusting its class
  this.node.selectAll('.toggler')
           .attr('class', function (d) {
             return 'toggler ' + (d._children ? 'collapsed' : d.children ? 'expanded' : 'leaf')
           })

  // Perhaps the name changed
  this.node.selectAll('div.label')
            .text(function (d) {
              return d[self.options.accessors.label]
            })

  // if we are manipulating a single node, we may have to adjust selected properties
  if (source) {
    this.node.classed('selected', function (d) {
      return d.selected
    })
  }

  // If this node has been removed, let's remove it.
  var exit = this.node.exit()
  exit.selectAll('div.node-contents')
      .style(prefix + 'transform', function (d) {
        return 'translate(' + d.parent._x + 'px,0px)'
      })

  exit.style(prefix + 'transform', function (d) {
        return 'translate(0px,' + source._y + 'px)'
      })
      .style('opacity', 1e-6)
      .transition()
      .duration(300) // copied in css
      .remove()

  // Now resize things
  this.resize()
}

Tree.prototype.select = function (id, opt) {
  opt = opt || {}
  var d = this.get(id)

  if (d) {
    this._onSelect(d, null, opt)
  }
}

/*
 * Returns a node object by id. This searches all the underlying data, not
 * just the visible nodes.
 *
 * if no id is sent, returns the root, essentially the entire tree
 */
Tree.prototype.get = function (id) {
  if (typeof id === 'undefined') {
    return this._nodeData[0]
  }

  var node = null
  this._nodeData.some(function (d) {
    return d.id == id && (node = d, true)
  })
  return node
}

/*
 * Returns the currently selected d3 selection. This is the d3 object that contains
 * the currently selected node. The underlying dom node can be accessed by invoking
 * .node() on the selection.
 *
 * e.g.
 *    tree.getSelected().node()
 */
Tree.prototype.getSelected = function () {
  if (!this._selected) {
    return
  }

  var self = this
  return this.node.filter(function (d) {
    return d == self._selected
  })
}

Tree.prototype._onSelect = function (d, i, opt) {
  // determines if we should toggle the node. We don't toggle if it's the root node
  // or the node is already expanded, but not selected.
  var toggle = !(d.children && !d.selected) && i !== 0

  opt = opt || {}

  if (!opt.silent) {
    this.emit('select', d)
  }

  // tree_.selected stores a previously selected node
  if (this._selected) {
    // delete the selected field from that node
    delete this._selected.selected
  }

  d.selected = true
  this._selected = d

  // Make sure all ancestors are visible
  ;(function e (node) {
    if (!node) {
      return
    }
    if (node._children) {
      node.children = node._children
      node._children = null
    }
    if (node && node.parent) {
      e(node.parent)
    }
  })(d.parent)

  if (toggle) {
    this.toggle(d)
  } else {
    this.draw(d)
  }
}

Tree.prototype._onToggle = function (d, i) {
  d3.event.stopPropagation()
  if (i === 0) {
    // Never toggle root
    return
  }
  this.toggle(d)
}

Tree.prototype.editable = function () {
  var t = this.el.select('.tree')
  t.classed('editable', !t.classed('editable'))
}

/*
 * Toggle all isn't necessary the best name, because it doesn't toggle the root node,
 * since the first children are always visible
 */
Tree.prototype._toggleAll = function (fn) {
  for (var i = 1; i < this._nodeData.length; i++) {
    var d = this._nodeData[i]
    fn(d)
  }
  this.draw(this._nodeData[0])
}

Tree.prototype.expandAll = function () {
  this._toggleAll(function (d) {
    if (d._children) {
      d.children = d._children
      d._children = null
    }
  })
}

Tree.prototype.collapseAll = function () {
  this._toggleAll(function (d) {
    if (d.children) {
      d._children = d.children
      d.children = null
    }
  })
}

Tree.prototype.toggle = function (d) {
  if (d.children) {
    d._children = d.children
    d.children = null
  } else {
    d.children = d._children
    d._children = null
  }
  this.draw(d)
  if (d3.event) {
    d3.event.stopPropagation()
  }
}

module.exports = Tree
