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
    rootHeight: 36, // root node height can be overridden
    maxAnimatable: 100, // Disable animations if a node has children greater than this amount
    indicator: false, // show indicator light nodes on the right
    forest: false, // Indicates whether this tree can have multiple root nodes
    droppable: function (d, parent) {
      // `d` is the node being moved
      // `parent` is its new parent. May be undefined if node is being moved to root in a forest tree

      return true // By default, any node can be dropped on any other node
    },
    contents: require('./lib/contents'),
    performanceThreshold: 1000, // If the node data count exceeds this threshold, the tree goes into performance mode
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

  this._rootOffset = Math.max(this.options.rootHeight - this.options.height, 0)
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

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElement('div'))
              .attr('class', 'tree-container')

  this.node = this.el.append('div')
                       .attr('class', 'tree')
                       .on('scroll', function () {
                         var scroll = self.el.select('.tree').node().scrollTop
                         if (!self._scrollTop) {
                           self._scrollTop = scroll
                         }

                         if (Math.abs(scroll - self._scrollTop) > self.options.height) {
                           self.adjustViewport()
                           self._scrollTop = scroll
                         }
                       })
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
      if (self.options.forest) {
        self.root.push(_n)
      } else {
        _n.collapsed = false
        self.root = _n
      }
    }

    if (self.options.initialSelection == _n.id) {
      self.select(_n.id, { silent: true, animate: false })
    } else if (!_n.collapsed) {
      // we may need to draw the tree to show the incoming node
      self._fly()
    }
    self.emit('node', n)
  })
  .on('end', function () {
    self._fly()
  })

  return this
}

/*
 * Forces a browser redraw. This is used if we're adding a node, and then
 * applying some transition. It makes sure that node is added to dom, so the
 * browser doesn't batch operations
 */
Tree.prototype._forceRedraw = function () {
  return this.el[0][0].offsetHeight
}

/*
 * Makes some operation (fn) have transitions, by applying
 * the transitions class to the tree before the operation is performed,
 * and then removing the class after the operation has finished
 *
 * If force is passed in, we always animate. Use w/ caution.
 */
Tree.prototype._transitionWrap = function (fn, animate, force) {
  var self = this
  return function (d) {
    animate = typeof animate !== 'undefined' ? animate : self.node.size() < self.options.maxAnimatable

    if (animate) {
      // Check to make sure we're not going to show too many nodes by grabbing ALL of this node's children
      // and summing that number with each child's visible descendants
      var count = (d && d._allChildren || []).reduce(function (p, c) {
                              p += self._descendants(c, 'children').length
                              return p
                     }, 0)
      animate = count > self.options.maxAnimatable ? false : animate
    }

    if (self._tuned) {
      // The tree is in a performance tuning mode, which means nodes that should be visible aren't.
      // We turn off all animations
      animate = false
    }

    if (force) {
      // Force animations, ignoring everything else
      animate = true
    }

    if (animate) {
      self.el.select('.tree').classed('transitions', true)
    }

    var result = fn.apply(self, arguments)
    if (animate) {
      self.el.selectAll('.node')
               .on('transitionend', function () {
                 self.el.select('.tree').classed('transitions', false)
               })
    }

    return result
  }
}

Tree.prototype.adjustViewport = function () {
  if (this._tuned) {
    var node = this._searchResults ? this._join(this._searchResults) : this._rebind()
    node.call(this.enter, function (d) {
          return 'translate(0px,' + d._y + 'px)'
        })
        .call(this.updater)
        .exit()
        .remove()
  }
}

Tree.prototype._clearSearch = function () {
  // Any rebind of data removes the search-results class
  this.el.select('.tree')
           .classed('search-results', false)
           .on('.search-click', null)

  this._searchResults = null

  return this
}

/*
 * Rebinds the data to the selection based on the data model in the tree.
 */
Tree.prototype._rebind = function () {
  var data = null
    , self = this
    , mapper = function (d, i) {
                 // Store sane copies of x,y that denote our true coords in the tree
                 d._x = d.y
                 d._y = i * self.options.height + (i > 0 ? self._rootOffset : 0)
                 return d
               }

  this._clearSearch()
      .el.select('.tree').classed('detached-root', !!this._rootOffset)

  if (this.options.forest) {
    data = this.root.reduce(function (p, subTree) {
                      return p.concat(self.tree.nodes(subTree))
                    }, [])
                    .map(mapper)
  } else if (this.root) {
    data = this.tree.nodes(this.root)
                    .map(mapper)
  } else {
    data = []
  }

  return this._join(data)
}

/*
 * Joins the data to the dom seletion
 */
Tree.prototype._join = function (data) {
  var self = this
    , height = 'auto'
    , n = this.el.select('.tree').node()
    , viewport = {
      top: Math.max(0, n.scrollTop - this.options.height * 2),
      bottom: n.scrollTop + n.offsetHeight + this.options.height * 2
    }

  this._tuned = false

  if (data.length > this.options.performanceThreshold) {
    var last = data[data.length - 1]
    data = data.filter(function (d, i) {
                  var inside = d._y >= viewport.top && d._y <= viewport.bottom
                  if (!inside) {
                    // Set a flag on the tree if we're optimized because the dataset is too large
                    self._tuned = true
                  }
                  return inside
                })
    if (this._tuned) {
      height = last._y + this.options.height + this._rootOffset + 'px'
    }
  }

  this.el.select('.tree ul').style('height', height)
  this.node = this.node.data(data, function (d) {
                         return d[self.options.accessors.id]
                       })
  return this.node
}

/*
 * Used to redraw the tree by flying nodes up to their parent if they are removed,
 * or having them released by their parent and flying down to their position.
 */
Tree.prototype._fly = function (source) {
  var visible = this._visibleNodes()

  this._rebind()
      .call(this.enter, this._defaultEnterFly.bind(this, visible))
      .call(this.updater)
      .call(this.flyExit, source)
}

Tree.prototype._defaultEnterFly = function (visible, d) {
  var y = (function p (node) {
    if (!node) {
      return 0
    }
    if (visible[node.id]) {
      return visible[node.id]
    }
    return p(node.parent)
  })(d.parent)

  return 'translate(0px,' + y + 'px)'
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
      }, 'fading-node transition-placeholder')
      .call(function (selection) {
        // Remove the fading-node class, now that it's in the dom
        selection.classed('fading-node', false)
        // Then remove the transition-placeholder class once the transitions have run
        d3.timer(function () {
          selection.classed('transition-placeholder', false)
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
  this._transitionWrap(this._slide)()
}

Tree.prototype._descendants = function (node, prop) {
  if (!prop) {
    prop = '_allChildren'
  }
  return [node].reduce(function reduce (p, c) {
    if (c[prop]) {
      return p.concat(c[prop].reduce(reduce, [c]))
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
    , _to = this._layout[to && typeof to === 'object' ? to.id : to]

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
  this._transitionWrap(this._slide)()
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
  opt = opt || {}
  // handle no-op selection quickly without messing with the dom
  if ((this._selected && this._selected.id == id) && opt.force !== true) {
    return
  }

  if (typeof opt.toggleOnSelect === 'undefined') {
    opt.toggleOnSelect = this.options.toggleOnSelect
  }
  var d = this._layout[id]

  if (d) {
    // Disable animations if the node's parent is not visible
    if (d.parent) {
      var visible = this.node.filter(function (_d) {
        return d.parent.id === _d.id
      }).size()

      if (!visible) {
        opt.animate = false
      }
    }

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

/*
 * Scrolls a node into view
 */
Tree.prototype._scrollIntoView = function (d, opt) {
  // check if we need to scroll this element into view
  var n = this.el.select('.tree').node()

  if (d._y < n.scrollTop || d._y > n.offsetHeight + n.scrollTop) {
    // Now scroll the node into view
    if (opt.animate === false || this._tuned) {
      n.scrollTop = d._y
    } else {
      // We're playing animations, wait until they are done
      d3.timer(function () {
        n.scrollTop = d._y
        return true
      }, this.transitionTimeout)
    }

    if (this._tuned) {
      // Where we scrolled may not have anything drawn, so redraw based on the viewport
      this.adjustViewport()
    }
  }
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
    var prev = this._selected.id
    // delete the selected field from that node
    delete this._selected.selected
  }

  d.selected = true
  this._selected = d

  this._expandAncestors(d)

  if (toggle) {
    this.toggle(d, opt)
  } else {
    // We're not showing or hiding nodes, it will just be an update
    this._fly(d)
  }

  // Adjust selected properties
  this.node.classed('selected', function (d) {
             return d.selected
           })
           .classed('selecting', function (d) {
             // Mark as `selecting` if it's newly selected
             return d.selected && d.id !== prev
           })

  // Trigger a reflow to start any transitions
  this._forceRedraw()

  // Now the node is no longer `selecting`
  this.node.classed('selecting', false)

  this._scrollIntoView(d, opt)

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

    this._transitionWrap(this._slide)()
    return d
  } else if (parent) {
    parent = this._layout[typeof parent === 'object' ? parent.id : parent]
  } else if (!parent && !this.root) {
    this.root = _d
  } else {
    // No parent, and not a new root node
    return
  }

  _d.parent = parent
  this.nodes[d.id] = d
  this._layout[_d.id] = _d

  if (typeof idx !== 'undefined') {
    parent._allChildren.splice(idx, 0, _d)
  } else if (parent) {
    if (!parent._allChildren) {
      parent._allChildren = []
    }
    parent._allChildren.push(_d)
  }

  if (parent && parent.selected) {
    // The parent is selected, we want to expand its children (#259)
    delete parent.collapsed
  }

  this._transitionWrap(this._slide)()
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
}

Tree.prototype._visibleNodes = function () {
  return this.node[0].reduce(function (p, c) {
    var _c = d3.select(c).datum()
    p[_c.id] = _c._y
    return p
  }, {})
}

Tree.prototype.expandAll = function () {
  this._toggleAll(function (d) {
    delete d.collapsed
  })

  if (Object.keys(this._layout).length < this.options.maxAnimatable) {
    this._transitionWrap(function () {
      var visible = this._visibleNodes() // Fetch visible nodes before we rebind data
      this._rebind().call(this.enter, this._defaultEnterFly.bind(null, visible))
                    .call(this.updater)
    })()
  } else {
    this._rebind()
        .call(this.enter, function (d) {
          return 'translate(0px,' + d._y + 'px)'
        })
        .call(this.updater)
        .exit()
        .remove()
  }
}

Tree.prototype.collapseAll = function () {
  this._toggleAll(function (d) {
    d.collapsed = true
  })

  if (Object.keys(this._layout).length < this.options.maxAnimatable) {
    this._transitionWrap(function () {
      this._rebind()
          .call(this.enter) // Seems odd, but needed in case we're showing a subset of the tree (i.e. search results)
          .call(this.updater)
          .call(this.flyExit, null, function (d) {
            var c = p = d.parent

            // Determine our top ancestor
            while (p.parent) {
              c = p
              p = p.parent
            }

            // Move this node to the ancestors location
            return 'translate(0px,' + c._y + 'px)'
          })
    })()
  } else {
    this._rebind()
        .call(this.enter)
        .call(this.updater)
        .exit()
        .remove()
  }
}

/*
 * Makes modifications to tree node(s). Can update a single node, an array of patch
 * changes, or a stream that emits data events with the node and the changes
 */
Tree.prototype.edit = function (obj) {
  if (typeof obj === 'object' && obj.id && this.nodes[obj.id]) {
    this._edit(obj)
    this._transitionWrap(this._slide)(this._layout[obj.id])
  } else if (Array.isArray(obj)) {
    obj.forEach(this._edit.bind(this))
    this._transitionWrap(this._slide)()
  } else if (typeof obj.on === 'function' ) {
    // Assume it's a stream.
    var self = this
    obj.on('data', function (d) {
         self._edit(d)
       })
       .on('end', function () {
         self._transitionWrap(self._slide)()
       })
  }
}

/*
 * Merges properties from obj into the data object in the tree with the same id
 * as obj
 */
Tree.prototype._edit = function (obj) {
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
    var i = this.root.indexOf(node)
    if (i !== -1) {
      this.root.splice(i, 1)
    }
  }
  node.parent = null

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

  if (node.id === this.root.id) {
    delete this.root
  }

  // cleanup nodes from `.nodes` and `._layout`
  var self = this
  this._descendants(_node).forEach(function (node) {
    delete self.nodes[node.id]
    delete self._layout[node.id]
  })

  _node._allChildren = []

  // Redraw
  this._transitionWrap(function () {
    this._rebind()
        .call(this.updater)
        .call(this.slideExit, _node)
  })()
}

Tree.prototype.search = function (term) {
  if (term == null) {
    return this.select((this._selected && this._selected.id) || (this.options.forest ? this.root[0].id : this.root.id), {
      force: this.el.select('.tree').classed('search-results')
    })
  }

  var re = new RegExp(regexEscape(term), 'ig')
    , self = this
    , data = Object.keys(this.nodes).filter(function (k) {
               re.lastIndex = 0
               return re.test(self.nodes[k][self.options.accessors.label]) && self.nodes[k].visible !== false
             }).map(function (key, i) {
               var _d = self._layout[key]
               _d._x = 0
               _d._y = i * self.options.height
               return _d
             })

  this._transitionWrap(function () {
    this.el.select('.tree').classed('search-results', true)
                           .classed('detached-root', false)
                           .on('click.search-click', function () {
                              // Capture the click event at the tree level, and collapse all nodes
                              // before the actual node is selected
                              self._toggleAll(function (d) {
                                d.collapsed = true
                              })
                           }, true)
    this._searchResults = data
    this._join(data)
        .call(this.enter)
        .call(this.updater)
        .call(function (selection) {
          selection.exit().remove() // No animations on exit
        })
  })()
}

/*
 * Used to toggle the node's children. If they are visible this will hide them, and
 * if they are hidden, this will show them.
 */
Tree.prototype.toggle = function (d, opt) {
  var _d = this._layout[d.id]
  opt = opt || {}
  _d.collapsed = !_d.collapsed
  this._transitionWrap(this._fly, opt.animate)(_d)
}

module.exports = Tree
