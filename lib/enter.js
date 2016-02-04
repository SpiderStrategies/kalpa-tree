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
    if (typeof transformStyle !== 'function') {
      // Nodes will come in from their first visible ancestor. Grab a list of visible nodes
      var visible = tree.node[0].reduce(function (p, c) {
                                  var _c = d3.select(c).datum()
                                  p[_c.id] = _c._y
                                  return p
                                }, {})

      cssClasses = transformStyle
      transformStyle = function (d) {
        var y = (function p (node) {
          if (!node) {
            return 0
          }
          if (visible[node.id]) {
            return visible[node.id]
          }
          return p(node.parent)
        })(d.parent)

        return 'translate(0px,' + y + 'px)'
      }
    }
    var transitions = tree.el.select('.tree').classed('transitions')
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
                           .call(tree.options.contents, tree, transitions)

    if (transitions) {
      enter.style('opacity', 1e-6)
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
