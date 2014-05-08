var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , tree = require('./tree')

http.createServer(function (req, res) {
  if (req.url == '/index.html' || req.url == '/') {
    return fs.createReadStream('./index.html').pipe(res)
  }
  if (req.url == '/bundle.js') {
    return fs.createReadStream('./bundle.js').pipe(res)
  }

  res.end(JSON.stringify(tree(url.parse(req.url, true).query.depth || 5)))

}).listen(3000)
