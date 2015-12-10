var d3 = require('d3')
  , update = require('./update')
  , startMs = 300

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
  this.start = function (d, i) {
    self._start(d, i, this)
  }

  this.drag = function (d, i) {
    self._autoscroll(d, self.tree, d3.event.y)
    self._drag(d, i, this)
  }

  this.end = function (d) {
    self._end(d)
  }
}

Dnd.prototype._createTraveler = function (d, i, node) {
  this._travelerTimeout = null
  var placeholder = d3.select(node)
                      .classed('placeholder', true)

  this.traveler = d3.select(document.createElement('div'))
                    .attr('class', 'node traveling-node')
                    .classed('forest-traveler', this.tree.options.forest)
                    .attr('style', placeholder.attr('style'))
                    .html(placeholder.node().innerHTML)
                    .datum({
                      _source: d,
                      _initialParent: d.parent && d.parent.id,
                      _initialIndex: this._getIndex(d),
                      embedded: false
                    })
  this.tree.el.node().appendChild(this.traveler.node())

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
  if (!this.tree.isEditable()) {
    return
  }

  this._dragging = true
  this.tree.emit('dndstart')

  d3.event.sourceEvent.stopPropagation() // prevent clicks if they are dragging

  if (!this.tree.options.forest && d.y === 0) {
    // prevent the root from moving in non forest trees
    return
  }

  this._travelerTimeout = window.setTimeout(this._createTraveler.bind(this, d, i, node), startMs)

  d3.select(window)
    .on('keydown.tree-escape', this._escape.bind(this))
}

Dnd.prototype._escape = function () {
  // If it's the escape, then cancel
  if (d3.event.keyCode === 27) {
    this.tree.emit('dndcancel')

    var data = this.traveler.datum()
    this._remove(data._source)

    if (this.tree.options.forest && !data._initialParent) {
      // It was originally a root node in a forest tree
      this.tree.root.splice(data._initialIndex, 0, data._source)
    } else {
      this.tree._layout[data._initialParent]._allChildren.splice(data._initialIndex, 0, data._source)
    }

    this.tree._rebind()
             .call(this.updater)
    this._end(data._source)
  }
}

/*
 * Removes the node from its curren position in the tree
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

Dnd.prototype._autoscroll = function (d, tree, y) {
  if (this._autoscrollTimeout) {
    // Prevent race conditions
    window.clearTimeout(this._autoscrollTimeout)
    this._autoscrollTimeout = null
  }

  if (!this._dragging) {
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

    if (!d3.event) {
      // We've been told to scroll the tree, and there isn't an event, which means
      // we're auto scrolling based on the mouse position
      this._move(y, d)
    }
    this._autoscrollTimeout = setTimeout((function () {
      this._autoscroll(d, tree, y)
    }).bind(this), 10)
  }
}

/*
 * Returns the dropzone for the traveling node.
 * The incoming variable denotes the top of the traveling node.
 *
 */
Dnd.prototype._getDropzone = function (_y) {
  var top = _y + (this.tree.options.height / 2) // Top of the traveling node
    , last = d3.select(this.tree.node[0][this.tree.node.size() - 1]).datum()._y
    , threshold = Math.min(top - (top % this.tree.options.height), last)

  return this.tree.node.filter(function (d) {
                          return d._y >= threshold
                       })[0][0] // Return the first
}

/*
 * Returns the node before the dropzone
 */
Dnd.prototype._getBefore = function (dropzone) {
  var idx = this.tree.node[0].indexOf(dropzone)
    , before = this.tree.node[0][idx - 1]

  if (before) {
    return d3.select(before).datum()
  } else {
    return null
  }
}

/*
 * Determines if the node should be embedded on the node that's before the dropzone
 */
Dnd.prototype._isEmbedded = function (d, y, before) {
  if (!before && this.tree.options.forest) {
    // It must be a root node for a forest, which means it's not embedded
    return false
  }

  var embed = false
    , threshold = 10
    , diff = y % (before._y + (this.tree.options.height / 2))

  if (diff && diff <= threshold) {
    embed = true
  }

  if (before.children) {
    if (before.children.length > 1) {
      embed = true
    }
    if (before.children.length == 1 && before.children[0] != d) {
      embed = true
    }
  }
  return embed
}

Dnd.prototype._move = function (y, d) {
  var self = this
    , treeNode = this.tree.el.select('.tree').node()
    , lowerBound = treeNode.offsetHeight + treeNode.scrollTop - self.tree.options.height
    , upperBound = self.tree.options.forest ? treeNode.scrollTop : treeNode.scrollTop + self.tree.options.height / 2
    , _y = clamp(y - (self.tree.options.height / 2), upperBound, lowerBound) // The travelers y position for the middle of the node
    , prev = d._y // The previous dropzone position
    , _dropzone = self._getDropzone(_y)
    , dropzone = d3.select(_dropzone).datum()
    , before = this._getBefore(_dropzone)
    , embed = self._isEmbedded(d, _y, before)

  this.traveler.datum(function (d) {
    d._y = _y

    if (dropzone._y !== prev || d.embedded != embed) {
      // This means we're modifying the data in the tree or the node's embedded property has now changed

      // Remove the node from its current location
      self._remove(d._source)

      var newParent = embed ? before : dropzone.parent
        , children = null

      if (dropzone == d._source && !embed) {
        newParent = before && before.parent
      }

      if (newParent == d._source) {
        newParent = dropzone
      }

      if (!newParent) {
        d._source.parent = null
        children = self.tree.root
      } else if (newParent.collapsed && newParent._allChildren) {
        // Dropping onto a collapsed node with children.
        newParent._collapsedChildren = newParent._allChildren
        children = newParent._allChildren = []
        newParent.collapsed = false
      } else {
        children = newParent._allChildren || (newParent._allChildren = [])
        newParent.collapsed = false
      }

      var idx = null
      if (!embed && dropzone === d3.select(self.tree.node[0][self.tree.node.size() - 1]).datum()) {
        // This means the node is being inserted at the very bottom, set it to the end of the parent's children
        idx = children.length
      } else {
        idx = children.length ? children.indexOf(dropzone) : 0
      }

      // If the dropzone was removed because we're sliding left, then its' not in the tree, so get the index of the before node
      // and insert the node after that position
      if (idx == -1) {
        idx = children.indexOf(before) + 1
      }

      children.splice(idx, 0, d._source)
      d.embedded = embed

      self.tree._transitionWrap(function () {
        self.tree._rebind()
                 .call(self.updater)
                 .exit()
                 .remove()
      }, true, true)()
    }
    return d
  })
  .style(self.tree.prefix + 'transform', function (d) {
    // Move the traveling node to its new y position, adjusting for scrolling within the container
    return 'translate(0px,' + (d._y - this.parentNode.firstChild.scrollTop) + 'px)'
  })
  .select('.node-contents')
    .attr('style', function (d) {
      // Set the indentation of the traveling node to equal the original node's position, since it
      // will be moved automatically
      return self.tree.prefix + 'transform:' + 'translate(' + d._source._x + 'px,0px)'
    })
}

Dnd.prototype._drag = function (d, i, node) {
  var self = this

  if (!this._dragging) {
    return
  }
  this.tree.el.select('.tree').classed('dragging', true)

  if (!this.tree.options.forest && d.y === 0) {
    // prevent the root from moving in non forest trees
    return
  }

  if (this._travelerTimeout) {
    window.clearTimeout(this._travelerTimeout)
    this._createTraveler.call(this, d, i, node)
  }

  this._move(d3.event.y, d)
}

Dnd.prototype._end = function (d) {
  d3.select(window).on('keydown.tree-escape', null)

  if (!this._dragging) {
    return
  }

  if (this._travelerTimeout) {
    window.clearTimeout(this._travelerTimeout)
  }

  delete this._dragging
  this.tree.node.classed('placeholder', false)
  this.tree.emit('dndstop')

  if (this.traveler) {
    var travelerData = this.traveler.datum()
      , newIndex = this._getIndex(d)

    if (travelerData._initialParent !== (d.parent && d.parent.id) ||
        travelerData._initialIndex !== newIndex) {
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

module.exports = Dnd
