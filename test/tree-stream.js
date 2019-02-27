var Readable = require('stream').Readable
  , data = require('./tree.json')

/*
 * Returns a new stream that will emit all the nodes from tree.json.
 * Should be used to pass into a tree for testing
 */
module.exports = function () {
  var stream = new Readable({objectMode: true})
    , clone = JSON.parse(JSON.stringify(data)) // poor man's clone
    , i = 0

  stream._read = function () {
    if (clone[i]) {
      return stream.push(clone[i++])
    }
    stream.push(null)

    // Just for testing purposes, when the stream emits 'end', the render function
    // requests an animation frame for a final paint. After that happens, we can start testing
    requestAnimationFrame(() => {
      stream.emit('test-stream-ready')
    })
  }

  return stream
}
