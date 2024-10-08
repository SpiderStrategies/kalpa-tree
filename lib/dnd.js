import * as d3 from 'd3-selection'
import update from './update.js'

const startMs = 300

var clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

var Dnd = function (tree) {
  var self = this
  this.tree = tree
  this.updater = update(tree)
  this._travelerTimeout = null
  this.traveler = null

  /*
   * Expose public functions used by the d3 drag listener,
   * passing the node (`this`) into each of our private handlers
   */
  this.start = function (e, d, i) {
    // When dnd starts, register a touchmove event listener on the
    // window that will prevent future touch move events from running
    // This is needed because d3 registers a touchmove on the window that prevents default, which
    // prevents the tree from scrolling
    d3.select(window)
      .on('touchmove.dnd', function () {
        // When the touchmove fires on the window, clear the traveler timeout, so we don't try
        // to create to dnd, since the user is trying to scroll.
        if (self._travelerTimeout) {
          clearTimeout(self._travelerTimeout)
        }
        e.stopPropagation()
      }, true) // Capture mode so we capture the event first to prevent future touch move events

    self._start(d, i, this)
    self._startMs = new Date
  }

  this.drag = function (e, d, i) {
    self._autoscroll(e, d, self.tree, e.y)
    self._drag(e, d, i, this)
  }

  this.end = function (e, d) {
    d3.select(window)
      .on('touchmove.dnd', null) // Remove our listener hack

    if (self.traveler && (new Date() - self._startMs < self.tree.options.dndDelay)) {
      self._restore()
      // D3 dnd code overrides all the events. We want to treat this is as a normal click, in case
      // some outside code has an event listener attached. After this current event loop has finished
      // fire the normal click event.
      var node = this
      process.nextTick(function () {
        node.click()
      })
    }
    self._end(d, this)
  }
}

Dnd.prototype._createTraveler = function (d, i, node) {
  this._travelerTimeout = null
  var treeNode = this.tree.el.select('.tree').node()
    , placeholder = d3.select(node)
                      .classed('placeholder', true)

  this._dragging = true

  d3.select(window)
    .on('keydown.tree-escape', this._escape.bind(this, node))

  // Now that we know we're in edit mode with a traveling node, disable touch move on the window, which
  // is what d3 would do if we didn't stopPropagation on dnd start.
  d3.select(window)
    .on('touchmove.dnd', function (e) {
      e.preventDefault()
    }, true)

  this.traveler = d3.select(document.createElement('div'))
                    .attr('class', node.className)
                    .classed('traveling-node', true)
                    .classed('forest-traveler', this.tree.options.forest)
                    .classed('selected', placeholder.classed('selected'))
                    .datum(d) // Set the data to the actual node, so the contents is drawn correctly
                    .style(this.tree.prefix + 'transform', function (d) {
                      return 'translate(0px,' + (d._y - treeNode.scrollTop) + 'px)'
                    })
                    .call(this.tree.options.contents, this.tree, false)
                    .datum({ // Now override it
                      _source: d,
                      _initialParent: d.parent && d.parent.id,
                      _initialIndex: this._getIndex(d),
                      embedded: false
                    })

  this.tree.el.node().appendChild(this.traveler.node())

  this.tree.emit('dndstart', {
    traveler: this.traveler.node(),
    data: this.tree.nodes[d.id],
    el: node,
    layout: d
  })

  if (d.children) {
    this.tree.toggle(d)
  }
}

Dnd.prototype._getIndex = function (d) {
  var idx = d.parent && d.parent._allChildren.indexOf(d)

  if (typeof idx !== 'number' && this.tree.options.forest) {
    idx = this.tree.root.indexOf(d)
  }
  return idx
}

Dnd.prototype._start = function (d, i, node) {
  if (!this.tree.isEditable() || this.tree.el.select('.tree').classed('filtered-results')) {
    return
  }

  if (!this.tree.options.forest && d._y === 0) {
    // prevent the root from moving in non forest trees
    return
  }

  this._travelerTimeout = window.setTimeout(this._createTraveler.bind(this, d, i, node), startMs)
}

Dnd.prototype._restore = function () {
  var data = this.traveler.datum()
    , self = this

  this._remove(data._source)

  if (this.tree.options.forest && !data._initialParent) {
    // It was originally a root node in a forest tree
    this.tree.root.splice(data._initialIndex, 0, data._source)
  } else {
    this.tree._layout[data._initialParent]._allChildren.splice(data._initialIndex, 0, data._source)
  }

  this.tree._rebind(function (enter, update, exit) {
    update.call(self.updater)
  })

  return this
}

Dnd.prototype._escape = function (node, e) {
  // If it's the escape, then cancel
  if (e.keyCode === 27) {
    this.tree.emit('dndcancel')

    this._restore()
        ._end(this.traveler.datum()._source, node)
  }
}

/*
 * Removes the node from its current position in the tree
 */
Dnd.prototype._remove = function (node) {
  // If it has a parent with _collapsedChildren, move those
  // _collapsed children back to _allChildren, and denote the node as collapsed
  if (node.parent && node.parent._collapsedChildren) {
    node.parent._allChildren = node.parent._collapsedChildren
    node.parent._collapsedChildren = null
    node.parent.collapsed = true
  }

  this.tree._removeFromParent(node)
}

Dnd.prototype._autoscroll = function (e, d, tree, y) {
  if (this._autoscrollTimeout) {
    // Prevent race conditions
    window.clearTimeout(this._autoscrollTimeout)
    this._autoscrollTimeout = null
  }

  if (!this._dragging) {
    return
  }

  if (y < this.tree.options.height) {
    // Don't bother autoscrolling if y position (i.e. the traveling node)
    // is above the top node of the tree
    return
  }

  var node = tree.el.select('.tree').node()
    , threshold = 30
    , pixels = 10

  if (y - threshold < node.scrollTop) {
    // Slide the tree up
    scroll.call(this, pixels * -1)
  } else if (y + threshold > node.scrollTop + node.offsetHeight) {
    // Slide down
    scroll.call(this, pixels)
  }

  function scroll (pixels) {
    node.scrollTop += pixels
    y += pixels

    if (!e) {
      // We've been told to scroll the tree, and there isn't an event, which means
      // we're auto scrolling based on the mouse position
      this._move(y, d)
    }
    this._autoscrollTimeout = setTimeout((function () {
      this._autoscroll(null, d, tree, y)
    }).bind(this), 10)
  }
}

/*
 * Returns the target node if the user lifts their mouse. It's pretty confusing
 * but it's more of the target node placeholder. It doesn't take into account whether or
 * not we're embedding the node
 */
Dnd.prototype._getTarget = function (_y) {
  var top = _y + (this.tree.options.height / 2) - this.tree._rootOffset // Top of the traveling node
    , last = d3.select(this.tree.node.nodes()[this.tree.node.size() - 1]).datum()._y // last node currently displayed in the tree
    , threshold = Math.min(top - (top % this.tree.options.height), last)

  return this.tree.node.filter(function (d) {
                          return d._y >= threshold
                       })
                       .nodes()[0] // Return the first
}

Dnd.prototype._isEmbedded = function (d, target, previous, _y) {
  var threshold = target._y - 8
    , embed = threshold >= _y
    , p = target.parent
    , c = p && p.children || []

  if (previous === target) {
    // When this is called, we're in a virtual state, meaning the previous node hasn't actually moved yet.
    // If previous is the target, that means the previous will eventually bump up a spot. If that's the case
    // We want to be embedded since the target will be the first child
    return true
  }

  if (c.length > 1 && c[0] === target) {
    // There are children, and the target is the first one
    embed = true
  }

  if (d !== target && c[0] === target) {
    // We're moving the node, `d` to the target, the target is the first child, so it must be embedded
    embed = true
  }

  return embed
}

/*
 * Returns the node in the tree that is visually right before
 * the target node.
 */
Dnd.prototype._previous = function (d, target) {
  var p = this.tree.node.filter((function (d) {
                          // Ignore offsets when determining the previous node based on _y position
                          return Math.max(d._y - this.tree._rootOffset, 0) === target._y - this.tree.options.height - this.tree._rootOffset
                        }).bind(this)).nodes()[0]

  if (p) {
    p = d3.select(p).datum()
    if (p === d) {
      // The user is moving down, and the before node matched to the target. That's because
      // the target hasn't actually been replaced
      return target
    }
    return p
  }

  return null
}

Dnd.prototype._parent = function (d, target, previous, embedded) {
  if (embedded) {
    return previous
  } else {
    if (d === target) {
      // Dropping onto ourself and no longer indented, which means
      // Our new parent is our previous grandparent
      return target.parent && target.parent.parent
    } else {
      return target.parent
    }
  }
}

Dnd.prototype._getDropIndex = function (d, children, target, previous, embed) {
  if (embed) {
    // If it's embedded, it's always inserted as the first child
    return 0
  }

  if (target._y >= d3.select(this.tree.node.nodes()[this.tree.node.size() - 1]).datum()._y) {
    // The target is the last node, so we're moving it to the bottom
    return children.length
  }

  var idx = children.indexOf(target)

  if (idx === -1) {
    // Then the target isn't part of this children set yet, so use the previous node
    idx = children.indexOf(previous) + 1
  }

  return idx
}

Dnd.prototype._children = function (d, parent, children) {
  var children = null
  if (!parent && this.tree.options.forest) {
    children = this.tree.root
  } else if (parent.collapsed && parent._allChildren) {
    // Dropping onto a collapsed node with children.
    parent._collapsedChildren = parent._allChildren
    children = parent._allChildren = []
    parent.collapsed = false
  } else {
    children = parent._allChildren || (parent._allChildren = [])
    parent.collapsed = false
  }
  return children
}

/*
 * A traveling node is `illegal` if it's not droppable (based on the user defined droppable callback) or
 * its parent is a transient node.
 */
Dnd.prototype._isIllegal = function (source, newParent, beforeDragState) {
  let node = Object.assign({}, this.tree.nodes[source.id], {
    beforeDragState // Tack the original state before dnd started onto the node
  })
  return ((newParent && newParent.id) == this.tree.options.transientId)
         || !this.tree.options.droppable.call(this.tree, node, this.tree.nodes[newParent && newParent.id])

}

Dnd.prototype._move = function (y, d) {
  var self = this
    , treeNode = this.tree.el.select('.tree').node()
    , lowerBound = treeNode.offsetHeight + treeNode.scrollTop - self.tree.options.height
    , upperBound = self.tree.options.forest ? treeNode.scrollTop : treeNode.scrollTop + self.tree.options.height / 2 + this.tree._rootOffset
    , _y = clamp(y - (self.tree.options.height / 2), upperBound, lowerBound) // The travelers y position for the middle of the node
    , target = d3.select(this._getTarget(_y)).datum() // The node that's going to be replaced
    , previous = self._previous(d, target)
    , embed = this._isEmbedded(d, target, previous, _y)

  this.traveler.datum(function (d) {
    d._y = _y
    if (d._source != target || d.embedded != embed) {
      // This means we're modifying the data in the tree or the node's embedded property has now changed
      var newParent = self._parent(d._source, target, previous, embed)
        , illegal = false
        , originalState = {
          index: d._initialIndex,
          parent: d._initialParent
        }

      if (self._isIllegal(d._source, newParent, originalState)) {
        illegal = true
        // This is an illegal operation.
        if (embed) {
          // They were trying to embed the node, but that's not allowed, so make this not embedded, and grab the new parent
          if (newParent.parent) {
            newParent = newParent.parent // Safe to reassign the new parent since it's defined
          } else if (self.tree.options.forest) {
            newParent = undefined // Forest tree can have empty new parents, meaning this moving node would become a new root
                                  // This is needed to prevent newParent being undefined for non forest trees, which doesn't make sense.
          }
          embed = false
          illegal = self._isIllegal(d._source, newParent, originalState)
        }
      }

      d.illegal = illegal

      var children = self._children(d._source, newParent, children)
        , idx = self._getDropIndex(d._source, children, target, previous, embed)

      // Remove the node from its current location
      self._remove(d._source)

      // Add it to the children
      children.splice(idx, 0, d._source)

      // Store a property on the traveler's data indicating whether it was previously embedded on next move
      d.embedded = embed

      self.tree._transitionWrap(function () {
        self.tree._rebind(function (enter, update, exit) {
          update.call(self.updater)
          exit.remove()

        })
      }, true, true)()
    }

    self.tree.emit('dndmove', {
      traveler: this,
      data: self.tree.nodes[d._source.id],
      layout: d._source
    })

    return d
  })
  .style(self.tree.prefix + 'transform', function (d) {
    // Move the traveling node to its new y position, adjusting for scrolling within the tree container
    return 'translate(0px,' + (d._y - treeNode.scrollTop) + 'px)'
  })
  .classed('illegal', function (d) {
    return d.illegal
  })
  .select(this.tree.options.indentableSelector)
    .attr('style', function (d) {
      // Set the indentation of the traveling node to equal the original node's position, since it
      // will be moved automatically
      let indentValue = `${self.tree._rtlTransformX(d._source._x)}px`
      return `${self.tree.prefix}transform:translate(${indentValue}, 0px); width: calc(100% - ${d._source._x}px)`
    })
}

Dnd.prototype._drag = function (e, d, i, node) {
  var self = this

  if (this._travelerTimeout) {
    window.clearTimeout(this._travelerTimeout)
    this._createTraveler.call(this, d, i, node)
  }

  if (!this._dragging) {
    return
  }
  this.tree.el.select('.tree').classed('dragging', true)
  this._move(e.y, d)
}

Dnd.prototype._end = function (d, node) {
  d3.select(window).on('keydown.tree-escape', null)

  if (this._travelerTimeout) {
    window.clearTimeout(this._travelerTimeout)
    delete this._travelerTimeout
  }

  if (!this._dragging) {
    return
  }

  delete this._dragging
  this.tree.node.classed('placeholder', false)

  this.tree.emit('dndstop', {
    traveler: this.traveler.node(),
    data: this.tree.nodes[d.id],
    el: node,
    layout: d
  })

  if (this.traveler) {
    var travelerData = this.traveler.datum()

    if (travelerData.illegal) {
      // Restore the initial state if they dropped illegally
      this._restore()
    }

    var newIndex = this._getIndex(d)

    if (!travelerData.illegal && (travelerData._initialParent !== (d.parent && d.parent.id) ||
        travelerData._initialIndex !== newIndex)) {
      if (d.parent && d.parent._collapsedChildren) {
        // The node was dropped onto another node that had hidden children, expand the new drop location
        d.parent._allChildren = d.parent._collapsedChildren.concat(d.parent._allChildren[0])
        d.parent._collapsedChildren = null
        this.tree._transitionWrap(this.tree._fly, true, true)(d.parent)
      }
      this.tree.emit('move', this.tree.nodes[d.id],
                             d.parent ? this.tree.nodes[d.parent.id] : null,
                             this.tree.nodes[this.traveler.datum()._initialParent],
                             d.parent ? d.parent._allChildren.indexOf(d) : this.tree.root.indexOf(d),
                             this.traveler.datum()._initialIndex)
    }

    this.traveler.remove()
    this.traveler = null
  }

  this.tree.el.select('.tree').classed('dragging', false)
}

export default Dnd
