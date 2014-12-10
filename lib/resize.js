var d3 = require('d3')

module.exports = function (options) {
  var textCoverWidth = 100
    , togglerWidth = 20
    , width, height

  function draw (selection) {
    selection.each(function (data, i) {
      // Store sane copies of x,y that denote our true coords in the tree
      data._x = data.y
      data._y = i * height

      var node = d3.select(this)

      node.transition()
          .duration(options.duration)
          .style('transform', function (d, i) {
            return 'translate(0px,' + d._y + 'px)'
          })
          .style('opacity', 1)

      // Now we can move the group so it's indented correctly
      node.selectAll('div.node-contents')
          .transition()
          .duration(options.duration)
          .style('transform', function (d, i) {
            return 'translate(' + (d._x - 10) + 'px,0px)'
          })
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
