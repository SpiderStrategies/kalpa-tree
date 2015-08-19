var partialRight = require('./partial-right')
  , d3 = require('d3')
  , DnD = require('./dnd')

module.exports = function (tree) {
  var dnd = new DnD(tree)
    , listener = d3.behavior.drag()
    , defaultContent = function (d) {
      return tree.prefix + 'transform:' + 'translate(' + (d.parent ? d.parent._x : 0) + 'px,0px)'
    }

  listener.on('dragstart', dnd.start)
          .on('drag', dnd.drag)
          .on('dragend', dnd.end)

  return function (selection, transformNodeStyle, transformContentsStyle, cssClasses) {
    if (!cssClasses && typeof transformContentsStyle === 'string') {
      cssClasses = transformContentsStyle
      transformContentsStyle = defaultContent
    }
    if (!cssClasses && !transformContentsStyle) {
      transformContentsStyle = defaultContent
    }
    var transitions = tree.el.select('.tree').classed('transitions')
      , enter = selection.enter()
                         .append('li')
                           .attr('class', 'node ' + (cssClasses || '') + (transitions ? ' transitioning-node' : ''))
                           .classed('selected', function (d) {
                             return d.selected
                           })
                           .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
                           .call(listener)
                           .style(tree.prefix + 'transform', transformNodeStyle)

    if (transitions) {
      enter.style('opacity', 1e-6)
    }

    // Add the node contents
    var contents = enter.append('div')
                          .attr('class', 'node-contents')
                          .attr('style', transformContentsStyle)

    // Add the toggler
    var toggler = contents.append('div')
                          .attr('class', function (d) {
                            return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
                          })
                          .on('click', tree._onToggle.bind(tree))
    // icon to represent the node type
    contents.append('svg')
            .attr('class', function (d) {
              return 'icon ' + tree.nodes[d.id][tree.options.accessors.color]
            })
            .append('use')
            .attr('xlink:href', function (d) {
              return '#icon-' + tree.nodes[d.id][tree.options.accessors.icon]
            })

    contents.append('div')
            .attr('class', 'label')
            .text(function (d) {
              return tree.nodes[d.id][tree.options.accessors.label]
            })

    // Now the label mask
    enter.append('div')
            .attr('class', function (d) {
              return (tree.options.indicator ? 'label-mask indicator ' : 'label-mask ') + tree.nodes[d.id][tree.options.accessors.color]
            })

    process.nextTick(function () {
      toggler.append('svg')
             .append('use')
               .attr('xlink:href', '#icon-collapsed')
    })

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
