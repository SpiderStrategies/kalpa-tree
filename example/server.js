var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , d3 = require('d3')
  , tree = require('./tree')
  , request = require('request')
  , spawn = require('child_process').spawn

http.createServer(function (req, res) {
  var _url = url.parse(req.url, true)
    , path = _url.pathname

  if (path == '/index.html' || path == '/') {
    return fs.createReadStream(__dirname + '/index.html').pipe(res)
  } else if (path == '/tree.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' })
    var less = spawn('./node_modules/less/bin/lessc', ['-x', 'tree.less'])
    less.stdout.pipe(res)
    less.stderr.pipe(process.stderr)
  } else if (path === '/matt-tree.json') {
    request('https://gist.githubusercontent.com/mattsgarlata/c331e9bdf264f7526850/raw/e989f2bd1e8eb9ac7d2caff48aba21025863514d/gistfile1.json').pipe(res)
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
