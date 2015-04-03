var test = require('tape').test
  , pr = require('../lib/partial-right')

test('partial right', function (t) {
  var add = function (a, b) {
    return a + b
  }
  t.equal(2, pr(add.bind(this, 1), 1)(), 'applies args to the end')
  t.end()
})
