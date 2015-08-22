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

  // Add the toggler
  contents.append('div')
          .attr('class', function (d) {
            return 'toggler ' + (d.children ? 'expanded' : d._allChildren && d._allChildren.length ? 'collapsed' : 'leaf')
          })
          .on('click', tree._onToggle.bind(tree))
          .append('svg')
                 .append('use')
                   .attr('xlink:href', '#icon-collapsed')

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
