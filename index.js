var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , Stream = require('stream').Stream
  , util = require('util')
  , styles = window.getComputedStyle(document.documentElement, '')
  , prefix = Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)[0]
  , update = require('./lib/update')
  , partialRight = require('./lib/partial-right')

var defaults = function () {
  return {
    toggleOnSelect: true, // By default each select will toggle the node if needed. This prevents the toggle
    depth: 20, // indentation depth
    height: 36, // height of each row
    maxAnimatable: 50, // Disable animations if a node has children greater than this amount
    indicator: false, // show indicator light nodes on the right
    accessors: {
      id: 'id',
      label: 'label',
      icon: 'icon',
      color: 'color'
    }
  }
}
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

  /*
   * If there's an error on the incoming stream, emit that on the tree
   */
  options.stream.on('error', (function (e) {
    this.emit('error', e)
  }).bind(this))

  this.options = defaults()
  for (var p in options) {
    if (p === 'accessors') {
      for (var pp in options.accessors) {
        this.options.accessors[pp] = options.accessors[pp]
      }
    } else {
      this.options[p] = options[p]
    }
  }

  this.prefix = prefix
  this.updater = update(this)

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

  // Internal structure holding the node's layout data
  this._layout = []

  // Public node data. The tree won't modify the objects in this structure
  this.nodes = []

  this.root = null

  this.options.stream.on('data', function (n) {
    // Add the node in its incoming form to nodes
    self.nodes[n.id] = n

    var p = self._layout[n.parentId]
      , _n = self._layout[n.id] = { // internal version which we'll use to modify the node's layout
        id: n.id
      }

    if (p) {
      _n.parent = p

      if (n.visible === false) {
        // This node shouldn't be visible, so store it in the parents _invisibleNodes
        (p._invisibleNodes || (p._invisibleNodes = [])).push(_n)
      } else if (p == self.root || (Array.isArray(self.root) && self.root.indexOf(p) !== -1) || p.children) {
        // if the parent is the root, or the parent has visible children, then push onto its children so this node is visible
        (p.children || (p.children = [])).push(_n)
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true, animate: false })
        } else if (!Array.isArray(self.root)) {
          self.draw(null, {animate: false})
        }
      } else if (self.options.initialSelection === _n.id) {
        // There's a initialSelection option equal to this node
        if (p._children) {
          // This parent has hidden children. Transfer them so they are visible
          p.children = p._children
          p._children = null
        }
        // Push this node onto the parents visible children
        (p.children || (p.children = [])).push(_n)
        // And select it
        self.select(_n.id, { silent: true, animate: false })
      } else {
        // push to _children so it's hidden, no need to draw
        (p._children || (p._children = [])).push(_n)
      }
    } else {
      if (self.root) {
        // This must be a forest tree
        self.root = Array.isArray(self.root) ? self.root.concat(_n) : [self.root, _n]
        self.el.select('.tree').classed('forest-tree', true)
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true, animate: false })
        }
      } else {
        self.root = _n

        // root, draw it.
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true, animate: false })
        } else {
          self.draw(null, {animate: false})
        }
      }
    }
    self.emit('node', n)
  })
  .on('end', self.draw.bind(self, null, {animate: false}))

  return this
}

Tree.prototype.draw = function (source, opt) {
  opt = opt || {}

  var self = this
    , data = (Array.isArray(this.root) ? this.root : [this.root]).reduce(function (p, subTree) {
      return p.concat(self.tree.nodes(subTree))
    }, [])

  this.node = this.node.data(data, function (d) {
    return d[self.options.accessors.id]
  })

  var enter = this.node.enter().append('li')
      .attr('class', 'node')
      .on('click', partialRight(this._onSelect.bind(this), self.options))
      .style(prefix + 'transform', function (d) {
        return 'translate(0px,' + (source ? (source._y || 0) : d.y) + 'px)'
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
          .attr('class', 'toggler leaf')
            .on('click', this._onToggle.bind(this))
            .append('svg')
              .append('use')
                .attr('xlink:href', '#icon-collapsed')

  // icon to represent the node tpye
  contents.append('svg')
          .attr('class', 'icon')
            .append('use')

  contents.append('div')
         .attr('class', 'label')

  // Now the label mask
  enter.append('div')
          .attr('class', (this.options.indicator ? 'label-mask indicator' : 'label-mask'))

  // Override animate if there are too many children and it will slow down the browser
  var srcChildren = source && (source.children || source._children)
  if (srcChildren && srcChildren.length > this.options.maxAnimatable) {
    opt.animate = false
  }
  // disable animations if necessary
  this.node.classed('notransition', opt.animate === false)

  // force a redraw so the css transitions are sure to work
  this.el[0][0].offsetHeight
  // Now we can update position
  self.node.call(self.updater)

  // Now remove the notransition class
  if (opt.animate === false) {
    process.nextTick(function () {
      self.node.classed('notransition', false)
    })
  }

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
        return 'translate(' + (d.parent ? d.parent._x : 0)+ 'px,0px)'
      })

  exit.style(prefix + 'transform', function (d) {
        return 'translate(0px,' + (source ? source._y : 0)+ 'px)'
      })
      .style('opacity', 1e-6)
  if (opt.animate === false) {
    exit.remove()
  } else {
    exit.transition()
        .duration(300) // copied in css
        .remove()
  }
}

Tree.prototype.select = function (id, opt) {
  opt = opt || this.options
  var d = this._layout[id]

  if (d) {
    this._onSelect(d, null, null, opt)
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
    return this.root
  }

  return this.nodes[id]
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

  return this.get(this._selected.id)
}

Tree.prototype._onSelect = function (d, i, j, opt) {
  opt = opt || {}

  // determines if we should toggle the node. We don't toggle if it's the root node
  // or the node is already expanded, but not selected.
  var toggle = opt.toggleOnSelect && !(d.children && !d.selected) && d !== this.root

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
    this.toggle(d, opt)
  } else {
    this.draw(d, opt)
  }

  if (!opt.silent) {
    this.emit('select', d)
  }
}

Tree.prototype._onToggle = function (d, i) {
  d3.event.stopPropagation()
  if (d === this.root) {
    // Never toggle root
    return
  }
  this.toggle(d)
}

/*
 * Adds a new node to the tree. Pass in d as the data that represents
 * the node, parent (which can be the parent object or an id), and an optional
 * index. If the index is sent, the node will be inserted at that index within the
 * parent's children.
 */
Tree.prototype.add = function (d, parent, idx) {
  if (this._layout[d.id]) {
    // can't add a node that we already have
    return
  }

  // internal node used for computing the layout
  var _d = { id: d.id }

  if (!parent && Array.isArray(this.root)) {
    this.nodes[d.id] = d // Store the real node

    // Forest tree and the new node is a new root
    if (typeof idx === 'number') {
      this.root.splice(idx, 0, _d)
    } else {
      this.root.push(_d)
    }
    this.draw()
    return d
  } else if (parent) {
    parent = this._layout[typeof parent === 'object' ? parent.id : parent]
  }

  if (!parent) {
    return
  }

  var children = parent.children || parent._children

  this.nodes[d.id] = d
  this._layout[_d.id] = _d

  _d.parent = parent

  if (typeof idx !== 'undefined') {
    children.splice(idx, 0, _d)
  } else {
    if (!children) {
      children = parent.children = []
    }
    children.push(_d)
  }

  this.draw(parent)
  return d
}

/*
 * Returns if the tree is in edit mode.
 */
Tree.prototype.isEditable = function () {
  return this.el.select('.tree').classed('editable')
}

/*
 * Toggles the tree's editable state
 */
Tree.prototype.editable = function () {
  var t = this.el.select('.tree')
  t.classed('editable', !t.classed('editable'))
}

/*
 * Edits a node
 */
Tree.prototype.edit = function (d) {
  if (d.id && this.nodes[d.id]) {
    this._patch(d)
    this.draw(this._layout[d.id])
  }
}

/*
 * Toggle all isn't necessary the best name, because it doesn't toggle the root node,
 * since the first children are always visible
 */
Tree.prototype._toggleAll = function (fn) {
  var self = this
  Object.keys(this._layout).forEach(function (key) {
    if (self._layout[key] != self.root) {
      fn(self._layout[key])
    }
  })
  this.draw(Array.isArray(this.root) ? this.root[0] : this.root)
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

/*
 * Receives an array of patch changes, or a stream that emits data events with
 * the node and the changes.
 */
Tree.prototype.patch = function (obj) {
  var self = this
  if (obj instanceof Stream) {
    obj.on('data', function (d) {
      self._patch(d)
      self.draw(self._layout[d.id])
    })
  } else if (Array.isArray(obj)) {
    obj.forEach(this._patch.bind(this))
    self.draw(Array.isArray(this.root) ? this.root[0] : this.root)
  }
}

/*
 * Merges properties from obj into the data object in the tree with the same id
 * as obj
 */
Tree.prototype._patch = function (obj) {
  var d = this.nodes[obj.id]
    , _d = this._layout[obj.id]

  if (d) {
    for (var prop in obj) {
      d[prop] = obj[prop]
    }

    // Check is the visible property has been set
    if (typeof obj.visible !== 'undefined' && _d.parent) {
      var invisibles = _d.parent._invisibleNodes || []
      if (obj.visible && invisibles.indexOf(_d) !== -1) {
        // Remove it from the parent's _invisibleNodes
        invisibles.splice(invisibles.indexOf(_d), 1)
        // And add it to the parent
        ;(_d.parent.children || _d.parent._children).push(_d)
      } else if (obj.visible == false) {
        // visible was set to false, so move the node to the parent's _invisibleNodes
        (_d.parent._invisibleNodes || (_d.parent._invisibleNodes = [])).push(_d)
        // And remove it from the parent's _children or children
        var children = _d.parent.children || _d.parent._children
          , idx = children.indexOf(_d)
        if (idx !== -1) {
          children.splice(idx, 1)
        }
      }
    }
  }
}

/*
 * Cleanup the tree object and remove it from the dom
 */
Tree.prototype.remove = function () {
  this.el.remove()
}

/*
 * Removes a node from the tree. obj can be the node id or the node itself
 */
Tree.prototype.removeNode = function (obj) {
  var node = this.nodes[typeof obj === 'object' ? obj.id : obj]

  if (!node) {
    return
  }

  var _node = this._layout[node.id]
    , parent = _node.parent
    , self = this

  if (parent) {
    // Remove the child from parent
    var children = parent.children || parent._children
    children.splice(children.indexOf(_node), 1)
    this.draw(parent)

    // Cleanup nodes
    ;[_node].reduce(function reduce(p, c) {
      var children = c.children || c._children
      if (children) {
        return p.concat(children.reduce(reduce, []))
      }
      return p.concat(c.id)
    }, []).forEach(function (id) {
      delete self.nodes[id]
      delete self._layout[id]
    })
  }
}

Tree.prototype.toggle = function (d, opt) {
  var _d = this._layout[d.id]
  if (_d.children) {
    _d._children = _d.children
    _d.children = null
  } else {
    _d.children = _d._children
    _d._children = null
  }
  this.draw(_d, opt)
}

module.exports = Tree
