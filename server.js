var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , d3 = require('d3')
  , tree = require('./tree')
  , flat = require('./tree-flat')

http.createServer(function (req, res) {
  var _url = url.parse(req.url, true)
    , path = _url.pathname

  if (path == '/index.html' || path == '/') {
    return fs.createReadStream('./index.html').pipe(res)
  } else if (path == '/bundle.js') {
    return fs.createReadStream('./bundle.js').pipe(res)
  } else if (path == '/tree.json') {
    res.end(JSON.stringify(d3.layout.tree().nodes(tree(_url.query.depth || 5)), function (key, value) {
      if (key === 'parent') {
        return value.id
      } else {
        return value
      }
    }))
  } else if (path == '/tree-flat.json') {
    res.end(JSON.stringify(flat()))
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.write('Not found')
    res.end()
  }


}).listen(3000)
