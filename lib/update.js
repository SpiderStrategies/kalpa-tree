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
                let classes = this.dataset.classes

                // Remove the previous custom class names from the node
                if (classes) {
                  this.classList.remove(...classes.split(' '))
                }

                if (tree.nodes[d.id] && tree.nodes[d.id].className) {
                  // Add new custom classes
                  let newClasses = tree.nodes[d.id].className
                  this.classList.add(...newClasses.split(' '))
                  // Store them in the dataset so we can remove later
                  this.dataset.classes = newClasses
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
