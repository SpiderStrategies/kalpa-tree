import * as d3 from 'd3-selection'
import DnD from './lib/dnd.js'
import { drag } from 'd3-drag'
import { EventEmitter } from 'events'
import regexEscape from 'escape-string-regexp'
import util from 'util'
import enter from './lib/enter.js'
import flyExit from './lib/fly-exit.js'
import slideExit from './lib/slide-exit.js'
import update from './lib/update.js'
import layout from './lib/layout.js'
import contents from './lib/contents.js'

const styles = window.getComputedStyle(document.documentElement, '')
    , identity = v => f
    , prefix = Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)[0]

// Mix transitions into d3-selection's prototype
import 'd3-transition'

var merge = function (from, to) {
  to = to || {}
  for (var prop in from) {
    to[prop] = from[prop]
  }
  return to
}

var getObject = function (store, obj) {
  return store[obj && typeof obj === 'object' ? obj.id : obj]
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
    dndDelay: 250, // Time between a mousedown/mouseup event before we allow a dnd move to fire
    scrollableContainer: function () {
      // Default container used for scrolling the tree
      return this.el.select('.tree').node()
    },
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
    contents,
    indentableSelector: ':first-child', // The element within the `.node` which will be used for showing tree indentations
                                        // Only need to update if using different `contents`
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

  this.options.scrollableContainer = this.options.scrollableContainer.bind(this)
  this._isRtl = document.documentElement.getAttribute('dir') === 'rtl'
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
                       .classed('editable', this.options.editable) // In case trees are initialized with `editable: true`
                       .on('scroll', function () {
                         var scroll = self.options.scrollableContainer().scrollTop
                         if (!self._scrollTop) {
                           self._scrollTop = scroll
                         }

                         if (Math.abs(scroll - self._scrollTop) > self.options.height) {
                           self.adjustViewport()
                           self._scrollTop = scroll
                         }
                       }, { passive: true }) // We'll adjust viewport after the browser has finished its native scrolling
                       .classed('forest-tree', this.options.forest)
                       .append('ul')
                         .selectAll('li.node')

  // Internal structure holding the node's layout data
  this._layout = []

  // Public node data. The tree won't modify the objects in this structure
  this.nodes = {}

  this.root = this.options.forest ? [] : null

  /*
   * When loading the tree, we could overwhelm the browser if we're
   * supposed to draw each node as it arrives (e.g. if there are a lot of immediate children from root).
   * This slows down the number of times we try to draw the tree, by using rAF
   */
  let scheduledRaf = null
    , draw = (done) => {
      if (scheduledRaf) {
        // We're already waiting for the browser to draw the tree, ignore
        return
      }
      scheduledRaf = requestAnimationFrame(() => {
        this._fly()
        scheduledRaf = null
        if (done) {
          done()
        }
      })
    }

  this.options.stream.on('data', function (n) {
    let _n = self._store(n) // Internal store tracking nodes and layout

    if (self.options.initialSelection == _n.id) {
      self.select(_n.id, { silent: true, animate: false })
    } else if (!_n.collapsed || (_n.parent && !_n.parent.collapsed)) {
      // Need to draw the tree to show the incoming node if
      // we have a parent and its show its children, or the node was set to expand (probably a root)
      draw()
    }
    self.emit('node', n)
  })
  .on('end', () => {
    if (scheduledRaf) {
      // A draw is queued. Cancel it, so we can queue a new function which will
      // allow us to fire an event indicating the tree is loaded and rendered
      window.cancelAnimationFrame(scheduledRaf)
      scheduledRaf = null
    }
    draw(() => {
      // The tree has been painted in the DOM
      self.emit('rendered')
    })
  })

  return this
}

/*
 * Translates a `x` value based on the browser RTL
 */
Tree.prototype._rtlTransformX = function (x) {
  return this._isRtl ? -x : x
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

    if (animate) {
      setTimeout(function () {
        self.el.select('.tree').classed('transitions', false)
      }, self.transitionTimeout)
    }

    var result = fn.apply(self, arguments)

    return result
  }
}

Tree.prototype.adjustViewport = function () {
  if (this._tuned) {
    var self = this
      , next = function (enter, update, exit) {
                 enter.call(self.enter, function (d) {
                   return 'translate(0px,' + d._y + 'px)'
                 })
                 update.call(self.updater)
                 exit.remove()
               }
    this._filteredResults ? this._join(this._filteredResults, next) : this._rebind(next)
  }
}

Tree.prototype._clearFilter = function () {
  // Any rebind of data removes the filtered-results class
  this.el.select('.tree')
         .classed('filtered-results', false)
         .on('.filtered-click', null)

  this._filteredResults = null

  return this
}

/*
 * Rebinds the data to the selection based on the data model in the tree.
 */
Tree.prototype._rebind = function (next) {
  this._clearFilter()
      .el
      .select('.tree')
      .classed('detached-root', !!this._rootOffset)

  var data = this.layout(this.root)
  this.emit('rebind', data) // Trigger an event indicating the tree data changed
  return this._join(data, next)
}

/*
 * Joins the data to the dom selection, and invokes the `next` callback
 * passing the enter, update, and exit selections
 */
Tree.prototype._join = function (data, next) {
  var self = this
    , height = 'auto'
    , n = this.options.scrollableContainer()
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
      // Make sure the tree isn't animating
      this.el.select('.tree').classed('transitions', false)
      height = last._y + this.options.height + this._rootOffset + 'px'
    }
  }

  this.resize(data.length)
  this.el.select('.tree ul')
           .style('height', height)
  this.emit('change:height', height)

  var _node = this.el.select('.tree ul')
                     .selectAll('li:not(.outgoing-node)') // Ignore outgoing nodes, because they are about to be removed from the DOM.
                     .data(data, function (d) {
                       return d[self.options.accessors.id]
                     })
    , enter = _node.enter()
                   .insert('li')
                   .classed('node', true) // enter should take care of this, but
                                          // see Impact #32542. For some reason performanced tuned dnd scrolling
                                          // causes issues. This is a hack
    , exit = _node.exit()
    , update = this.node = enter.merge(_node)

  if (exit.size()) {
    // Nodes are being removed, trigger an event for interested parties
    this.emit('rebind:exit', exit)
  }

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

  // Make sure the highest node in the tree is denoted in case styling needs to be changed on that node.
  update.classed('kalpa-top-node', function (d) {
    return d._y === 0
  })

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

  this._rebind(function (enter, update, exit) {
    enter.call(self.enter, function (d) {
            // if there's a source, enter at that source's position, otherwise add the node at its position
            return 'translate(0px,' + (source ? source._y : d._y) + 'px)'
          }, 'fading-node transition-placeholder')
    update.call(function (selection) {
      // Remove the fading-node class, now that it's in the dom
      selection.classed('fading-node', false)
      // Then remove the transition-placeholder class once the transitions have run
      setTimeout(function () {
        selection.classed('transition-placeholder', false)
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
  var node = getObject(this._layout, obj)
  if (!node) {
    return null
  }
  var parent = node.parent
  return parent && this.nodes[parent.id]
}

/*
 * Returns a node's children. This includes all visible and invisible children
 */
Tree.prototype.children = function (obj) {
  var node = getObject(this._layout, obj)
    , self = this

  if (!node) {
    return []
  }

  return (node._allChildren || []).map(function (n) {
    return self.nodes[n.id]
  })
}

/*
 * Returns a node's siblings
 */
Tree.prototype._siblings = function (obj) {
  var node = getObject(this._layout, obj)

  if (!node) {
    return
  }

  return node.parent ? node.parent._allChildren : this.options.forest ? this.root : []
}

/*
 * Returns an object with containing a node's siblings along with
 * its index within those siblings
 */
Tree.prototype._indexOf = function (obj) {
  var node = getObject(this._layout, obj)
    , siblings = this._siblings(obj)

  if (!siblings) {
    return
  }

  return siblings.indexOf(node)
}

/*
 * Returns a node's next sibling
 */
Tree.prototype.nextSibling = function (obj) {
  if (!obj) {
    return
  }

  var idx = this._indexOf(obj)

  if (idx == null) {
    return
  }

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
Tree.prototype.move = function (node, to, idx, expandAncestors = true) {
  var _node = getObject(this._layout, node)
  if (!node) {
    return
  }

  var _to = this._layout[to !== null && typeof to === 'object' ? to.id : to]

  if (_to) {
    this._removeFromParent(_node)
    delete _to.collapsed
    var children = (_to._allChildren || (_to._allChildren = []))
    children.splice(typeof idx === 'number' ? idx : children.length, 0, _node)
    _node.parent = _to
    if (expandAncestors) {
      this._expandAncestors(_to)
    }
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
 * Copies a node to some new parent.
 *
 * `to` is the node we're copying to. Can be the node or id. If it's not
 *      defined and the tree is a forest, the node will be copied to a new root
 *      node of the forest tree.
 * `idx` used to insert the node at this index within the `to`'s children
 * `transformer` can be used to transform each node that will be copied.
 * `expandAncestors` is used to expand the ancestors of the node when it's copied, so
 *      the copied node will be visible.
 */
Tree.prototype.copy = function (node, to, idx, transformer = identity, expandAncestors = true) {
  var _node = getObject(this._layout, node)

  if (!_node) {
    return
  }

  // We need a clone of the node and the layout
  var self = this
    , _to = getObject(this._layout, to)

  this._descendants(_node)
      .map(function (node) {
        var result = {
          transformed: transformer(util._extend({}, self.nodes[node.id])),
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
            let children = _to._allChildren || (_to._allChildren = [])
            children.splice(typeof idx === 'number' ? idx : children.length, 0, d)

            if (expandAncestors) {
              self._expandAncestors(_to)
            }

            _to.collapsed = false
          } else if (self.options.forest) {
            self.root.splice(typeof idx === 'number' ? idx : self.root.length, 0, d)
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
 * If nothing is passed to select or the incoming `id` isn't in the tree, we deselect the currently
 * selected node.
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

    this._onSelect(null, d, opt)
  } else {
    // We don't have this node to select, clear the selected node
    this._deselect()
    this.node.classed('selected', d => d.selected)
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
  var n = this.options.scrollableContainer()

  if (!d) {
    // Defensive exit early if we don't have a node so we don't blow up
    n.scrollTop = 0
    return
  }

  if (d._y < n.scrollTop || (d._y + this.options.height) > n.offsetHeight + n.scrollTop) {
    // Now scroll the node into view if the node is above the top of the container
    // or the bottom of the node is below the container

    if (this.el.select('.tree').classed('transitions')) {
      // We're in the process of transitioning the tree, wait until they are done, then scroll
      setTimeout(function () {
        n.scrollTop = d._y
      }, this.transitionTimeout)
    } else {
      n.scrollTop = d._y
    }

    if (this._tuned) {
      // Where we scrolled may not have anything drawn, so redraw based on the viewport
      this.adjustViewport()
    }
  }
}

/*
 * tree_.selected stores a previously selected node. If there's a selected node,
 * this clears the selected node and returns its id
 */
Tree.prototype._deselect = function () {
  if (this._selected) {
    let prev = this._selected.id
    delete this._selected.selected // delete the selected field from that node
    this._selected = null
    return prev
  }
}

Tree.prototype._onSelect = function (e, d, opt) {
  opt = opt || {}

  // determines if we should toggle the node. We don't toggle if it's the root node
  // or the node is already expanded, but not selected.
  let toggle = opt.toggleOnSelect && !(!d.collapsed && !d.selected) && d !== this.root
    , prev = this._deselect()

  d.selected = true
  this._selected = d

  this._expandAncestors(d)

  if (toggle) {
    this.toggle(d, opt)
  } else {
    // We're not showing or hiding nodes, it will just be an update
    this._transitionWrap(this._fly, opt.animate)(d)
  }

  // Adjust selected properties
  this.node.classed('selected', d => d.selected)
           .classed('selecting', d => d.selected && d.id !== prev) // Mark as `selecting` if it's newly selected

  // Trigger a reflow to start any transitions
  this._forceRedraw()

  // Now the node is no longer `selecting`
  this.node.classed('selecting', false)

  this._scrollIntoView(d, opt)

  if (!opt.silent) {
    this.emit('select', this.nodes[d.id])

    setTimeout(function () {
      this.emit('selected')
    }.bind(this), this.el.select('.tree').classed('transitions') ? this.transitionTimeout : 0)
  }
}

Tree.prototype._onToggle = function (e, d) {
  e.stopPropagation()
  if (d === this.root) {
    // Never toggle root
    return
  }
  this.toggle(d)
}

/*
 * Adds the node to our incoming data store. Returns the layout node
 */
Tree.prototype._store = function (node, parent, idx) {
  if (this._layout[node.id]) {
    // can't add a node that we already have
    return this._layout[node.id]
  }

  this.nodes[node.id] = node // Add the node in its incoming form to nodes

  var p = parent || this._layout[node.parentId]
    , _n = this._layout[node.id] = { // internal version which we'll use to modify the node's layout
      id: node.id,
      collapsed: typeof node.collapsed === 'undefined' ? true : node.collapsed // by default incoming nodes are collapsed
    }

  if (node.visible === false) {
    _n.visible = false
  }

  if (p) {
    // Node has a parent (i.e. not a root)
    _n.parent = p

    let children = (p._allChildren || (p._allChildren = []))

    if (typeof idx !== 'undefined' && idx !== null) {
      children.splice(idx, 0, _n)
    } else {
      // Simple array that we use to keep track of children
      children.push(_n)
    }
  } else {
    // Some type of root nodes. We treat those as expanded nodes
    if (this.options.forest) {
      this.root.splice(typeof idx === 'number' ? idx : this.root.length, 0, _n)
    } else {
      _n.collapsed = false
      this.root = _n
    }
  }

  return _n
}

/*
 * Adds a new node to the tree. Pass in d as the data that represents
 * the node, parent (which can be the parent object or an id), and an optional
 * index. If the index is sent, the node will be inserted at that index within the
 * parent's children.
 *
 * Receives optional `opts`, which supports:
 *    `expand`: defaults to true, which will expand the incoming node's parent if the parent is selected
 */
Tree.prototype.add = function (d, parent, idx, opts = { expand: true }) {
  if (this._layout[d.id]) {
    // Already have this node, ignore
    return
  }

  // Turn parent into a parent object
  parent = this._layout[parent !== null && typeof parent === 'object' ? parent.id : parent]

  if (opts.expand && parent && parent.selected && parent.collapsed) {
    // The parent is selected and collapsed, we want to expand its children (#259)
    delete parent.collapsed
    // Show the children immediately
    this._fly()
    this._forceRedraw()
  }

  let _d = this._store(d, parent, idx)

  this._transitionWrap(this._slide)()

  return d
}

/*
 * Adds multiple nodes to the tree. This is more efficient than invoking `.add` on each node
 * as it only draws the nodes once, after the internal tree representation has been updated.
 * Each node in the array should contain the arguments that should be passed to `.add`:
 *  ```
 *  {
 *    data: // the node's data
 *    parent: // optional parent of the node
 *    idx: // idx to insert in the parent
 *  }
 *  ```
 * This method does not expand any nodes.
 *
 */
Tree.prototype.addAll = function (nodes = []) {
  nodes.forEach(node => {
    if (this._layout[node.data.id]) {
      // ignore this node. already in the tree
      return
    }
    // Turn parent into a parent object
    let parent = this._layout[node.parent !== null && typeof node.parent === 'object' ? node.parent.id : node.parent]

    this._store(node.data, parent, node.idx)
  })

  this._transitionWrap(this._slide)()
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
    , self = this
  tree.classed('editable', !tree.classed('editable'))
  this._join(this.layout(this.root), function (enter, update, exit) {
    // Changing editable will change the tree state, e.g. clearing search results
    // so update all the collections
    enter.call(self.enter)
    update.call(self.updater)
    exit.remove()
  })
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
        if (self._tuned) {
          // If we're tuned, expanding all might force new nodes into the viewport and the old nodes need to be removed from the dom
          exit.remove()
        }
      })
    })()
  } else {
    self._rebind(function (enter, update, exit) {
      enter.call(self.enter, function (d) {
             return 'translate(0px,' + d._y + 'px)'
           })
      update.call(self.updater)
      exit.remove()
    })
  }
}

Tree.prototype.collapseTo = function (depth) {
  this._toggleAll(function (d) {
    if (d.depth >= depth) {
      d.collapsed = true
    }
  })
  var self = this

  if (Object.keys(this._layout).length < this.options.maxAnimatable) {
    this._transitionWrap(function () {
      self._rebind(function (enter, update, exit) {
        enter.call(self.enter) // Seems odd, but needed in case we're showing a subset of the tree (i.e. filtered results)
        update.call(self.updater)
        exit.call(self.flyExit, null, function (d) {
          let c, p
          c = p = d.parent

          // Determine our top ancestor
          while (p.parent) {
            c = p
            p = p.parent
          }

          // Move this node to the ancestors location
          return 'translate(0px,' + c._y + 'px)'
        })
      })
    })()
  } else {
    self._rebind(function (enter, update, exit) {
      enter.call(self.enter)
      update.call(self.updater)
      exit.remove()

      // If we just collapsed a big tree, make sure we adjust the scrollTop so the nodes are in view.
      // See https://github.com/SpiderStrategies/Scoreboard/issues/20332
      self._scrollIntoView(self._selected)
    })
  }
}

Tree.prototype.collapseAll = function () {
  return this.collapseTo(Number.NEGATIVE_INFINITY)
}

/*
 * Makes modifications to tree node(s). Can update a single node, an array of patch
 * changes, or a stream that emits data events with the node and the changes
 *
 * @param [options.patch=true] If false is passed attributes that were removed on obj will be removed from the tree model also.
 */
Tree.prototype.edit = function (obj, opts) {
  opts = opts || {}

  if (typeof opts.patch === 'undefined') {
    opts.patch = true
  }

  if (typeof obj === 'object' && obj.id && this.nodes[obj.id]) {
    this._edit(obj, opts)
    this._transitionWrap(this._slide)(this._layout[obj.id])
  } else if (Array.isArray(obj)) {
    Object.keys(obj).forEach(key => this._edit(obj[key], opts)) // Loop over the keys rather than `obj.forEach`, b/c the incoming array could have a massive index,
                                                                // which makes obj.forEach super slow.
    this._transitionWrap(this._slide)()
  } else if (typeof obj.on === 'function' ) {
    // Assume it's a stream.
    var self = this
    obj.on('data', function (d) {
         self._edit(d, opts)
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
Tree.prototype._edit = function (obj, opts) {
  var d = this.nodes[obj.id]
    , _d = this._layout[obj.id]

  if (d) {
    d = opts.patch ? merge(obj, d) : obj
    this.nodes[obj.id] = d

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
 * Removes a node from the tree. obj can be the node id or the node itself.
 * Supports an options argument, where `animate: false` can be set to disable
 * animations
 */
Tree.prototype.removeNode = function (obj, opt = {}) {
  var node = getObject(this.nodes, obj)

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
      if (self._tuned) {
        // If we're tuned we may have entering nodes because they weren't previously in the DOM, but they are now since they are "moving up".
        // We don't need to call enter most of the time because the nodes are already in the DOM
        enter.call(self.enter)
      }
      update.call(self.updater)
      exit.call(self.slideExit, _node)
    })
  }, opt.animate)()
}

/*
 * Filter nodes in the tree. Passing in null clears the filtered tree
 */
Tree.prototype.filter = function (fn) {
  if (fn == null) {
    let selected = this._selected // default to the previously selected node
    if (!selected) {
      // Previously didn't have a selected node, so we'll select the root node
      if (this.options.forest) {
        // Top of the forest if it has nodes
        selected = this.root.length ? this.root[0] : null
      } else {
        selected = this.root
      }
    }
    return this.select(selected && selected.id, {
      force: this.el.select('.tree').classed('filtered-results'),
      silent: true
    })
  }

  var self = this
    , data = Object.keys(this.nodes)
                   .filter(function (k) {
                     return fn.call(self, self.nodes[k])
                   })
                   .map(function (key, i) {
                     var _d = self._layout[key]
                     _d._x = 0
                     _d._y = i * self.options.height
                     return _d
                   })

  this._transitionWrap(function () {
    this.el.select('.tree').classed('filtered-results', true)
                           .classed('detached-root', false)
                           .on('click.filtered-click', function () {
                             // Capture the click event at the tree level, and collapse all nodes
                             // before the actual node is selected
                             self._toggleAll(function (d) {
                               d.collapsed = true
                             })
                           }, true)
    this._filteredResults = data
    var performanceThreshold = this.options.performanceThreshold // Store the default option
    this.options.performanceThreshold = 0 // Overwrite so we force performance tuning while showing search results
                                          // since users might type quickly, overloading the browser as we update the dom nodes
    this._join(data, function (enter, update, exit) {
      enter.call(self.enter)
      update.call(self.updater)
      exit.remove() // No animations on exit
      self.options.performanceThreshold = performanceThreshold // reset the performance threshold to the original
    })
  })()
}

/*
 * Search will filter tree nodes based on the label accessor matching
 * the incoming term.
 */
Tree.prototype.search = function (term) {
  if (!term) {
    return this.filter(null) // clear it if term is falsy
  }

  var re = new RegExp(regexEscape(term) || '', 'i')
    , self = this
  this.filter(function (node) {
        return re.test(node[self.options.accessors.label]) && node.visible !== false
      })
}

Tree.prototype._toggle = function (d, collapsed, opt) {
  var _d = getObject(this._layout, d)
  opt = opt || {}
  _d.collapsed = collapsed
  this._transitionWrap(this._fly, opt.animate)(_d)
}

/*
 * Used to toggle the node's children. If they are visible this will hide them, and
 * if they are hidden, this will show them.
 */
Tree.prototype.toggle = function (d, opt) {
  var _d = getObject(this._layout, d)
  return this._toggle(d, !_d.collapsed, opt)
}

/*
 * Expand a node's children
 */
Tree.prototype.expand = function (d, opt) {
  return this._toggle(d, false, opt)
}

/*
 * Collapse a node's children
 */
Tree.prototype.collapse = function (d, opt) {
  return this._toggle(d, true, opt)
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

/*
 * Delegates to `removeNode` for the transient node.
 */
Tree.prototype.removeTransient = function (opts) {
  this.removeNode(this.options.transientId, opts)
}

/*
 * Returns the currently expanded nodes
 */
Tree.prototype.expandedNodes = function () {
  return this._layout.filter(node => !node.collapsed)
                     .map(node => this.nodes[node.id])
}

export default Tree
