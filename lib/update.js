var d3 = require('d3')

module.exports = function (tree) {

  function draw (selection) {
    selection.each(function (data, i) {
      var node = d3.select(this)

      node.select('svg.icon')
               .attr('class', function (d) {
                 return 'icon ' + tree.nodes[d.id][tree.options.accessors.color]
               })
               .select('use')
                .attr('xlink:href', function (d) {
                  return '#icon-' + tree.nodes[d.id][tree.options.accessors.icon]
                })

      // change the state of the toggle icon by adjusting its class
      node.select('.toggler')
               .attr('class', function (d) {
                 return 'toggler ' + (d._children ? 'collapsed' : d.children ? 'expanded' : 'leaf')
               })

      // Perhaps the name changed
      node.select('div.label')
                .text(function (d) {
                  return tree.nodes[d.id][tree.options.accessors.label]
                })

      // If the tree has indicators, we may need to update the color
      node.select('div.indicator')
          .attr('class', function (d) {
            return 'label-mask indicator ' + tree.nodes[d.id][tree.options.accessors.color]
          })

      node.style(tree.prefix + 'transform', function (d, i) {
            return 'translate(0px,' + d._y + 'px)'
          })
          .style('opacity', 1)

      // Now we can move the group so it's indented correctly
      node.select('div.node-contents')
          .attr('style', function (d, i) {
            return tree.prefix + 'transform:' + 'translate(' + d._x + 'px,0px)'
          })
    })

    return selection
  }

  return draw
}
