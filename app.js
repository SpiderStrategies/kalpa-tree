var d3 = require('d3')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , tree = d3.layout.tree().nodeSize([0, 20])
  , margin = {top: 30, right: 20, bottom: 30, left: 20}
  , width = 800 - margin.left - margin.right
  , barHeight = 20
  , barWidth = width * .8
  , duration = 400
  , root

var svg = d3.select('body').append('svg')
    .attr('width', width + margin.left + margin.right)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

var node = svg.selectAll('g.node')
  , root

http.get({ path : '/tree.json?depth=10' }, function (res) {
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
        p._children.push(n)
      } else {
        p._children = [n]
      }
      nodes.push(n)
    } else {
      // root
      n.x = n.x0
      n.y = n.y0
      n.parent = n
      root = n
      nodes = tree(root)
    }
    draw()
  }))
})

function draw () {
  var height = Math.max(500, nodes.length * barHeight + margin.top + margin.bottom)

  d3.select('svg').transition()
      .duration(duration)
      .attr('height', height)

  d3.select(self.frameElement).transition()
      .duration(duration)
      .style('height', height + 'px')

  node = node.data(tree.nodes(root), function (d) {
    return d.id
  })

  var enter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', function (d) { return 'translate(' + d.parent.y0 + ',' + d.parent.x0 + ')' })
      .on('click', toggle)

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

  node.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')' })
      .select('circle')
      .style('fill', function (d) {
        return d.color
      })

  node.exit()
      .attr('transform', function (d) { return 'translate(' + d.parent.y + ',' + d.parent.x + ')' })
      .remove()

  nodes.forEach(function (d) {
    d.x0 = d.x
    d.y0 = d.y
  })
}


function toggle (d) {
  console.log('todo')
}
