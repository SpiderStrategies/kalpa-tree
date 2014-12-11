var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , defaults = {
    depth: 20, // indentation depth
    height: 36, // height of each row
    accessors: {
      id: 'id',
      label: 'label',
      icon: 'icon',
      color: 'color'
    }
  }
  , prefix = (function (p) {
    for (var i = 0; i < p.length; i++) {
      if (p[i] + 'Transform' in document.body.style) {
        return '-' + p[i] + '-'
      }
    }
    return ''
  })([ 'webkit', 'ms', 'Moz', 'O' ])
  , resize = require('./lib/resize')

/**
 * Create a new d3 tree with the given config.
 */
var Tree = function (options) {
  if (!options) {
    throw new Error('options are required')
  }
  if (!options.stream) {
    throw new Error('options.stream is required')
  }

  this.options = defaults
  for (var p in options) {
    if (p === 'accessors') {
      for (var pp in options.accessors) {
        this.options.accessors[pp] = options.accessors[pp]
      }
    } else {
      this.options[p] = options[p]
    }
  }

  this.resizer = resize(prefix)

  this.tree = d3.layout.tree()
                       .nodeSize([0, this.options.depth])
}

util.inherits(Tree, EventEmitter)

Tree.prototype.render = function () {
  var self = this

  this.el = d3.select(document.createElement('div'))
              .attr('class', 'tree')

  this.node = this.el.append('ul')
                     .selectAll('li.node')

  this._nodeData = []
  this.options.stream.on('data', function (n) {
    var p = (function (nodes) {
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].id === n.parent) {
          return nodes[i]
        }
      }
    })(self._nodeData)

    self._nodeData.push(n)
    if (p) {
      n.parent = p
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
  })

  return this
}

Tree.prototype.resize = function () {
  var box = this.el.node().parentNode.getBoundingClientRect()
  this.resizer.height(this.options.height)
  this.node.call(this.resizer)
}

Tree.prototype.draw = function (source) {
  var self = this

  this.node = this.node.data(this.tree.nodes(this._nodeData[0]), function (d) {
    return d[self.options.accessors.id]
  })

  var enter = this.node.enter().append('li')
      .attr('class', 'node')
      .on('click', this._onSelect.bind(this))
      .style(prefix + 'transform', function (d) {
        return 'translate(0px,' + (source ? source._y : d.y) + 'px)'
      })
      .style('opacity', 1e-6)

  // Add the node contents
  var contents = enter.append('div')
                        .attr('class', 'node-contents')
                        .style(prefix + 'transform', function (d) {
                          return 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
                        })

  // Add the toggler
  contents.append('div')
          .attr('class', 'toggler')
            .append('svg')
              .append('use')
                .attr('xlink:href', '#collapsed')

  // icon to represent the node tpye
  contents.append('svg')
          .attr('class', 'icon')
            .append('use')

  contents.append('div')
         .attr('class', 'label')

  // Now the indicator light
  enter.append('div')
          .attr('class', 'indicator')

  // Update the color if it changed
  this.node.selectAll('div.indicator')
      .attr('class', function (d) {
        return 'indicator ' + d[self.options.accessors.color]
      })

  // The icon maybe changed
  this.node.selectAll('svg.icon')
           // .attr('viewBox', '0 0 32 32')
           .attr('class', function (d) {
             return 'icon ' + d[self.options.accessors.color]
           })
           .selectAll('use')
            .attr('xlink:href', function (d) {
              return '#' + d[self.options.accessors.icon]
            })

  // change the state of the toggle icon by adjusting its class
  this.node.selectAll('.toggler')
           .attr('class', function (d) {
             return 'toggler ' + (d._children ? 'collapsed' : d.children ? 'expanded' : 'leaf')
           })

  // Perhaps the name changed
  this.node.selectAll('div.label')
            .text(function (d) {
              return d[self.options.accessors.label]
            })

  // if we are manipulating a single node, we may have to adjust selected properties
  if (source) {
    this.node.classed('selected', function (d) {
      return d.selected
    })
  }

  // If this node has been removed, let's remove it.
  var exit = this.node.exit()
  exit.selectAll('div.node-contents')
      .style(prefix + 'transform', function (d) {
        return 'translate(' + d.parent._x + 'px,0px)'
      })

  exit.style(prefix + 'transform', function (d) {
        return 'translate(0px,' + source._y + 'px)'
      })
      .style('opacity', 1e-6)
      .transition()
      .duration(300) // copied in css
      .remove()

  // Now resize things
  this.resize()
}

Tree.prototype.select = function (id) {
  var d = null
  this._nodeData.some(function (_d) {
    return _d.id == id && (d = _d, true)
  })

  if (d) {
    tree._onSelect(d)
  }
}

Tree.prototype._onSelect = function (d) {
  // tree_.selected stores a previously selected node
  if (tree._selected) {
    // delete the selected field from that node
    delete tree._selected.selected
  }
  d.selected = true
  tree.emit('selected', d)
  tree._selected = d
  this.toggle(d)
}

Tree.prototype.toggle = function (d) {
  // make sure all parents are visible
  while (d.parent._children) {
    this.toggle(d.parent)
  }
  if (d.children) {
    d._children = d.children
    d.children = null
  } else {
    d.children = d._children
    d._children = null
  }
  this.draw(d)
  if (d3.event) {
    d3.event.stopPropagation()
  }
}

module.exports = Tree
