module.exports = function (fn) {
  var args = Array.prototype.slice.call(arguments, 1)
  return function () {
    return fn.apply(this, Array.prototype.slice.call(arguments, 0).concat(args))
  }
}
