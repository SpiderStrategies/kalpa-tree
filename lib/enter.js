var d3 = require('d3-selection')
  , partialRight = require('./partial-right')

module.exports = function (tree) {
  return function (enter, transformStyle, cssClasses) {
    var transitions = tree.el.select('.tree').classed('transitions')

    enter.attr('class', 'node ' + (cssClasses || ''))
         .classed('selected', function (d) {
           return d.selected
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
