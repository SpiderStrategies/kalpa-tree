export default function () {
  this.stopPropagation = function () {}
  this.sourceEvent = {
    stopPropagation: function () {},
    type: 'mouse'
  }
}
