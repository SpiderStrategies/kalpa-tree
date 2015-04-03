var Readable = require('stream').Readable
  , data = require('./tree.json')

/*
 * Returns a new stream that will emit all the nodes from tree.json.
 * Should be used to pass into a tree for testing
 */
module.exports = function () {
  var stream = new Readable({objectMode: true})
    , i = 0

  stream._read = function () {
    if (data[i]) {
      return stream.push(data[i++])
    }
    stream.push(null)
  }

  return stream
}
