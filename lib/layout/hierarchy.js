var merge = require('./merge')
  , rebind = require('./rebind')

module.exports = function() {
  var sort = d3_layout_hierarchySort,
      children = d3_layout_hierarchyChildren,
      value = d3_layout_hierarchyValue;

  function hierarchy(root) {
    var stack = [root],
        nodes = [],
        node;

    root.depth = 0;

    while ((node = stack.pop()) != null) {
      nodes.push(node);
      if ((childs = children.call(hierarchy, node, node.depth)) && (n = childs.length)) {
        var n, childs, child;
        while (--n >= 0) {
          stack.push(child = childs[n]);
          child.parent = node;
          child.depth = node.depth + 1;
        }
        if (value) node.value = 0;
        node.children = childs;
      } else {
        if (value) node.value = +value.call(hierarchy, node, node.depth) || 0;
        delete node.children;
      }
    }

    d3_layout_hierarchyVisitAfter(root, function(node) {
      var childs, parent;
      if (sort && (childs = node.children)) childs.sort(sort);
      if (value && (parent = node.parent)) parent.value += node.value;
    });

    return nodes;
  }

  hierarchy.sort = function(x) {
    if (!arguments.length) return sort;
    sort = x;
    return hierarchy;
  };

  hierarchy.children = function(x) {
    if (!arguments.length) return children;
    children = x;
    return hierarchy;
  };

  hierarchy.value = function(x) {
    if (!arguments.length) return value;
    value = x;
    return hierarchy;
  };

  // Re-evaluates the `value` property for the specified hierarchy.
  hierarchy.revalue = function(root) {
    if (value) {
      d3_layout_hierarchyVisitBefore(root, function(node) {
        if (node.children) node.value = 0;
      });
      d3_layout_hierarchyVisitAfter(root, function(node) {
        var parent;
        if (!node.children) node.value = +value.call(hierarchy, node, node.depth) || 0;
        if (parent = node.parent) parent.value += node.value;
      });
    }
    return root;
  };

  return hierarchy;
};

// A method assignment helper for hierarchy subclasses.
var d3_layout_hierarchyRebind = module.exports.d3_layout_hierarchyRebind = function (object, hierarchy) {
  rebind(object, hierarchy, "sort", "children", "value");

  // Add an alias for nodes and links, for convenience.
  object.nodes = object;
  object.links = d3_layout_hierarchyLinks;

  return object;
}

// Pre-order traversal.
var d3_layout_hierarchyVisitBefore = module.exports.d3_layout_hierarchyVisitBefore = function (node, callback) {
  var nodes = [node];
  while ((node = nodes.pop()) != null) {
    callback(node);
    if ((children = node.children) && (n = children.length)) {
      var n, children;
      while (--n >= 0) nodes.push(children[n]);
    }
  }
}

// Post-order traversal.
var d3_layout_hierarchyVisitAfter = module.exports.d3_layout_hierarchyVisitAfter = function (node, callback) {
  var nodes = [node], nodes2 = [];
  while ((node = nodes.pop()) != null) {
    nodes2.push(node);
    if ((children = node.children) && (n = children.length)) {
      var i = -1, n, children;
      while (++i < n) nodes.push(children[i]);
    }
  }
  while ((node = nodes2.pop()) != null) {
    callback(node);
  }
}

var d3_layout_hierarchyChildren = module.exports.d3_layout_hierarchyChildren = function(d) {
  return d.children;
}

var d3_layout_hierarchyValue = module.exports.d3_layout_hierarchyValue = function(d) {
  return d.value;
}

var d3_layout_hierarchySort = module.exports.d3_layout_hierarchySort = function(a, b) {
  return b.value - a.value;
}

// Returns an array source+target objects for the specified nodes.
var d3_layout_hierarchyLinks = module.exports.d3_layout_hierarchyLinks = function (nodes) {
  return d3.merge(nodes.map(function(parent) {
    return (parent.children || []).map(function(child) {
      return {source: parent, target: child};
    });
  }));
}
