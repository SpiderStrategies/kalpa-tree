module.exports = function (config) {
  var textCoverWidth = 100
    , togglerWidth = 20
    , duration = 400
    , width, height

  function draw (selection) {
    selection.each(function (data, i) {
      // Store sane copies of x,y that denote our true coords in the tree
      data._x = data.y
      data._y = i * height

      var node = d3.select(this)

      node.transition()
          .duration(duration)
          .attr('transform', function (d, i) {
            return 'translate(0,' + d._y + ')'
          })
          .style('opacity', 1)

      node.selectAll('g.toggle-group')
          .attr('transform', function (d, i) {
            return 'translate(' + (d._x - togglerWidth) + ',0)'
          })

      // Now we can move the group so it's indented correctly
      node.selectAll('g.node-contents')
          .transition()
          .duration(duration)
          .attr('transform', function (d, i) {
            return 'translate(' + d._x + ',0)'
          })

      node.selectAll('rect.text-cover')
          // We want to double the size of the text cover so it also covers
          // during animations that move things to the left.
          .attr('width', textCoverWidth * 2)
          .attr('x', function (d, i) {
            return (width - textCoverWidth) - d._x
          })
          .attr('height', height)

      // Change the dot positions
      node.selectAll('circle.indicator')
          .attr('transform', function (d) {
            return 'translate(' + (width - 10 - d._x) + ',0)'
          })

      // Change the rect
      node.selectAll('rect')
          .attr('y', -height / 2)
    })
  }

  draw.width = function (value) {
    if (!arguments.length) return width
    width = value
    return draw
  }

  draw.height = function (value) {
    if (!arguments.length) return height
    height = value
    return draw
  }

  return draw
}
