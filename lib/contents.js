module.exports = function (selection, tree, transitions) {

  // Add the node contents
  function field (id, f) {
    var n = tree.nodes[id]
    return n ? (n[f] || '') : ''
  }

  var contents = selection.append('div')
                            .attr('class', 'node-contents')
                            .attr('style', function (d) {
                              var x = transitions ? (d.parent ? d.parent._x : 0) : d._x
                              return tree.prefix + 'transform:' + 'translate(' + x + 'px,0px)'
                            })

  // Add the toggler
  contents.append('div')
          .attr('class', function (d) {
            return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
          })
          .on('click', tree._onToggle.bind(tree))
          .append('svg')
            .append('use')
              .attr('xlink:href', '#icon-collapsed')

  contents.append('svg')
          .attr('class', function (d) {
            return 'icon ' + field(d.id, tree.options.accessors.color)
          })
          .append('use')
          .attr('xlink:href', function (d) {
            return '#icon-' + field(d.id, tree.options.accessors.icon)
          })

  contents.append('div')
          .attr('class', 'label')
          .text(function (d) {
            return field(d.id, tree.options.accessors.label)
          })

  // Now the label mask
  selection.append('div')
           .attr('class', function (d) {
             return (tree.options.indicator ? 'label-mask indicator ' : 'label-mask ') + field(d.id, tree.options.accessors.color)
           })
}
