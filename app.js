var d3 = require('d3')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , es = require('event-stream')
  , margin = {top: 30, right: 20, bottom: 30, left: 20}
  , width = 800 - margin.left - margin.right
  , barHeight = 20
  , barWidth = width * .8
  , duration = 400
  , root

// Build the svg
var svg = d3.select('body').append('svg')
    .attr('width', width + margin.left + margin.right)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')


http.get({ path : '/tree.json?depth=2' }, function (res) {
  res.pipe(JSONStream.parse([true]).on('data', function (node) {
    // Add node
  }))
})

function update (source) {

  var nodes = tree.nodes(root)

  var height = Math.max(500, nodes.length * barHeight + margin.top + margin.bottom)

  d3.select('svg').transition()
      .duration(duration)
      .attr('height', height)

  d3.select(self.frameElement).transition()
      .duration(duration)
      .style('height', height + 'px')

  // Compute the 'layout'.
  nodes.forEach(function (n, i) {
    n.x = i * barHeight
  })

  // Update the nodes…
  var node = svg.selectAll('g.node')
      .data(nodes, function (d) { return d.id || (d.id = ++i) })

  var enter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', function (d) { return 'translate(' + source.y0 + ',' + source.x0 + ')' })
      .on('click', toggle)

  // Enter any new nodes at the parent's previous position.
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

  // Transition nodes to their new position.
  enter.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')' })

  node.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')' })
      .select('circle')
      .style('fill', function (d) {
        return d.color
      })

  // Transition exiting nodes to the parent's new position.
  node.exit()
      .attr('transform', function (d) { return 'translate(' + source.y + ',' + source.x + ')' })
      .remove()

  // Stash the old positions for transition.
  nodes.forEach(function (d) {
    d.x0 = d.x
    d.y0 = d.y
  })
}

// Toggle children on click.
function toggle (d) {
  if (d.children) {
    d._children = d.children
    d.children = null
  } else {
    d.children = d._children
    d._children = null
  }
  update(d)
}
