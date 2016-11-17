// Pre-order traversal, so each node and descendant is invoked only after
// all its ancestors have been visited
function traverse (node, callback) {
  var nodes = [node]
    , i = 0

  while ((node = nodes.pop()) != null) {
    callback(node, i++)
    var n
      , children

    if ((children = node.children) && (n = children.length)) {

      while (--n >= 0) {
        nodes.push(children[n])
      }
    }
  }
}

/*
 * Computes the layout of the tree
 */
module.exports = function (depth, height, rootOffset, children) {

  return function (root) {
    var stack = [root]
      , nodes = []
      , node

    root.depth = 0

    while ((node = stack.pop()) != null) {
      nodes.push(node)
      if ((childs = children.call(null, node, node.depth)) && (n = childs.length)) {
        var n, childs, child
        while (--n >= 0) {
          stack.push(child = childs[n])
          child.parent = node
          child.depth = node.depth + 1
        }
        node.children = childs
      } else {
        delete node.children
      }
    }

    traverse(root, function (node, i) {
      node._x = node.depth * depth
      node._y = i * height  + (i > 0 ? rootOffset : 0)
    })

    return nodes
  }
}
