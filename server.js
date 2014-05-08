var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , d3 = require('d3')
  , tree = require('./tree')

http.createServer(function (req, res) {
  if (req.url == '/index.html' || req.url == '/') {
    return fs.createReadStream('./index.html').pipe(res)
  }
  if (req.url == '/bundle.js') {
    return fs.createReadStream('./bundle.js').pipe(res)
  }

  res.end(JSON.stringify(d3.layout.tree().nodes(tree(url.parse(req.url, true).query.depth || 5)), function (key, value) {
    if (key === 'parent') {
      return value.id
    } else {
      return value
    }
  }))
}).listen(3000)
