## kalpa-tree

[![Build Status](https://travis-ci.org/SpiderStrategies/kalpa-tree.svg?branch=master)](https://travis-ci.org/SpiderStrategies/kalpa-tree)

Kalpa tree is an implementation of a hierarchical tree. It receives a stream of nodes, each data event on the stream represents a node in the tree.
The tree is built using d3, and can handle 50K+ nodes easily. It's optimized for performance so it doesn't overload the browser if there's a lot of data.

View a live example:  http://spiderstrategies.github.io/kalpa-tree/

## Code Example

See `example/index.html`

To open the example page locally:

```
$ npm install
$ npm start // Builds a test server
$ npm run watch
```
Open your browser to http://localhost:3000

## API Reference

To build the tree
```
var tree = new Tree({
  stream: stream, // Stream of data where each data event represents a node
})
```

Handle errors
```
tree.on('error', function (e) {
  // Blue smoke
})
```

Handle move events if the user initiated dnd
```
tree.on('move', function (node, newParent, previousParent, newIndex, prevIndex) {

})
```

Listen to tree `select` events
```
tree.on('select', function (node) {
  // node is the node the user selected
})
```

Overridable options:

```
new Tree({
  transientId: -1, // Node's that are `placeholders` are not part of the tree yet.
  toggleOnSelect: true, // By default each select will toggle the node if needed. This prevents the toggle
  depth: 20, // indentation depth
  height: 36, // height of each row (Would need to override with css as well)
  rootHeight: 36, // root node height can be overridden
  maxAnimatable: 100, // Disable css animations if a node has children greater than this amount
  indicator: false, // show indicator light nodes on the right
  forest: false, // Indicates whether this tree can have multiple root nodes
  movable: function (d) { // control if a node can be moved
    // `d` is the node
    // `this` is a reference to the tree
    return true
  },
  droppable: function (d, parent) {
    // `d` is the node being moved
    // `parent` is its new parent. May be undefined if node is being moved to root in a forest tree
    // `this` is a reference to the tree
    return true // By default, any node can be dropped on any other node
  },
  label: function (selection) {
    // This call be used to override how the label is drawn using the default
    // `contents`
  },
  contents: require('./lib/contents'), // Override the default html structure of each node
  performanceThreshold: 1000, // If the node data count exceeds this threshold, the tree goes into performance mode
  accessors: { // Used to grab information out of the data object in the stream
    id: 'id',
    label: 'label',
    icon: 'icon',
    color: 'color'
  }
})
```

Grab a parent node
```
tree.parent(node)
// or
tree.parent(nodeId)
```

Return all children
```
tree.children(node)
// or
tree.children(nodeId)
```

Return a node's next sibling
```
tree.nextSibling(node)
// or
tree.nextSibling(nodeId)
```

Return a node's previous sibling
```
tree.previousSibling(node)
// or
tree.previousSibling(nodeId)
```

Move a node
```
tree.move(node, to)
```

Copy a node -- Copies a node to some new parent. `transformer` can be used to transform
each node that will be copied.

If to is missing and the tree is a forest, the node will be copied to a new root node of the forest tree.
```
tree.copy(node, to, transformer)
```

Select a node -- The node is marked selected and shown in the tree
  opt supports:
     - silent: Don't fire the select event
     - toggleOnSelect: Don't toggle the node if it has children, just select it
     - animate: Disable animations
     - force: Forces a select. Can be used to bypass the no-op selection if the node is already selected. This forces a redraw.
```
tree.select(id, opt)

```

Get -- Returns a node object by id. This searches all the underlying data, not just the visible nodes.
      if no id is sent, returns the root, essentially the entire tree
```
tree.get(id)
```

Select a node
```
tree.selected()
```

Returns the currently selected node's dom element
```
tree.selectedEl
```

Add --  Adds a new node to the tree. Pass in d as the data that represents the node,
        parent (which can be the parent object or an id), and an optional
        index. If the index is sent, the node will be inserted at that index within the
        parent's children.
```
tree.add(d, parent, idx)
```

isEditable -- Determine if the tree is in edit mode
```
tree.isEditable()
```

Editable -- Mark the tree as being in an editable state
```
tree.editable()
```

expandAll -- Expand all node's in the tree
```
tree.expandAll()
```

collapseAll -- Collapse all node's in the tree
```
tree.collapseAll()
```

edit -- Makes modifications to tree node(s). Can update a single node, an array of patch
        changes, or a stream that emits data events with the node and the changes
```
tree.edit(obj)
```

remove -- Cleanup the tree object and remove it from the dom
```
tree.remove()
```

removeNode -- Removes a node from the tree.
```
tree.removeNode(node)
// or
tree.removeNode(id)
```

Search -- Search the tree node's labels for the `term`
```
tree.search(term)
```

Toggle -- Used to toggle the node's children. If they are visible this will hide them, and
          if they are hidden, this will show them.
```
tree.toggle(d, opt)
```

### Transient nodes --
Transient nodes have special meaning in the tree. Usually a transient node represents a node that hasn't yet
been persisted to the server.

```
tree.addTransient(d, parent, idx)
tree.getTransient()
tree.editTransient(d)
tree.saveTransient(id)
tree.removeTransient()
```

## Tests

Run the test against phantom

`npm run test`

To run them in a browser

`npm run test-browser`

## License

ISC
