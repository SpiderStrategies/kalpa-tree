var d3 = require('d3')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , tree = d3.layout.tree().nodeSize([0, 20])
  , margin = {top: 30, right: 20, bottom: 30, left: 20}
  , width = 800 - margin.left - margin.right
  , barHeight = 20
  , barWidth = width * .8
  , duration = 400

/**
 * Create a new d3 tree with the given options.  The currently supported
 * options are:
 *
 * - selector: a CSS selector expression that specifies where the tree should be
 * appended to the DOM
 * - url: the URL containing the nodes to render
 */
var Tree = function (options) {
  var self = this
  this.options = options

  var svg = d3.select(options.selector).append('svg')
    .attr('width', width + margin.left + margin.right)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

  this.node = svg.selectAll('g.node')

  http.get(options.url, function (res) {
    res.pipe(JSONStream.parse([true]).on('data', function (n) {
      // Add node to its parent
      if (n.parent) {
        var p = (function (nodes) {
          for (var i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].id === n.parent) {
              return nodes[i]
            }
          }
        })(nodes)
        if (p.children) {
          p.children.push(n)
        } else {
          p.children = [n]
        }
        nodes.push(n)
      } else {
        // root
        n.x = n.x0
        n.y = n.y0
        n.parent = n
        self.root = n
        nodes = tree(self.root)
      }
      self.draw()
    })).on('end', function () {
      console.log('all done')
    })
  })
}

Tree.prototype.draw = function () {
  var height = Math.max(500, nodes.length * barHeight + margin.top + margin.bottom)

  d3.select('svg').transition()
      .duration(duration)
      .attr('height', height)

  d3.select(self.frameElement).transition()
      .duration(duration)
      .style('height', height + 'px')

  this.node = this.node.data(tree.nodes(this.root), function (d) {
    return d.id
  })

  var enter = this.node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', function (d) { return 'translate(' + d.parent.y0 + ',' + d.parent.x0 + ')' })
      .on('click', this.toggle)

  enter.append('rect')
      .attr('y', -barHeight / 2)
      .attr('height', barHeight)
      .attr('width', barWidth)
      .style('fill', '#fff')

  enter.append('path')
      .attr('class', 'indicator')
      .attr('d', d3.svg.symbol().type('circle'))
      .attr('transform', 'translate(' + (barWidth - 10 )+ ',0)')
      .style('fill', function (d) {
        return d.color
      })

  enter.append('text')
      .attr('dy', 3.5)
      .attr('dx', 5.5)
      .text(function (d) { return d.label })

  nodes.forEach(function (n, i) {
    n.x = i * barHeight
  })

  enter.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')' })

  this.node.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')' })
      .select('circle')
      .style('fill', function (d) {
        return d.color
      })

  this.node.exit()
      .attr('transform', function (d) { return 'translate(' + d.parent.y + ',' + d.parent.x + ')' })
      .remove()

  nodes.forEach(function (d) {
    d.x0 = d.x
    d.y0 = d.y
  })
}

Tree.prototype.toggle = function(d) {
  console.log(d)
}

module.exports = Tree
