var d3 = require('d3-selection')

module.exports = function (tree) {

  return function (selection) {
    tree.el.select('.tree')
           .classed('has-transient', false)

    selection.classed('root', function (d, i) {
                return !tree.options.forest && i === 0
              })
              .classed('transient', function (d) {
                if (d.id === tree.options.transientId) {
                  tree.el.select('.tree')
                         .classed('has-transient', true)
                  return true
                }
                return false
              })
              .select(function (d) {
                if (d._exitingClassName) {
                  // If a node was edited and the className was removed, a `_exitingClassName` would have been set on the layout
                  // Remove that class on the DOM node and clean up the layout node state.
                  this.classList.remove(...d._exitingClassName.split(' '))
                  delete d._exitingClassName
                }
                if (tree.nodes[d.id] && tree.nodes[d.id].className) {
                  this.classList.add(...tree.nodes[d.id].className.split(' '))
                }
                return this
              })
              .attr('data-id', function (d) {
                return d[tree.options.accessors.id]
              })
              .style(tree.prefix + 'transform', function (d) {
                return 'translate(0px,' + d._y + 'px)'
              })
              .call(tree.options.contents, tree)
              .select(tree.options.indentableSelector)
              .attr('style', function (d) {
                return tree.prefix + 'transform:' + 'translate(' + d._x + 'px,0px)'
              })

    // If the tree has indicators, we may need to update the color
    selection.select('div.indicator')
             .attr('class', function (d) {
               return 'label-mask indicator ' + tree.nodes[d.id][tree.options.accessors.color]
             })
  }
}
