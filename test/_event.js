module.exports = function () {
  this.stopPropagation = function () {}
  this.sourceEvent = {
    stopPropagation: function () {}
  }
}
