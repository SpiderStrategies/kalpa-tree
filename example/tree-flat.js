var colors = [ 'ff0000', '00ff00', '00ffff', '0000ff' ]
  , _ = require('lodash')

module.exports = function () {
  var id = 0

  var nodes = [{
    id: ++id,
    label: 'Node ' + id,
    color: colors[id%4]
  }]

  function generateChildren (numChildren, subLevels) {
    var children = []
    _.times(numChildren, function () {
      var node = {
        id: ++id,
        label: 'Node ' + id,
        color: colors[id % 4]
      }

      node.children = subLevels === 0 ? [] : generateChildren(numChildren, subLevels - 1)

      nodes.push(node)
      children.push(node.id)
    })

    return children
  }

  nodes[0].children = generateChildren(3, 2)

  return nodes
}
