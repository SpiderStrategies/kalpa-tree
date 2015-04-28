var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , Stream = require('stream').Stream
  , util = require('util')
  , styles = window.getComputedStyle(document.documentElement, '')
  , prefix = Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)[0]
  , enter = require('./lib/enter')
  , flyExit = require('./lib/fly-exit')
  , slideExit = require('./lib/slide-exit')
  , update = require('./lib/update')

var defaults = function () {
  return {
    toggleOnSelect: true, // By default each select will toggle the node if needed. This prevents the toggle
    depth: 20, // indentation depth
    height: 36, // height of each row (repeated in tree.less)
    maxAnimatable: 100, // Disable animations if a node has children greater than this amount
    indicator: false, // show indicator light nodes on the right
    forest: false, // Indicates whether this tree can have multiple root nodes
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

  this.transitionTimeout = 300 // Copied in css
  this.updater = update(this)
  this.enter = enter(this)
  this.flyExit = flyExit(this)
  this.slideExit = slideExit(this)

  this.tree = d3.layout.tree()
                       .nodeSize([0, this.options.depth])
}

util.inherits(Tree, EventEmitter)

Tree.prototype._hasTransitions = function () {
  return ('transition' in document.documentElement.style) || ('WebkitTransition' in document.documentElement.style)
}

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElement('div'))
              .attr('class', 'tree-container')

  this.node = this.el.append('div')
                       .attr('class', 'tree notransition') // set notransition initially until we have all the data
                       .classed('forest-tree', this.options.forest)
                       .append('ul')
                         .selectAll('li.node')

  // Internal structure holding the node's layout data
  this._layout = []

  // Public node data. The tree won't modify the objects in this structure
  this.nodes = []

  this.root = this.options.forest ? [] : null

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
        // Store the node's original index in case it's patched
        _n._originalIndex = (p.children || p._children).length
      } else if (p == self.root || (self.options.forest && self.root.indexOf(p) !== -1) || p.children) {
        // if the parent is the root, or the parent has visible children, then push onto its children so this node is visible
        (p.children || (p.children = [])).push(_n)
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true })
        } else if (!self.options.forest) {
          self._fly()
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
        self.select(_n.id, { silent: true })
      } else {
        // push to _children so it's hidden, no need to draw
        (p._children || (p._children = [])).push(_n)
      }
    } else {
      if (self.options.forest) {
        self.root.push(_n)
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true })
        }
      } else {
        self.root = _n

        // root, draw it.
        if (self.options.initialSelection === _n.id) {
          self.select(_n.id, { silent: true })
        } else {
          self._fly()
        }
      }
    }
    self.emit('node', n)
  })
  .on('end', function () {
    self._fly()
    self._forceRedraw()
    self.el.select('.tree').classed('notransition', false)
  })

  return this
}

/*
 * Forces a browser redraw. This is used if we're adding a node, and then
 * applying some transition. It makes sure that node is added to them, so the
 * browser doesn't batch operations
 */
Tree.prototype._forceRedraw = function () {
  this.el[0][0].offsetHeight
}

/*
 * Makes some operation (fn) transitionless, by applying
 * the notransition class to the tree before the operation is performed,
 * and then removing the class after the operation has finished
 */
Tree.prototype._transitionWrap = function (fn, animate) {
  var self = this
  return function () {
    if (animate === false) {
      self.el.select('.tree').classed('notransition', true)
    }
    var result = fn.apply(self, arguments)
    if (animate === false) {
      self._forceRedraw()
      // so we can remove the notransition class after things were painted
      self.el.select('.tree').classed('notransition', false)
    }
    return result
  }
}

/*
 * Rebinds the data to the selection
 */
Tree.prototype._rebind = function () {
  var data = null
    , self = this

  if (this.options.forest) {
    data = this.root.reduce(function (p, subTree) {
                      return p.concat(self.tree.nodes(subTree))
                    }, [])
  } else {
    data = this.tree.nodes(this.root)
  }

  this.node = this.node.data(data.map(function (d, i) {
    // Store sane copies of x,y that denote our true coords in the tree
    d._x = d.y
    d._y = i * self.options.height
    return d
  }), function (d) {
    return d[self.options.accessors.id]
  })
  return this.node
}

/*
 * Used to redraw the tree by flying nodes up to their parent if they are removed,
 * or having them released by their parent and flying down to their position.
 */
Tree.prototype._fly = function (source) {
  this._rebind()
      .call(this.enter, function (d) {
        // We always fly in from our parent if we have one. Otherwise fly in from our location
        return 'translate(0px,' + (d.parent ? d.parent._y : d._y) + 'px)'
      })
      .call(this.updater)
      .call(this.flyExit, source)
}

/*
 * Used to redraw the tree by sliding a node down into its place from a previous hole, or
 * having a node disappear into a hole and the nodes below it sliding up to their new position.
 *
 * source is the node that was changed
 */
Tree.prototype._slide = function (source) {
  var self = this
  this._rebind()
      .call(this.enter, function (d, i) {
        // if there's a source, enter at that source's position, otherwise add the node at its position
        return 'translate(0px,' + (source ? source._y : d._y) + 'px)'
      }, 'fading-node placeholder')
      .call(function (selection) {
        // Remove the fading-node class, now that it's in the dom
        selection.classed('fading-node', false)
        // Then remove the placeholder class once the transitions have run
        d3.timer(function () {
          selection.classed('placeholder', false)
          return true // run once
        }, self.transitionTimeout)
      })
      .call(this.slideExit, source)
      .call(this.updater)
}

Tree.prototype.select = function (id, opt) {
  opt = opt || {}
  if (typeof opt.toggleOnSelect === 'undefined') {
    opt.toggleOnSelect = this.options.toggleOnSelect
  }
  var d = this._layout[id]

  if (d) {
    // Disable animations if the node's parent is not visible and we're not already disabled (e.g. initial render)
    if (d.parent && !this.el.select('.tree').classed('notransition')) {
      var visible = this.node.filter(function (_d) {
        return d.parent.id === _d.id
      }).size()
      if (!visible) {
        opt.animate = false
      }
    }

    this._onSelect(d, null, null, opt)

    // Now scroll the node into view
    var node = this.node.filter(function (_d) {
      return _d == d
    }).node()

    if (opt.animate === false || !this._hasTransitions()) {
      node.scrollIntoView()
    } else {
      d3.timer(function () {
        node.scrollIntoView()
        return true
      }, this.transitionTimeout)
    }
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
 * Returns the currently selected node's data
 */
Tree.prototype.getSelected = function () {
  if (!this._selected) {
    return
  }

  return this.get(this._selected.id)
}

/*
 * Returns the currently selected node's dom element
 */
Tree.prototype.getSelectedEl = function () {
  if (!this._selected) {
    return
  }

  var self = this
  return this.node.filter(function (d) {
    return d.id == self._selected.id
  }).node()
}

Tree.prototype._onSelect = function (d, i, j, opt) {
  if (d3.event && d3.event.defaultPrevented) {
    return  // click events were suppressed by dnd (presumably)
  }

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
    var children = (d.children || d._children)
    if (children && children.length > this.options.maxAnimatable) {
      opt.animate = false
    }

    this._transitionWrap(this.toggle, opt.animate)(d)
  } else {
    this._fly(d)
  }

  // Adjust selected properties
  this.node.classed('selected', function (d) {
    return d.selected
  })

  if (!opt.silent) {
    this.emit('select', this.nodes[d.id])
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

  if (!parent && this.options.forest) {
    // Forest tree and the new node is a new root
    this.nodes[d.id] = d // Store the real node
    if (typeof idx === 'number') {
      this.root.splice(idx, 0, _d)
    } else {
      this.root.push(_d)
    }

    this._slide()
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

  this._slide()
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
 * Edits a single node
 */
Tree.prototype.edit = function (d) {
  if (d.id && this.nodes[d.id]) {
    this._patch(d)
    this._slide(this._layout[d.id])
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

  var prev = this.node.size()
    , selection = this._rebind()
    , notrans = selection[0].length > this.options.maxAnimatable || prev > this.options.maxAnimatable

  this._transitionWrap(function () {
    selection.call(this.enter, function (d) {
               return 'translate(0px,' + (d.parent ? d.parent._y : 0) + 'px)'
             })
             .call(this.updater)
             .call(this.flyExit, null, function (d) {
               return 'translate(0px,' + (d.parent ? d.parent._y : 0) + 'px)'
             })
  }, !notrans)()
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
       })
       .on('end', function () {
         self._slide()
       })
  } else if (Array.isArray(obj)) {
    obj.forEach(this._patch.bind(this))
    self._slide()
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
        ;(_d.parent.children || _d.parent._children).splice(_d._originalIndex, 0, _d)
        delete _d._originalIndex
      } else if (obj.visible == false) {
        // visible was set to false, so move the node to the parent's _invisibleNodes
        (_d.parent._invisibleNodes || (_d.parent._invisibleNodes = [])).push(_d)
        // And remove it from the parent's _children or children
        var children = _d.parent.children || _d.parent._children
          , idx = children.indexOf(_d)
        if (idx !== -1) {
          children.splice(idx, 1)
        }
        _d._originalIndex = idx
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
  } else if (this.options.forest) {
    this.root.splice(this.root.indexOf(this._layout[_node.id]), 1)
    delete this.nodes[_node.id]
    delete this._layout[_node.id]
  }

  this._rebind()
      .call(this.updater)
      .call(this.slideExit, _node)

    // Cleanup child nodes
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

Tree.prototype.toggle = function (d) {
  var _d = this._layout[d.id]
  if (_d.children) {
    _d._children = _d.children
    _d.children = null
  } else {
    _d.children = _d._children
    _d._children = null
  }
  this._fly(_d)
}

module.exports = Tree
