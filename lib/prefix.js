var prefix

function get () {
  return prefix = (function (p) {
    for (var i = 0; i < p.length; i++) {
      if (p[i] + 'Transform' in document.body.style) {
        return '-' + p[i] + '-'
      }
    }
    return ''
  })([ 'webkit', 'ms', 'Moz', 'O' ])
}

if (document && document.body && document.body.style) {
  prefix = get()
} else {
  document.addEventListener('DOMContentLoaded', function () {
    document.removeEventListener('DOMContentLoaded', arguments.callee, false)

    prefix = get()
  })
}

module.exports = function () {
  return prefix
}
