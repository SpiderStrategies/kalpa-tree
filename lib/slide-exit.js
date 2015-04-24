module.exports = function (tree) {

  return function (selection, source) {
    var exit = selection.exit()
                        .classed('placeholder fading-node', true)
                        .classed('selected', false)

    exit.filter(function (d) {
          // Filter nodes that are top level nodes being removed. Meaning they don't have expanded children
          // And make sure this node isn't part of those children
          return d.parent && d.parent.children && d.parent.children.indexOf(d) !== -1
        })
        .style(tree.prefix + 'transform', function (d) {
          // Slide nodes of an expanded parent up to their source if defined (used by removeNode)
          // Or just to their parent
          return 'translate(0px,' + (source ? (source._y || 0) : (d.parent ? d.parent._y : 0)) + 'px)'
        })

    exit.transition()
        .duration(tree.transitionTimeout)
        .remove()

    return selection
  }

}
