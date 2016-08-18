var d3 = require('d3')

module.exports = function (selection, tree, transitions) {

  // Add the node contents
  function field (id, f) {
    var n = tree.nodes[id]
    return n ? (n[f] || '') : ''
  }

  selection.each(function (data) {
    var node = d3.select(this)
      , contents = node.selectAll('.node-contents')
                       .data(function (d) {
                         return [d]
                       })
      , enter = contents.enter()
                        .append('div')
                          .attr('class', 'node-contents')
                          .attr('style', function (d) {
                            var x = transitions ? (d.parent ? d.parent._x : 0) : d._x
                            return tree.prefix + 'transform:' + 'translate(' + x + 'px,0px)'
                          })

    // Add the toggler
    enter.append('div')
           .attr('class', function (d) {
             return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
           })
           .on('click', tree._onToggle.bind(tree))
           .append('svg')
             .append('use')
               .attr('xlink:href', '#icon-collapsed')

    enter.append('svg')
         .attr('class', function (d) {
           return 'icon ' + field(d.id, tree.options.accessors.color) + ' '
                          + field(d.id, tree.options.accessors.icon) + ' '
         })
         .append('use')
         .attr('xlink:href', function (d) {
           return '#icon-' + field(d.id, tree.options.accessors.icon)
         })

    enter.append('div')
         .attr('class', 'label')
         .text(function (d) {
           return field(d.id, tree.options.accessors.label)
         })


    contents.select('svg.icon')
            .attr('class', function (d) {
              return 'icon ' + (tree.nodes[d.id][tree.options.accessors.color] || '') + ' '
                             + (tree.nodes[d.id][tree.options.accessors.icon] || '')
            })
            .select('use')
            .attr('xlink:href', function (d) {
              return '#icon-' + tree.nodes[d.id][tree.options.accessors.icon]
            })

    // change the state of the toggle icon by adjusting its class
    contents.select('.toggler')
            .attr('class', function (d) {
              return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
            })

    // Perhaps the name changed
    contents.select('div.label')
            .text(function (d) {
              return tree.nodes[d.id][tree.options.accessors.label]
            })

    // If the tree has indicators, we may need to update the color
    contents.select('div.indicator')
            .attr('class', function (d) {
              return 'label-mask indicator ' + tree.nodes[d.id][tree.options.accessors.color]
            })

    // Now the label mask
    node.selectAll('.label-mask')
        .data(function (d) {
          return [d]
        })
        .enter()
        .append('div')
          .attr('class', function (d) {
            return (tree.options.indicator ? 'label-mask indicator ' : 'label-mask ') + field(d.id, tree.options.accessors.color)
          })
  })
}
