var D3Tree = require('./d3-tree')

new D3Tree({
  url: '/tree.json?depth=5',
  selector: 'body'
})
