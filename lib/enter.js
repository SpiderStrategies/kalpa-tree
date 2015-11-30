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
    var node = tree.el.select('.tree').node()
      , transitions = tree.el.select('.tree').classed('transitions')
      , enter = selection.enter()
                         .append('li')
                           .attr('class', 'node ' + (cssClasses || '') + (transitions ? ' transitioning-node' : ''))
                           .classed('selected', function (d) {
                             return d.selected
                           })
                           .attr('data-id', function (d) {
                             return d[tree.options.accessors.id]
                           })
                           .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
                           .call(listener)
                           .style(tree.prefix + 'transform', transformStyle)

    // Just render the nodes that are visible in the tree at first
    enter.filter(function (d) {
           if (transitions) { return true }
           return d._y >= node.scrollTop && d._y <= node.offsetHeight + node.scrollTop
         })
         .call(tree.options.contents, tree, transitions)

    if (transitions) {
      enter.style('opacity', 1e-6)
    } else {
      process.nextTick(function () {
        // Now that visible nodes are in the dom, add the contents for remaining nodes
        enter.filter(function () {
               return !this.children.length
             })
             .call(tree.options.contents, tree, transitions)
      })
    }

    if (transitions) {
      tree._forceRedraw() // Force a redraw so we see the updates transitioning
      d3.timer(function () {
        // Remove transitioning-node once the transitions have ended
        selection.classed('transitioning-node', false)
        return true // run once
      }, tree.transitionTimeout)
    }
    return selection
  }
}
