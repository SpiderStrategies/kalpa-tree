module.exports = function (tree) {

  return function (selection, source) {
    // If the node has been removed, we fly it up to its parent
    var exit = selection.exit()

    exit.select('div.node-contents')
        .style(tree.prefix + 'transform', function (d) {
          return 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
        })

    exit.style(tree.prefix + 'transform', function (d) {
          return 'translate(0px,' + (source ? source._y : 0) + 'px)'
        })
        .style('opacity', 1e-6)

    if (tree.el.select('.tree').classed('notransition')) {
      exit.remove()
    } else {
      exit.transition()
          .duration(tree.transitionTimeout)
          .remove()
    }

    return selection
  }

}

