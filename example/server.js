var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , d3 = require('d3')
  , tree = require('./tree')
  , sass = require('node-sass')
  , request = require('request')
  , spawn = require('child_process').spawn

http.createServer(function (req, res) {
  var _url = url.parse(req.url, true)
    , path = _url.pathname

  if (path == '/index.html' || path == '/') {
    return fs.createReadStream(__dirname + '/index.html').pipe(res)
  } else if (path == '/tree.css') {
    sass.render({
        file: './tree.scss',
        includePaths: ['./node_modules/bourbon/app/assets/stylesheets/' ]
      }, function (err, result) {
      res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(result.css)
      })
  } else if (path === '/lots-o-docs.json') {
    return request('https://gist.githubusercontent.com/nathanbowser/7eda0518120d7bac6847/raw/c7de51421ef571232f2a2acb690edc2ba8261fac/gistfile1.json').pipe(res)
  } else if (path === '/documents.json') {
    return fs.createReadStream(__dirname + '/documents.json').pipe(res)
  } else if (path === '/tree-patch.json') {
    return fs.createReadStream(__dirname + '/patch.json').pipe(res)
  } else if (path === '/matt-tree.json') {
    request('https://gist.githubusercontent.com/mattsgarlata/7c3229e5bff6b72c4d2c/raw/7960e5c3cdf9b0234e7b2b5145632bb3d32b1e4a/tree.json').pipe(res)
  } else if (path == '/bundle.js') {
    res.writeHead(200, {'Content-Type': 'application/javascript'})
    return fs.createReadStream(__dirname + '/bundle.js').pipe(res)
  } else if (path == '/sms-tree.json') {
    return fs.createReadStream(__dirname + '/tree.json').pipe(res)
  } else if (path == '/tree.json') {
    res.end(JSON.stringify(d3.layout.tree().nodes(tree(_url.query.depth || 5)).map(function (n) {
      n.parentId = n.parent && n.parent.id
      delete n.children
      delete n.parent
      return n
    })))
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.write('Not found')
    res.end()
  }


}).listen(3000)
