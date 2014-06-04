var Tree = require('../')

new Tree({
  url: '/tree.json?depth=2',
  selector: 'body'
})
