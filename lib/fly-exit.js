var defaultStyle = function (source) {
  return 'translate(0px,' + (source ? source._y : 0) + 'px)'
}

module.exports = function (tree) {
  return function (exit, source, transformStyle) {
    // If the node has been removed, we fly it up to its parent
    exit.style(tree.prefix + 'transform', transformStyle || defaultStyle.bind(null, source))
        .select(tree.options.indentableSelector)
        .style(tree.prefix + 'transform', function (d) {
          return 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
        })

    if (tree.el.select('.tree').classed('transitions')) {
      exit.classed('transitioning-node outgoing-node', true)
      exit.transition()
          .duration(tree.transitionTimeout)
          .remove()
    } else {
      exit.remove()
    }

    return exit
  }

}

