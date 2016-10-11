var defaultStyle = function (source) {
  return 'translate(0px,' + (source ? source._y : 0) + 'px)'
}

module.exports = function (tree) {
  return function (selection, source, transformStyle) {
    // If the node has been removed, we fly it up to its parent
    var exit = selection.exit()
    exit.style(tree.prefix + 'transform', transformStyle || defaultStyle.bind(null, source))

    exit.select('div.node-contents')
        .style(tree.prefix + 'transform', function (d) {
          return 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
        })

    if (tree.el.select('.tree').classed('transitions')) {
      exit.classed('transitioning-node', true)
      exit.transition()
          .duration(tree.transitionTimeout)
          .remove()
    } else {
      exit.remove()
    }

    return selection
  }

}

