var d3 = require('d3')
  , update = require('./update')
  , startMs = 300
  , threshold = 10

var Dnd = function (tree) {
  var self = this
  this.tree = tree
  this.updater = update(tree)
  this.timeout = null
  this.traveler = null
  this.maxY = 0

  /*
   * Expose public functions used by the d3 drag listener,
   * passing the node (`this`) into each of our private handlers
   */
  this.start = function (d, i) {
    self._start(d, i, this)
  }

  this.drag = function (d, i) {
    self._drag(d, i, this)
  }

  this.end = function (d) {
    self._end(d)
  }
}

Dnd.prototype._createTraveler = function (d, i, node) {
  this.timeout = null
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
                      _initialIndex: d.parent && d.parent._allChildren.indexOf(d),
                      i: i,
                      embedded: false
                    })

  this.tree.el.node().appendChild(this.traveler.node())

  if (d.children) {
    this.tree.toggle(d)
  }
}

Dnd.prototype._start = function (d, i, node) {
  if (!this.tree.isEditable()) {
    return
  }

  this.tree.el.select('.tree').classed('dragging', true)
  d3.event.sourceEvent.stopPropagation() // prevent clicks if they are dragging

  if (!this.tree.options.forest && d.y === 0) {
    // prevent the root from moving in non forest trees
    return
  }

  this.timeout = window.setTimeout(this._createTraveler.bind(this, d, i, node), startMs)

  d3.select(window)
    .on('keydown.tree-escape', this._escape.bind(this))

  // Set maxY to be the bottom of the tree
  this.maxY = this.tree.node.data()[this.tree.node.data().length - 1]._y
}

Dnd.prototype._escape = function () {
  // If it's the escape, then cancel
  if (d3.event.keyCode === 27) {
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

  // Remove the node from its previous parent
  if (this.tree.options.forest && !node.parent) {
    // forest tree w/ no parent means this node was one of the root nodes
    this.tree.root.splice(this.tree.root.indexOf(node), 1)
  } else {
    var i = node.parent._allChildren.indexOf(node)
    if (i !== -1) {
      node.parent._allChildren.splice(i, 1)
    }
  }
}

Dnd.prototype._drag = function (d, i, node) {
  if (!this.tree.el.select('.tree').classed('dragging')) {
    return
  }

  if (!this.tree.options.forest && d.y === 0) {
    // prevent the root from moving in non forest trees
    return
  }

  if (this.timeout) {
    window.clearTimeout(this.timeout)
    this._createTraveler.call(this, d, i, node)
  }
  var self = this

  this.traveler.datum(function (d) {
    // Set _y to the be max of the root node (so it's not above root) and the center of the node
    //  and the min of that value and the last node's bottom pixel
    var lowerBound = self.maxY + self.tree.options.height
      , upperBound = self.tree.options.forest ? 0 : self.tree.options.height / 2

    d._y = Math.min(Math.max(d3.event.y - (self.tree.options.height / 2), upperBound), lowerBound)
    var prev = d.i
    // Set this index to where it would be in the tree
    d.i = Math.min(~~((d._y + (self.tree.options.height / 2)) / self.tree.options.height), self.tree.node.size() - 1) // can't be greater than the max index

    var source = d._source
      , ci = d.i - prev // change in i
      , before = null
      , dropzone = null
      , embed = false

    if (self.tree.options.forest && d.i === 0) {
      // new top root
      before = {} // mock this thing
      dropzone = d3.select(self.tree.node[0][Math.max(d.i)]).datum()
    } else {
      before = d3.select(self.tree.node[0][Math.max(d.i - 1, 0)]).datum()
      dropzone = d3.select(self.tree.node[0][Math.max(d.i, 0)]).datum()
    }

    var diff = d._y % (before._y + (self.tree.options.height / 2))
    if (diff && diff <= threshold) {
      embed = true
    }

    if (before.children) {
      if (before.children.length > 1) {
        embed = true
      }
      if (before.children.length == 1 && before.children[0] != source) {
        embed = true
      }
    }

    if (ci || d.embedded != embed) {
      // This means we're modifying the data in the tree. The `ci` (change in i) variable changed
      // or the node's embedded  property has now changed

      // Remove the node from its current location
      self._remove(source)

      var newParent = embed ? before : dropzone.parent
        , children = null

      if (dropzone == source && !embed) {
        newParent = before.parent
      }

      if (newParent == source) {
        newParent = dropzone
      }

      if (!newParent) {
        source.parent = null
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
      if (!embed && d.i == self.tree.node.size() -1) {
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

      children.splice(idx, 0, source)
      d.embedded = embed

      self.tree._rebind()
               .call(self.updater)
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

Dnd.prototype._end = function (d) {
  d3.select(window).on('keydown.tree-escape', null)

  if (!this.tree.el.select('.tree').classed('dragging')) {
    return
  }

  if (this.timeout) {
    window.clearTimeout(this.timeout)
  }

  this.tree.node.classed('placeholder', false)

  if (this.traveler) {
    var travelerData = this.traveler.datum()
    if (travelerData._initialParent !== (d.parent && d.parent.id) ||
        travelerData._initialIndex !== d.parent && d.parent._allChildren.indexOf(d)) {
      if (d.parent && d.parent._collapsedChildren) {
        // The node was dropped onto another node that had hidden children, expand the new drop location
        d.parent._allChildren = d.parent._collapsedChildren.concat(d.parent._allChildren[0])
        d.parent._collapsedChildren = null
        this.tree._fly(d.parent)
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
