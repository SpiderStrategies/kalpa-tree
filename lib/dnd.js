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

  this.end = function (d, i) {
    self._end(d, i, this)
  }
}

Dnd.prototype._createTraveler = function (d, i, node) {
  this.timeout = null
  var placeholder = d3.select(node)
                       .classed('placeholder', true)

  this.traveler = d3.select(document.createElement('div'))
               .attr('class', 'node traveling-node')
               .attr('style', placeholder.attr('style'))
               .html(placeholder.node().innerHTML)
               .datum({
                 _source: d,
                 _initialParent: d.parent && d.parent.id,
                 _initialIndex: d.parent && d.parent.children.indexOf(d),
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

  if (d.y === 0) {
    // prevent the root from moving
    return
  }

  this.timeout = window.setTimeout(this._createTraveler.bind(this, d, i, node), startMs)

  // Set maxY to be the bottom of the tree
  this.maxY = this.tree.node.data()[this.tree.node.data().length - 1]._y
}

Dnd.prototype._drag = function (d, i, node) {
  if (!this.tree.el.select('.tree').classed('dragging')) {
    return
  }

  if (d.y === 0) {
    return // ignore root
  }

  if (this.timeout) {
    window.clearTimeout(this.timeout)
    this._createTraveler.call(this, d, i, node)
  }
  var self = this

  this.traveler.datum(function (d) {
    // Set _y to the be max of the root node (so it's not above root) and the center of the node
    //  and the min of that value and the last node's bottom pixel
    d._y = Math.min(Math.max(d3.event.y - (self.tree.options.height / 2), self.tree.options.height / 2), self.maxY + self.tree.options.height)
    var prev = d.i

    // Set this index to where it would be in the tree
    d.i = Math.min(~~((d._y + (self.tree.options.height / 2)) / self.tree.options.height), self.tree.node.size() - 1) // can't be greater than the max index
    // change in i
    d.ci = d.i - prev

    var source = d._source

    var before = d3.select(self.tree.node[0][Math.max(d.i - 1, 0)]).datum()
    d._dropzone = d3.select(self.tree.node[0][Math.max(d.i, 0)]).datum()

    var embed = false
    if (d._y % (before._y + (self.tree.options.height / 2)) <= threshold) {
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

    if (d.ci || d.embedded != embed) {
      source.parent.children.splice(source.parent.children.indexOf(source), 1)
      var newParent = embed ? before : d._dropzone.parent

      if (d._dropzone == source && !embed) {
        newParent = before.parent
      }

      if (newParent == source) {
        newParent = d._dropzone
      }

      var children = newParent.children || (newParent.children = [])
        , idx = children.length ? children.indexOf(d._dropzone) : 0

      // If the dropzone was removed because we're sliding left, then its not in the tree, so get the index of the before node
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
      return self.tree.prefix + 'transform:' + 'translate(' + d._source.depth * self.tree.options.depth + 'px,0px)'
    })
}

Dnd.prototype._end = function (d, i, node) {
  if (!this.tree.el.select('.tree').classed('dragging')) {
    return
  }

  if (this.timeout) {
    window.clearTimeout(this.timeout)
  }

  d3.select(node).classed('placeholder', false)

  if (this.traveler) {
    if (this.traveler.datum()._y !== d._y) {
      if (d.parent._children && d.parent.children) {
        // The node was dropped onto another node that had hidden children, expand the new drop location
        d.parent.children = d.parent._children.concat(d.parent.children[0])
        d.parent._children = null
        this.tree._fly(d.parent)
      }
      this.tree.emit('move', this.tree.nodes[d.id], this.tree.nodes[d.parent.id], this.tree.nodes[this.traveler.datum()._initialParent], d.parent.children.indexOf(d), this.traveler.datum()._initialIndex)
    }

    this.traveler.remove()
    this.traveler = null
  }

  this.tree.el.select('.tree').classed('dragging', false)
}

module.exports = Dnd
