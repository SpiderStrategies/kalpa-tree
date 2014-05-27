var colors = [ 'ff0000', '00ff00', '00ffff', '0000ff' ]
  , _ = require('lodash')

module.exports = function (depth) {
  var id = 0
    , depth = parseInt(depth, 10)

  function generateChildren (numChildren, subLevels) {
    var nodes = []
    _.times(numChildren, function () {
      var node = {
        id: ++id,
        label: 'Scorecard Node ' + id,
        color: colors[id % 4]
      }

      node.children = subLevels === 0 ? [] : generateChildren(numChildren, subLevels - 1)

      nodes.push(node)
    })

    return nodes
  }

  return {
    id: ++id,
    label: 'Node ' + id ,
    color: colors[id % 4],
    children: generateChildren(depth, 2)
  }
}
