// Pre-order traversal, so each node and descendant is invoked only after
// all its ancestors have been visited
function traverse (roots, callback) {
  var i = 0

  roots.forEach(function (_root) {
    var nodes = [_root]
      , n, children

    while ((_root = nodes.pop()) != null) {
      callback(_root, i++)
      if ((children = _root.children) && (n = children.length)) {
        while (--n >= 0) {
          nodes.push(children[n])
        }
      }
    }
  })
}

/*
 * Computes the layout of the tree
 */
export default function (depth, height, rootOffset, children) {
  return function (tree) {
    let root = tree.root
    if (!root) {
      return []
    }

    let roots = (Array.isArray(root) ? root : [root]).filter(function (r) {
                  // Forest tree root nodes could have `visible: false`, so be sure to filter
                  return r.visible !== false
                })
      , nodes = []
      , self = this

    roots.forEach(function (_root) {
      var stack = [_root]
        , node, n, childs, child
      _root.depth = 0

      while ((node = stack.pop()) != null) {
        nodes.push(node)
        if ((childs = children.call(self, node, node.depth)) && (n = childs.length)) {
          while (--n >= 0) {
            stack.push(child = childs[n])
            child.parent = node
            child.depth = node.depth + 1

            let source = tree.nodes?.[child.id]
            // If there's a source node, update it's parentId
            if (source) {
              source.parentId = node.id
            }
          }
          node.children = childs
        } else {
          delete node.children
        }
      }
    })

    traverse(roots, function (node, i) {
      node._x = node.depth * depth
      node._y = i * height  + (i > 0 ? rootOffset : 0)
    })

    return nodes
  }
}
