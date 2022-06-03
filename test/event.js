export default type => {
  var e = document.createEvent('Event')
  e.initEvent(type, true, true)
  e.which = 1
  return e
}
