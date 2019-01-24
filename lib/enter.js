var d3 = require('d3-selection')
  , partialRight = require('./partial-right')

module.exports = function (tree) {
  return function (enter, transformStyle, cssClasses) {
    var transitions = tree.el.select('.tree').classed('transitions')

    enter.classed('node ' + (cssClasses || ''), true) // Don't set `attr('class')` b/c it could overwrite some previous setting
         .classed('selected', function (d) {
           return d.selected
         })
         .select(function (d) {
           if (tree.nodes[d.id].className) {
             // Use the DOM API classList to add an additional class name if it was set. Can't use D3's `classed` since we don't know the
             // name of the class, and can't use `.attr(clazz)` since it will overwrite other set class names
             let classes = tree.nodes[d.id].className
             this.classList.add(...classes.split(' '))
             // Store classes on the node for future updates. Storing it in the DOM in case a user modifies the node object's
             // `className` before an edit/update
             this.dataset.classes = classes
           }
           return this
         })
         .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
         .style(tree.prefix + 'transform', transformStyle)
         .call(tree.options.contents, tree, transitions)

    if (transitions) {
      enter.classed('transitioning-node', true)
      tree._forceRedraw() // Force a redraw so we see the updates transitioning
      enter.classed('transitioning-node', false)
    }

    return enter
  }
}
