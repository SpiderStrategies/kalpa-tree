var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , d3 = require('d3')
  , tree = require('./tree')
  , flat = require('./tree-flat')

http.createServer(function (req, res) {
  if (req.url == '/index.html' || req.url == '/') {
    return fs.createReadStream('./index.html').pipe(res)
  } else if (req.url == '/bundle.js') {
    return fs.createReadStream('./bundle.js').pipe(res)
  } else if (req.url == '/tree.json') {
    res.end(JSON.stringify(d3.layout.tree().nodes(tree(url.parse(req.url, true).query.depth || 5)), function (key, value) {
      if (key === 'parent') {
        return value.id
      } else {
        return value
      }
    }))
  } else if (req.url == '/tree-flat.json') {
    res.end(JSON.stringify(flat()))
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.write('Not found')
    res.end()
  }


}).listen(3000)
