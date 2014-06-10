var d3 = require('d3')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , resize = require('./lib/resize')
  , defs = require('./lib/defs')
  , defaults = {
    depth: 20, // indentation depth
    height: 36, // height of each row
    marginLeft: 0,
    marginTop:  18,
    duration: 400
  }

function toggleClass (clazz, state, node) {
  this.node.filter(function (d) {
    if (d == node) {
      return true
    }
    while (d = d.parent) {
      if (d === node) {
        return true
      }
    }
  }).classed(clazz, state)
}

/**
 * Create a new d3 tree with the given config.
 */
var Tree = function (options) {
  if (!options) {
    throw new Error('options are required')
  }
  if (!options.url) {
    throw new Error('options.url is required')
  }

  this.options = defaults
  for (var p in options) {
    this.options[p] = options[p]
  }

  this.defs = defs(this.options)
  this.resizer = resize(this.options)

  this.tree = d3.layout.tree()
                       .nodeSize([0, this.options.depth])
}

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
               .call(this.defs)

  this.node = this.el.append('g')
                        .attr('transform', 'translate(' + this.options.marginLeft + ',' + this.options.marginTop + ')')
                        .selectAll('g.node')

  this._nodeData = []
  http.get(this.options.url, function (res) {
    res.pipe(JSONStream.parse([true]).on('data', function (n) {
      var p = (function (nodes) {
        for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].id === n.parent) {
            return nodes[i]
          }
        }
      })(self._nodeData)

      self._nodeData.push(n)
      if (p) {
        if (p == self._nodeData[0]) {
          // if parent is the root, then push unto children so it's visible
          (p.children || (p.children = [])).push(n)
          self.draw()
        } else {
          // push to _children so it's hidden, no need to draw
          (p._children || (p._children = [])).push(n)
        }
      } else {
        // root, draw it.
        self.draw()
      }
    }))
  })

  return this
}

Tree.prototype.resize = function () {
  var box = this.el.node().parentNode.getBoundingClientRect()
  this.resizer.width(parseInt(box.width, 10))
  this.resizer.height(this.options.height)
  this.node.call(this.resizer)
}

Tree.prototype.draw = function (source) {
  var self = this

  this.node = this.node.data(this.tree.nodes(this._nodeData[0]), function (d) {
    return d.id
  })

  var enter = this.node.enter().append('g')
      .attr('class', 'node')
      .on('mouseover', toggleClass.bind(this, 'hover', true))
      .on('mouseout', toggleClass.bind(this, 'hover', false))
      .on('click', function (d, i) {
        self.select.call(this, self, d, i)
      })
      .attr('transform', function (d, i) {
        return 'translate(0,' + (source ? source._y : d.y) + ')'
      })
      .style('opacity', 1e-6)

  // Filler element
  enter.append('rect')
         .attr('class', 'node-fill')
         .attr('width', '100%')
         .attr('height', this.options.height)
         .attr('y', this.options.height / - 2)

  var contents = enter.append('g')
                        .attr('class', 'node-contents')
                        .attr('transform', function (d) {
                          return 'translate(' + (d.parent ? d.parent._x : 0) + ',0)'
                        })

  contents.append('use')
         .attr('class', 'icon')
         .attr('x', 14) // manually position the icon
         .attr('y', -6)

  contents.append('text')
         .attr('class', 'label')
         .attr('dy', 4) // manually position the label
         .attr('dx', 35)

  contents.append('rect')
       .attr('class', 'text-cover')

  contents.append('circle')
      .attr('class', 'indicator')
      .attr('cx', -7) // manually position the indicator circle
      .attr('cy', 0)
      .attr('r', 2.5) // the circle is 5px wide

  // Put this after content, so the toggler click icon works
  var toggler = enter.append('g')
                       .attr('class', 'toggle-group')
  toggler.append('use')
         .attr('class', 'toggle-icon')
         .attr('xlink:href', this.options.icons + '#collapsed')
         .attr('x', 15) // manually center the toggle icon in the click area
         .attr('y', -5)
  toggler.append('rect')
           .attr('width', this.options.height)
           .attr('height', this.options.height)
           .on('click', this.toggle.bind(this))

  // Update the color if it changed
  this.node.selectAll('circle.indicator')
      .attr('class', function (d) {
        return 'indicator ' + d.color
      })

  // The icon maybe changed
  this.node.selectAll('use.icon')
           .attr('class', function (d) {
             return 'icon ' + d.color
           })
           .attr('xlink:href', function (d) {
              return self.options.icons + '#' + d.icon
           })

  // change the state of the toggle icon by adjusting its class
  this.node.selectAll('use.toggle-icon')
           .attr('class', function (d) {
             return 'toggle-icon ' + (d._children ? 'collapsed' : d.children ? 'expanded' : 'leaf')
           })

  // Perhaps the name changed
  this.node.selectAll('text.label')
            .text(function (d) {
              return d.label
            })

  // If this node has been removed, let's remove it.
  this.node.exit()
      .transition()
      .duration(this.options.duration)
      .attr('transform', function (d) {
        return 'translate(' + -self.options.depth + ',' + source._y + ')'
      })
      .style('opacity', 0)
      .remove()

  // Now resize things
  this.resize()
}

Tree.prototype.select = function (tree, d, i) {
  var el = d3.select(this)
    , prev = el.classed('selected')

  if (tree._selected) {
    tree._selected.classed('selected', false)
  }

  tree._selected = el
  el.classed('selected', true)

  if (prev) {
    tree.toggle(d)
  } else if (d._children) {
    d.children = d._children
    d._children = null
    tree.draw(d)
  }
}

Tree.prototype.toggle = function (d) {
  if (d.children) {
    d._children = d.children
    d.children = null
  } else {
    d.children = d._children
    d._children = null
  }
  this.draw(d)
  d3.event.stopPropagation()
}

module.exports = Tree
