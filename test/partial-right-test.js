import { test } from 'tape'
import pr from '../lib/partial-right.js'

test('partial right', function (t) {
  var add = function (a, b) {
    return a + b
  }
  t.equal(2, pr(add.bind(this, 1), 1)(), 'applies args to the end')
  t.end()
})
