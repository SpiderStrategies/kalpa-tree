var d3 = require('d3')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , height = 36
  , depth = 20
  , margin = {
    top: height / 2,
    left: 0
  }
  , tree = d3.layout.tree()
                    .nodeSize([0, depth])
  , resize = require('./lib/resize')()
  , defs = require('./lib/defs')()

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
 * Create a new d3 tree with the given options.  The currently supported
 * options are:
 *
 * - container: a jquery object. ridiculously lame.
 * - url: the URL containing the nodes to render
 */
var Tree = function (options) {
  this.options = options
  this.options.container.on('resize', this.resize.bind(this))
}

Tree.prototype.render = function () {
  var self = this

  this.svg = d3.select(this.options.container.get(0)) // Super lame. Figure out how to avoid jquery
               .append('svg')
               .call(defs)

  this.node = this.svg.append('g')
                        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                        .selectAll('g.node')

  http.get(this.options.url, function (res) {
    // TODO, this actually kills the browser processing each node individually
    res.pipe(JSONStream.parse([true]).on('data', function (n) {
      // Add node to its parent
      if (n.parent) {
        var p = (function (nodes) {
          for (var i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].id === n.parent) {
              return nodes[i]
            }
          }
        })(self.nodes)
        if (p.children) {
          p.children.push(n)
        } else {
          p.children = [n]
        }
      } else {
        self.root = n
      }
      self.draw()
    }))
  })
}

Tree.prototype.resize = function () {
  var box = this.options.container.get(0).getBoundingClientRect()
  resize.width(parseInt(box.width, 10))
  resize.height(height)
  this.node.call(resize)
}

Tree.prototype.draw = function (source) {
  var nodes = this.nodes = tree.nodes(this.root)
    , self = this

  this.node = this.node.data(nodes, function (d) {
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
         .attr('height', height)
         .attr('y', height / - 2)

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
         .attr('xlink:href', 'icons.svg#collapsed')
         .attr('x', 15) // manually center the toggle icon in the click area
         .attr('y', -5)
  toggler.append('rect')
           .attr('width', height)
           .attr('height', height)
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
             return 'icons.svg#' + d.icon
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
      .duration(400)
      .attr('transform', function (d) {
        return 'translate(' + -depth + ',' + source._y + ')'
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
