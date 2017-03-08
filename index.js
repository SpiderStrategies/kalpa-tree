var d3 = require('d3-selection')
  , DnD = require('./lib/dnd')
  , drag = require('d3-drag').drag
  , timer = require('d3-timer').timer
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
  , layout = require('./lib/layout')
  , identity = function (v) { return v }

// Mix transitions into d3-selection's prototype
require('d3-transition')

var merge = function (from, to) {
  to = to || {}
  for (var prop in from) {
    to[prop] = from[prop]
  }
  return to
}

var defaults = function () {
  return {
    transientId: -1, // Node's that are `placeholders` are not part of the tree yet.
    toggleOnSelect: true, // By default each select will toggle the node if needed. This prevents the toggle
    depth: 20, // indentation depth
    height: 36, // height of each row (repeated in tree.less)
    rootHeight: 36, // root node height can be overridden
    maxAnimatable: 100, // Disable animations if a node has children greater than this amount
    indicator: false, // show indicator light nodes on the right
    forest: false, // Indicates whether this tree can have multiple root nodes
    movable: function (d) {
      // `d` is the node
      // `this` is a reference to the tree
      return true
    },
    droppable: function (d, parent) {
      // `d` is the node being moved
      // `parent` is its new parent. May be undefined if node is being moved to root in a forest tree
      // `this` is a reference to the tree
      return true // By default, any node can be dropped on any other node
    },
    label: function (selection) {
      // This call be used to override how the label is drawn using the default
      // `contents`
      var tree = this
      selection.text(function (d) {
        return tree.nodes[d.id][tree.options.accessors.label]
      })
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

  var dnd = new DnD(this)
    , listener = drag()
  listener.on('start', dnd.start)
          .on('drag', dnd.drag)
          .on('end', dnd.end)
  this.dnd = listener

  this.layout = layout(this.options.depth, this.options.height, this._rootOffset, function (d) {
                  if (d.collapsed) {
                    return null
                  }
                  return d._allChildren && d._allChildren.filter(function (node) {
                                                           return node.visible !== false
                                                         })
                })
}

util.inherits(Tree, EventEmitter)

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElement('div'))
              .attr('class', 'tree-container')
              .classed('ie-trident', function () {
                return navigator.userAgent.indexOf('MSIE') !== -1 ||
                       navigator.appVersion.indexOf('Trident/') > 0
              })

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
  return this.el.nodes()[0].offsetHeight
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
    var self = this
      , next = function (enter, update, exit) {
                 enter.call(self.enter, function (d) {
                   return 'translate3d(0px,' + d._y + 'px,0px)'
                 })
                 update.call(self.updater)
                 exit.remove()
               }
    this._searchResults ? this._join(this._searchResults, next) : this._rebind(next)
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
Tree.prototype._rebind = function (next) {
  this._clearSearch()
      .el
      .select('.tree')
      .classed('detached-root', !!this._rootOffset)

  return this._join(this.layout(this.root), next)
}

/*
 * Joins the data to the dom selection, and invokes the `next` callback
 * passing the enter, update, and exit selections
 */
Tree.prototype._join = function (data, next) {
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

  this.resize(data.length)
  this.el.select('.tree ul')
           .style('height', height)

  var _node = this.el.select('.tree ul')
                     .selectAll('li')
                     .data(data, function (d) {
                       return d[self.options.accessors.id]
                     })
    , enter = _node.enter()
                   .insert('li')
    , exit = _node.exit()
    , update = this.node = enter.merge(_node)

  if (this.el.select('.tree').classed('editable')) {
    update.filter(function (d) {
            return self.options.movable.call(self, self.nodes[d.id])
          })
          .classed('movable', true)
          .call(this.dnd) // Apply the dnd listener to all movable nodes if we're in edit mode
  } else {
    update.on('.drag', null) // Clear all dnd listeners
          .classed('movable', false)
  }

  return next(enter, update, exit)
}

/*
 * Used to redraw the tree by flying nodes up to their parent if they are removed,
 * or having them released by their parent and flying down to their position.
 */
Tree.prototype._fly = function (source) {
  var visible = this._visibleNodes()
    , self = this

  this._rebind(function (enter, update, exit) {
    enter.call(self.enter, self._defaultEnterFly.bind(self, visible))
    update.call(self.updater)
    exit.call(self.flyExit, source)
  })
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

  return 'translate3d(0px,' + y + 'px,0px)'
}

/*
 * Used to redraw the tree by sliding a node down into its place from a previous hole, or
 * having a node disappear into a hole and the nodes below it sliding up to their new position.
 *
 * source is the node that was changed
 */
Tree.prototype._slide = function (source) {
  var self = this

  this._rebind(function (enter, update, exit) {
    enter.call(self.enter, function (d) {
            // if there's a source, enter at that source's position, otherwise add the node at its position
            return 'translate3d(0px,' + (source ? source._y : d._y) + 'px,0px)'
          }, 'fading-node transition-placeholder')
    update.call(function (selection) {
      // Remove the fading-node class, now that it's in the dom
      selection.classed('fading-node', false)
      // Then remove the transition-placeholder class once the transitions have run
      var t = timer(function () {
        selection.classed('transition-placeholder', false)
        t.stop()
      }, self.transitionTimeout)
    })
    exit.call(self.slideExit, source)
    update.call(self.updater)
  })
}

/*
 * Sets the `tree-overflow` class on the tree node based on `visibleNodes` length.
 * `visibleNodes` is optional. If it's not received, we look up how many nodes are visible.
 * But for performance reasons we allow an incoming argument to control how
 * many nodes are visible in case this number is already known.
 *
 * This doesn't actually resize the tree, it should be fired after the size of the tree container
 * has been changed.
 *
 */
Tree.prototype.resize = function (visibleNodes) {
  if (visibleNodes === undefined) {
    visibleNodes = this.el.selectAll('.tree ul li')
                          .data().length
  }
  var height = this.options.height
  this.el.select('.tree')
         .classed('tree-overflow', function () {
           return this.offsetHeight < visibleNodes * height
         })

  return this
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
 *
 * If an optional index is received, the node will be inserted at that index within the
 * `to`'s children.
 */
Tree.prototype.move = function (node, to, idx) {
  var _node = this._layout[typeof node === 'object' ? node.id : node]

  if (!node) {
    return
  }

  var _to = this._layout[to !== null && typeof to === 'object' ? to.id : to]

  if (_to) {
    this._removeFromParent(_node)
    delete _to.collapsed
    var children = (_to._allChildren || (_to._allChildren = []))
    children.splice(typeof idx === 'number' ? idx : children.length, 0, _node)
    this._expandAncestors(_to)
  } else if (this.options.forest) {
    this._removeFromParent(_node)
    this.root.splice(typeof idx === 'number' ? idx : this.root.length, 0, _node)
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
      var t = timer(function () {
        n.scrollTop = d._y
        t.stop()
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
    this.root.splice(typeof idx === 'number' ? idx : this.root.length, 0, _d)
    this._transitionWrap(this._slide)()
    return d
  } else if (parent) {
    parent = this._layout[parent !== null && typeof parent === 'object' ? parent.id : parent]
  } else if (!parent && !this.root) {
    this.root = _d
  } else {
    // No parent, and not a new root node
    return
  }

  if (parent && parent.selected) {
    // The parent is selected, we want to expand its children (#259)
    delete parent.collapsed
    // Show the children immediately
    this._fly()
    this._forceRedraw()
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
  var tree = this.el.select('.tree')
  tree.classed('editable', !tree.classed('editable'))
  this._join(this.layout(this.root), Function.prototype)
}

/*
 * Toggle all isn't necessarily the best name, because it doesn't toggle the root node,
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
  return this.node.nodes().reduce(function (p, c) {
    var _c = d3.select(c).datum()
    p[_c.id] = _c._y
    return p
  }, {})
}

Tree.prototype.expandAll = function () {
  this._toggleAll(function (d) {
    delete d.collapsed
  })
  var self = this

  if (Object.keys(this._layout).length < this.options.maxAnimatable) {
    this._transitionWrap(function () {
      var visible = this._visibleNodes() // Fetch visible nodes before we rebind data
      self._rebind(function (enter, update, exit) {
        enter.call(self.enter, self._defaultEnterFly.bind(null, visible))
        update.call(self.updater)
      })
    })()
  } else {
    self._rebind(function (enter, update, exit) {
      enter.call(self.enter, function (d) {
             return 'translate3d(0px,' + d._y + 'px,0px)'
           })
      update.call(self.updater)
      exit.remove()
    })
  }
}

Tree.prototype.collapseAll = function () {
  this._toggleAll(function (d) {
    d.collapsed = true
  })
  var self = this

  if (Object.keys(this._layout).length < this.options.maxAnimatable) {
    this._transitionWrap(function () {
      self._rebind(function (enter, update, exit) {
        enter.call(self.enter) // Seems odd, but needed in case we're showing a subset of the tree (i.e. search results)
        update.call(self.updater)
        exit.call(self.flyExit, null, function (d) {
          var c = p = d.parent

          // Determine our top ancestor
          while (p.parent) {
            c = p
            p = p.parent
          }

          // Move this node to the ancestors location
          return 'translate3d(0px,' + c._y + 'px,0px)'
        })
      })
    })()
  } else {
    self._rebind(function (enter, update, exit) {
      enter.call(self.enter)
      update.call(self.updater)
      exit.remove()
    })
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
    d = merge(obj, d)

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
    this._rebind(function (enter, update, exit) {
      update.call(self.updater)
      exit.call(self.slideExit, _node)
    })
  })()
}

Tree.prototype.search = function (term) {
  if (term == null) {
    return this.select((this._selected && this._selected.id) || (this.options.forest ? this.root[0].id : this.root.id), {
      force: this.el.select('.tree').classed('search-results'),
      silent: true
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

    this._join(data, function (enter, update, exit) {
      enter.call(self.enter)
      update.call(self.updater)
      exit.remove() // No animations on exit
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

Tree.prototype.addTransient = function (d, parent, idx) {
  var t = merge(d)
  t.id = this.options.transientId // Force feed it a fake id
  return Tree.prototype.add.call(this, t, parent, idx)
}

Tree.prototype.getTransient = function () {
  return Tree.prototype.get.call(this, this.options.transientId)
}

Tree.prototype.editTransient = function (d) {
  var t = merge(d, this.nodes[this.options.transientId])
  t.id = this.options.transientId // Force it the transient id
  return Tree.prototype.edit.call(this, t)
}

Tree.prototype.moveTransient = function (to, idx) {
  return Tree.prototype.move.call(this, this.getTransient(), to, idx)
}

/*
 * Save the current transient node, giving it the new id
 */
Tree.prototype.saveTransient = function (id) {
  var node = this.nodes[this.options.transientId]
    , self = this

  if (!node) {
    throw new Error('No transient node')
  }

  node.id = id
  this.nodes[id] = node
  delete this.nodes[this.options.transientId]

  var l = this._layout[this.options.transientId]
  if (l) {
    l.id = id
    this._layout[id] = l
    delete this._layout[this.options.transientId]
  }
  this._rebind(function (enter, update, exit) {
    update.call(self.updater)
  })
}

Tree.prototype.removeTransient = function () {
  this.removeNode(this.options.transientId)
}

module.exports = Tree
