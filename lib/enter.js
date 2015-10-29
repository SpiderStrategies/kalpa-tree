var partialRight = require('./partial-right')
  , d3 = require('d3')
  , DnD = require('./dnd')

var contents = function (selection, tree, transitions) {
  // Add the node contents
  function field (id, field) {
    var n = tree.nodes[id]
    return n ? n[field] : ''
  }
  var contents = selection.append('div')
                            .attr('class', 'node-contents')
                            .attr('style', function (d) {
                              var x = transitions ? (d.parent ? d.parent._x : 0) : d._x
                              return tree.prefix + 'transform:' + 'translate(' + x + 'px,0px)'
                            })

  // Add the toggler (inline svg for IE9 rotation support)
  contents.append('div')
          .attr('class', function (d) {
            return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
          })
          .on('click', tree._onToggle.bind(tree))
          .append('svg')
            .append('path')
              .attr('d', function(d) {
                return "M 9.9585564,6.8338173 C 9.9293142,7.4775125 9.3304268,7.8464666 8.9016778,8.2371365 7.7569911,9.2165326 6.6436108,10.235903 5.4779963,11.188722 4.8455224,11.544509 3.9641802,11.028114 3.9509963,10.304674 3.9096608,9.8426007 4.1932258,9.4144954 4.5730755,9.1755297 5.5222357,8.3779589 6.471396,7.5803881 7.4205563,6.7828173 6.3768897,5.909484 5.333223,5.0361506 4.2895564,4.1628173 3.6921554,3.6088017 4.0313622,2.4386848 4.8517545,2.3264551 5.4192521,2.2207898 5.8521236,2.6886126 6.2299557,3.0353016 7.3573819,4.0259339 8.5168698,4.9826881 9.6180279,6.001615 9.8104659,6.2365064 9.9445657,6.5275948 9.9585564,6.8338173 z"
              })

  contents.append('svg')
          .attr('class', function (d) {
            return 'icon ' + field(d.id, tree.options.accessors.color)
          })
          .append('use')
          .attr('xlink:href', function (d) {
            return '#icon-' + field(d.id, tree.options.accessors.icon)
          })

  contents.append('div')
          .attr('class', 'label')
          .text(function (d) {
            return field(d.id, tree.options.accessors.label)
          })

  // Now the label mask
  selection.append('div')
          .attr('class', function (d) {
            return (tree.options.indicator ? 'label-mask indicator ' : 'label-mask ') + field(d.id, tree.options.accessors.color)
          })
}

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
                           .on('click', partialRight(tree._onSelect.bind(tree), tree.options))
                           .call(listener)
                           .style(tree.prefix + 'transform', transformStyle)

    // Just render the nodes that are visible in the tree at first
    enter.filter(function (d) {
           if (transitions) { return true }
           return d._y >= node.scrollTop && d._y <= node.offsetHeight + node.scrollTop
         })
         .call(contents, tree, transitions)

    if (transitions) {
      enter.style('opacity', 1e-6)
    } else {
      process.nextTick(function () {
        // Now that visible nodes are in the dom, add the contents for remaining nodes
        enter.filter(function (d) {
               return !this.children.length
             })
             .call(contents, tree, transitions)
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
