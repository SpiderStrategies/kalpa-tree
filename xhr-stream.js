var stream = require('stream')
  , util = require('util')

function Stream (xhr) {
  stream.Stream.call(this)
  this.xhr = xhr
  this.offset = 0
  xhr.onreadystatechange = this.handle.bind(this)
  xhr.send(null)
}

util.inherits(Stream, stream.Stream)

Stream.prototype.handle = function () {
  if (this.xhr.readyState === 3) {
    this.write()
  }
  if (this.xhr.readyState === 4) {
    this.emit('end')
  }
}

Stream.prototype.write = function () {
  if (this.xhr.responseText.length > this.offset) {
    this.emit('data', this.xhr.responseText.slice(this.offset))
    this.offset = this.xhr.responseText.length
  }
}

module.exports = Stream