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
          .subject(function () {
            // This is a weird addition from upgrading d3 v3 to v4. The new d3-drag functionality sets a subect
            // that uses d.y and d.x. Since we're setting x/y values on our data, this breaks. We don't want to use
            // the d.x d.y to find offsets. So this overrides subject, so it uses the event x/y
            return {
              x: d3.event.x,
              y: d3.event.y
            }
          })

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
