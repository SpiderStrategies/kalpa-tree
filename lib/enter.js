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
                           .attr('class', 'node ' + (cssClasses || '') + (transitions ? ' transitioning-node' : ''))
                           .classed('selected', function (d) {
                             return d.selected
                           })
                           .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
                           .call(listener)
                           .style(tree.prefix + 'transform', transformStyle)
                           .style('opacity', 1e-6)

    // Add the node contents
    var contents = enter.append('div')
                          .attr('class', 'node-contents')
                          .attr('style', function (d) {
                            return tree.prefix + 'transform:' + 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
                          })

    // Add the toggler
    contents.append('div')
            .attr('class', 'toggler leaf')
              .on('click', tree._onToggle.bind(tree))
              .append('svg')
                .append('use')
                  .attr('xlink:href', '#icon-collapsed')

    // icon to represent the node tpye
    contents.append('svg')
            .attr('class', 'icon')
              .append('use')

    contents.append('div')
           .attr('class', 'label')

    // Now the label mask
    enter.append('div')
            .attr('class', (tree.options.indicator ? 'label-mask indicator' : 'label-mask'))

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
