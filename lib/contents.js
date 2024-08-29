import * as d3 from 'd3-selection'

// Nodes are expandable if they have some children in _allChildren that aren't marked as `visible: false`
function expandable (node) {
  return node._allChildren &&
         node._allChildren.length &&
         node._allChildren.filter(function (c) {
           return c.visible !== false
         })
         .length
}

export default function (selection, tree, transitions) {

  // Add the node contents
  function field (id, f) {
    var n = tree.nodes[id]
    return n ? (n[f] || '') : ''
  }

  selection.each(function (data) {
    var node = d3.select(this)
      , contents = node.selectAll('.node-contents')
                       .data(function (d) {
                         return [d]
                       })
      , enter = contents.enter()
                        .append('div')
                          .attr('class', 'node-contents')
                          .attr('style', function (d) {
                            let x = transitions ? (d.parent ? d.parent._x : 0) : d._x
                            let indentValue = `${tree._rtlTransformX(x)}px`
                            return`${tree.prefix}transform: translate(${indentValue}, 0px); width: calc(100% - ${x}px)`
                          })

    // Add the toggler
    enter.append('div')
           .attr('class', function (d) {
             return 'toggler ' + (d.children ? 'expanded' : expandable(d) ? 'collapsed' : 'leaf')
           })
           .on('click', tree._onToggle.bind(tree))
           .append('svg')
             .append('use')
               .attr('xlink:href', '#icon-collapsed')

    enter.append('svg')
         .attr('class', function (d) {
           return 'icon ' + field(d.id, tree.options.accessors.color)
                          + ' icon-' + (field(d.id, tree.options.accessors.icon) || '')
         })
         .append('use')
         .attr('xlink:href', function (d) {
           return '#icon-' + field(d.id, tree.options.accessors.icon)
         })

    enter.append('div')
         .attr('class', 'label')
         .call(tree.options.label.bind(tree))

    contents.select('svg.icon')
            .attr('class', function (d) {
              var color = tree.nodes[d.id][tree.options.accessors.color]
              return 'icon ' + (color ? color + ' has-color' : '')
                             + (' icon-' + (field(d.id, tree.options.accessors.icon) || ''))
            })
            .select('use')
            .attr('xlink:href', function (d) {
              return '#icon-' + tree.nodes[d.id][tree.options.accessors.icon]
            })

    // change the state of the toggle icon by adjusting its class
    contents.select('.toggler')
            .attr('class', function (d) {
              return 'toggler ' + (d.children ? 'expanded' : expandable(d) ? 'collapsed' : 'leaf')
            })

    // Perhaps the name changed
    contents.select('div.label')
            .call(tree.options.label.bind(tree))

    // Now the label mask
    node.selectAll('.label-mask')
        .data(function (d) {
          return [d]
        })
        .enter()
        .append('div')
          .attr('class', function (d) {
            return (tree.options.indicator ? 'label-mask indicator ' : 'label-mask ') + field(d.id, tree.options.accessors.color)
          })
  })
}
