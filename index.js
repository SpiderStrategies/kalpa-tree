var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , regexEscape = require('escape-string-regexp')
  , Stream = require('stream').Stream
  , util = require('util')
  , styles = window.getComputedStyle(document.documentElement, '')
  , prefix = Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)[0]
  , enter = require('./lib/enter')
  , flyExit = require('./lib/fly-exit')
  , slideExit = require('./lib/slide-exit')
  , update = require('./lib/update')
  , identity = function (v) { return v }

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
  var self = this

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
                       .children(function (d) {
                         if (d.collapsed) {
                           return null
                         }
                         return d._allChildren && d._allChildren.filter(function (node) {
                                                                  return self._layout[node.id].visible !== false
                                                                })
                       })
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
        id: n.id,
        collapsed: true // by default incoming nodes are collapsed
      }

    if (n.visible === false) {
      _n.visible = false
    }

    if (p) {
      _n.parent = p
      // Simple array that we use to keep track of children
      ;(p._allChildren || (p._allChildren = [])).push(_n)
    } else {
      // Some type of root nodes. We treat those as expanded nodes
      _n.collapsed = false
      if (self.options.forest) {
        self.root.push(_n)
      } else {
        self.root = _n
      }
    }

    if (self.options.initialSelection === _n.id) {
      self.select(_n.id, { silent: true })
    } else if (!_n.collapsed) {
      // we may need to draw the tree to show the incoming node
      self._fly()
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
  return this.el[0][0].offsetHeight
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
      .call(this.enter, function (d) {
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

/*
 * Returns the parent node.
 */
Tree.prototype.parent = function (obj) {
  var parent = this._layout[typeof obj === 'object' ? obj.id : obj].parent
  return parent && this.nodes[parent.id]
}

/*
 * Returns a node's children. This includes all visible and invisible children
 */
Tree.prototype.children = function (obj) {
  var node = this._layout[typeof obj === 'object' ? obj.id : obj]
    , self = this

  return (node._allChildren || []).map(function (n) {
    return self.nodes[n.id]
  })
}


/*
 * Returns a node's siblings
 */
Tree.prototype._siblings = function (obj) {
  var node = this._layout[typeof obj === 'object' ? obj.id : obj]
    , children = node.parent ? node.parent._allChildren : this.options.forest ? this.root : []

  return children
}

/*
 * Returns an object with containing a node's siblings along with
 * its index within those siblings
 */
Tree.prototype._indexOf = function (obj) {
  var node = this._layout[typeof obj === 'object' ? obj.id : obj]
    , siblings = this._siblings(obj)

  return siblings.indexOf(node)
}

/*
 * Returns a node's next sibling
 */
Tree.prototype.nextSibling = function (obj) {
  var idx = this._indexOf(obj)

  if (idx !== -1) {
    var n = this._siblings(obj)[idx + 1]
    return this.nodes[n && n.id]
  }
}

/*
 * Returns a node's previous sibling
 */
Tree.prototype.previousSibling = function (obj) {
  var idx = this._indexOf(obj)

  if (idx !== -1) {
    var p = this._siblings(obj)[idx - 1]
    return this.nodes[p && p.id]
  }
}

/*
 * Moves a node within the tree
 * If to is missing and the tree is a forest, the node will be moved
 * to a new root node of the forest tree
 */
Tree.prototype.move = function (node, to) {
  var _node = this._layout[typeof node === 'object' ? node.id : node]

  if (!node) {
    return
  }

  var _to = this._layout[typeof to === 'object' ? to.id : to]

  if (_to) {
    this._removeFromParent(_node)
    delete _to.collapsed
    ;(_to._allChildren || (_to._allChildren = [])).push(_node)
    this._expandAncestors(_to)
  } else if (this.options.forest) {
    this._removeFromParent(_node)
    this.root.push(_node)
  }
  this._slide()
}

Tree.prototype._descendants = function (node) {
  return [node].reduce(function reduce (p, c) {
    if (c._allChildren) {
      return p.concat(c._allChildren.reduce(reduce, [c]))
    }
    return p.concat(c)
  }, [])
}

/*
 * Copies a node to some new parent. `transformer` can be used to transform
 * each node that will be copied.
 *
 * If to is missing and the tree is a forest, the node will be copied
 * to a new root node of the forest tree.
 */
Tree.prototype.copy = function (node, to, transformer) {
  var _node = this._layout[typeof node === 'object' ? node.id : node]

  if (!_node) {
    return
  }

  if (!transformer) {
    transformer = to
    to = undefined
  }

  // We need a clone of the node and the layout
  var self = this
    , _to = this._layout[typeof to === 'object' ? to.id : to]

  this._descendants(_node)
      .map(function (node) {
        var result = {
          transformed: (transformer || identity)(util._extend({}, self.nodes[node.id])),
          originalId: node.id,
          prevParent: self._layout[node.id].parent
        }
        return result
      })
      .forEach(function (node, i, all) {
        var d = {
          id: node.transformed.id
        }
        self._layout[node.transformed.id] = d
        self.nodes[node.transformed.id] = node.transformed

        if (i === 0) {
          // Top node in the subtree (node that is being copied)
          if (_to) {
            ;(_to._allChildren || (_to._allChildren = [])).push(d)
            self._expandAncestors(_to)
            _to.collapsed = false
          } else if (self.options.forest) {
            self.root.push(d)
          }
        } else {
          // Find the new parent id
          var p = null

          for (var j = i; j >= 0; j--) {
            if (all[j].originalId === node.prevParent.id) {
              p = self._layout[all[j].transformed.id]
              break
            }
          }
          d.parent = p
          ;(p._allChildren || (p._allChildren = [])).push(d)
        }
      })
  this._slide()
}

/*
 * Selects a node in the tree. The node will be marked as selected and shown in the tree.
 *
 * opt supports:
 *    - silent: Don't fire the select event
 *    - toggleOnSelect: Don't toggle the node if it has children, just select it
 *    - animate: Disable animations
 *    - force: Forces a select. Can be used to bypass the no-op selection if the node is already selected. This forces a redraw.
 */
Tree.prototype.select = function (id, opt) {
  // handle no-op selection quickly without messing with the dom
  if ((this._selected && this._selected.id == id) && opt.force != true) {
    return
  }
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

    // check if we need to scroll this element into view
    var n = this.el.select('.tree').node()

    if (d._y < n.scrollTop || d._y > n.offsetHeight + n.scrollTop) {
      // Now scroll the node into view
      if (opt.animate === false || !this._hasTransitions()) {
        n.scrollTop = d._y
      } else {
        d3.timer(function () {
          n.scrollTop = d._y
          return true
        }, this.transitionTimeout)
      }
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
Tree.prototype.selected = function () {
  if (!this._selected) {
    return
  }

  return this.get(this._selected.id)
}

/*
 * Returns the currently selected node's dom element
 */
Tree.prototype.selectedEl = function () {
  if (!this._selected) {
    return
  }

  var self = this
  return this.node.filter(function (d) {
    return d.id == self._selected.id
  }).node()
}

Tree.prototype._expandAncestors = function (d) {
  // Make sure all ancestors are visible
  ;(function e (node) {
    if (!node) {
      return
    }
    delete node.collapsed
    if (node && node.parent) {
      e(node.parent)
    }
  })(d.parent)
}

Tree.prototype._onSelect = function (d, i, j, opt) {
  if (d3.event && d3.event.defaultPrevented) {
    return  // click events were suppressed by dnd (presumably)
  }

  opt = opt || {}

  // determines if we should toggle the node. We don't toggle if it's the root node
  // or the node is already expanded, but not selected.
  var toggle = opt.toggleOnSelect && !(!d.collapsed && !d.selected) && d !== this.root

  // tree_.selected stores a previously selected node
  if (this._selected) {
    // delete the selected field from that node
    delete this._selected.selected
  }

  d.selected = true
  this._selected = d

  this._expandAncestors(d)

  if (toggle) {
    if (d._allChildren && d._allChildren.length > this.options.maxAnimatable) {
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

Tree.prototype._onToggle = function (d) {
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
    this._layout[_d.id] = _d
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

  this.nodes[d.id] = d
  this._layout[_d.id] = _d

  if (typeof idx !== 'undefined') {
    parent._allChildren.splice(idx, 0, _d)
  } else {
    if (!parent._allChildren) {
      parent._allChildren = []
    }
    parent._allChildren.push(_d)
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
    delete d.collapsed
  })
}

Tree.prototype.collapseAll = function () {
  this._toggleAll(function (d) {
    d.collapsed = true
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
    if (typeof obj.visible !== 'undefined') {
      if (obj.visible === false) {
        _d.visible = false
      } else {
        delete _d.visible
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

Tree.prototype._removeFromParent = function (node) {
  var parent = node.parent
  if (parent) {
    // Remove the child from parent
    var i = parent._allChildren.indexOf(node)
    if (i !== -1) {
      parent._allChildren.splice(i, 1)
    }
  } else if (this.options.forest) {
    this.root.splice(this.root.indexOf(node), 1)
  }

  return this
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

  this._removeFromParent(_node)

  // Now clean up
  delete this.nodes[_node.id]
  delete this._layout[_node.id]

  // cleanup nodes from `.nodes` and `._layout`
  var self = this
  this._descendants(_node).forEach(function (node) {
    delete self.nodes[node.id]
    delete self._layout[node.id]
  })

  // Redraw
  this._rebind()
      .call(this.updater)
      .call(this.slideExit, _node)
}

Tree.prototype.search = function (term) {
  if (term == null) {
    return this.select((this._selected && this._selected.id) || (this.options.forest ? this.root[0].id : this.root.id), {force: true})
  }
  var re = new RegExp(regexEscape(term), 'ig')
    , self = this
    , data = Object.keys(this.nodes).filter(function (k) {
               re.lastIndex = 0
               return re.test(self.nodes[k][self.options.accessors.label])
             }).map(function (key, i) {
               var _d = self._layout[key]
               _d._x = 0
               _d._y = i * self.options.height
               return _d
             })

  this.node = this.node.data(data, function (d) {
                         return d[self.options.accessors.id]
                       })
                       .call(this.enter)
                       .call(this.updater)
                       .call(function (selection) {
                         selection.exit().remove() // No animations on exit
                       })
                       .classed('search-result', true)
}

/*
 * Used to toggle the node's children. If they are visible this will hide them, and
 * if they are hidden, this will show them.
 */
Tree.prototype.toggle = function (d) {
  var _d = this._layout[d.id]
  _d.collapsed = !_d.collapsed
  this._fly(_d)
}

module.exports = Tree
