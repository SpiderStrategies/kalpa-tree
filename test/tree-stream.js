import { Readable } from 'stream'
import data from './tree.json'

/*
 * Returns a new stream that will emit all the nodes from tree.json.
 * Should be used to pass into a tree for testing
 */
export default function () {
  var stream = new Readable({objectMode: true})
    , clone = JSON.parse(JSON.stringify(data)) // poor man's clone
    , i = 0

  stream._read = function () {
    if (clone[i]) {
      return stream.push(clone[i++])
    }
    stream.push(null)
  }

  return stream
};
