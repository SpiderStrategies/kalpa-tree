var Tree = require('../')

new Tree({
  url: '/tree.json?depth=5',
  selector: 'body'
})
