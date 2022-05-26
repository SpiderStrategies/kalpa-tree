export default function (tree) {

  return function (exit) {
    exit.classed('selected', false)

    exit.filter(Boolean) // This gives us a new index for style, indicating the remove node order
        .style(tree.prefix + 'transform', function (d, i) {
          return 'translate(0px,' + (d._y - (i * tree.options.height))  + 'px)'
        })

    if (tree.el.select('.tree').classed('transitions')) {
      exit.classed('transition-placeholder fading-node', true)
      exit.transition()
          .duration(tree.transitionTimeout)
          .remove()
    } else {
      exit.remove()
    }

    return exit
  }

}
