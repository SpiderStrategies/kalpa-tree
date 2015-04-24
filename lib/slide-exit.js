module.exports = function (tree) {

  return function (selection, source) {
    var exit = selection.exit()
                        .classed('placeholder fading-node', true)
                        .classed('selected', false)

    exit.filter(Boolean) // This gives us a new index for style, indicating the remove node order
        .style(tree.prefix + 'transform', function (d, i) {
          return 'translate(0px,' + (d._y - (i * tree.options.height))  + 'px)'
        })

    exit.transition()
        .duration(tree.transitionTimeout)
        .remove()

    return selection
  }

}
