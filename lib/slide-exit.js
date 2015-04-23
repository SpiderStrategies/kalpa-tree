module.exports = function (tree) {

  return function (selection) {
    var exit = selection.exit()
                        .classed('placeholder fading-node', true)
                        .classed('selected', false)

    exit.filter(function (d) {
          return d.parent && d.parent.children && d.parent.children.indexOf(d) !== -1
        })
        .style(tree.prefix + 'transform', function (d) {
          // Slide nodes of an expanded parent up to their parent
          return 'translate(0px,' + (d.parent ? d.parent._y : 0) + 'px)'
        })

    exit.transition()
        .duration(tree.transitionTimeout)
        .remove()

    return selection
  }

}
