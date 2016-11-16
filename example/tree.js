var colors = [ 'red', 'green', 'yellow' ]
  , icons = ['generic', 'perspective', 'objective', 'find']
  , _ = require('lodash')
  , crypto = require('crypto')

module.exports = function (depth) {
  var id = 0
    , depth = parseInt(depth, 10)

  function generateChildren (numChildren, subLevels) {
    var nodes = []
    _.times(numChildren, function () {
      var node = {
        id: ++id,
        label: 'Scorecard ñode ' + id + (crypto.randomBytes(_.random(0, 40)).toString('hex')),
        nodeType: icons[id % 4],
        color: colors[id % 3]
      }

      node.children = subLevels === 0 ? null : generateChildren(numChildren, subLevels - 1)

      nodes.push(node)
    })

    return nodes
  }

  return {
    id: ++id,
    label: 'Node ' + id ,
    color: colors[id % 3],
    nodeType: 'root',
    children: generateChildren(depth, 2)
  }
}
