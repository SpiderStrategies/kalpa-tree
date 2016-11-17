var DnD = require('./dnd')
  , d3 = require('d3-selection')
  , drag = require('d3-drag').drag
  , partialRight = require('./partial-right')

module.exports = function (tree) {
  var dnd = new DnD(tree)
    , listener = drag()

  listener.on('start', dnd.start)
          .on('drag', dnd.drag)
          .on('end', dnd.end)

  return function (enter, transformStyle, cssClasses) {
    var transitions = tree.el.select('.tree').classed('transitions')

    enter.attr('class', 'node ' + (cssClasses || ''))
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
      enter.classed('transitioning-node incoming-node', false)
    }

    return enter
  }
}
