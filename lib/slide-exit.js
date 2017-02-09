module.exports = function (tree) {

  return function (exit) {
    exit.classed('transition-placeholder fading-node', true)
        .classed('selected', false)

    exit.filter(Boolean) // This gives us a new index for style, indicating the remove node order
        .style(tree.prefix + 'transform', function (d, i) {
          return 'translate3d(0px,' + (d._y - (i * tree.options.height))  + 'px,0px)'
        })

    exit.transition()
        .duration(tree.transitionTimeout)
        .remove()

    return exit
  }

}
