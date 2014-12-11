var d3 = require('d3')

module.exports = function (prefix) {
  var height

  function draw (selection) {
    selection.each(function (data, i) {
      // Store sane copies of x,y that denote our true coords in the tree
      data._x = data.y
      data._y = i * height

      var node = d3.select(this)

      node.style(prefix + 'transform', function (d, i) {
            return 'translate(0px,' + d._y + 'px)'
          })
          .style('opacity', 1)

      // Now we can move the group so it's indented correctly
      node.selectAll('div.node-contents')
          .style(prefix + 'transform', function (d, i) {
            return 'translate(' + d._x + 'px,0px)'
          })
    })
  }

  draw.height = function (value) {
    if (!arguments.length) return height
    height = value
    return draw
  }

  return draw
}
