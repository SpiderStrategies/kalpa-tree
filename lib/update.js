var d3 = require('d3')

module.exports = function (tree) {

  function draw (selection) {
    selection.each(function (data, i) {
      // Store sane copies of x,y that denote our true coords in the tree
      data._x = data.y
      data._y = i * tree.options.height

      var node = d3.select(this)

      node.selectAll('svg.icon')
               .attr('class', function (d) {
                 return 'icon ' + d[tree.options.accessors.color]
               })
               .selectAll('use')
                .attr('xlink:href', function (d) {
                  return '#icon-' + d[tree.options.accessors.icon]
                })

      // change the state of the toggle icon by adjusting its class
      node.selectAll('.toggler')
               .attr('class', function (d) {
                 return 'toggler ' + (d._children ? 'collapsed' : d.children ? 'expanded' : 'leaf')
               })

      // Perhaps the name changed
      node.selectAll('div.label')
                .text(function (d) {
                  return d[tree.options.accessors.label]
                })

      node.style(tree.prefix + 'transform', function (d, i) {
            return 'translate(0px,' + d._y + 'px)'
          })
          .style('opacity', 1)

      // Now we can move the group so it's indented correctly
      node.selectAll('div.node-contents')
          .attr('style', function (d, i) {
            return tree.prefix + 'transform:' + 'translate(' + d._x + 'px,0px)'
          })
    })
  }

  return draw
}
