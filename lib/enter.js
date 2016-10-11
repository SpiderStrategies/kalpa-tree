var partialRight = require('./partial-right')
  , d3 = require('d3')
  , DnD = require('./dnd')

module.exports = function (tree) {
  var dnd = new DnD(tree)
    , listener = d3.behavior.drag()

  listener.on('dragstart', dnd.start)
          .on('drag', dnd.drag)
          .on('dragend', dnd.end)

  return function (selection, transformStyle, cssClasses) {
    var transitions = tree.el.select('.tree').classed('transitions')
      , enter = selection.enter()
                         .append('li')
                           .attr('class', 'node ' + (cssClasses || ''))
                           .classed('selected', function (d) {
                             return d.selected
                           })
                           .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
                           .call(listener)
                           .style(tree.prefix + 'transform', transformStyle)
                           .call(tree.options.contents, tree, transitions)

    if (transitions) {
      enter.classed('transitioning-node incoming-node', true)
      tree._forceRedraw() // Force a redraw so we see the updates transitioning
      selection.classed('transitioning-node incoming-node', false)
    }

    return selection
  }
}
