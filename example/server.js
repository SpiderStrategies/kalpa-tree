import http from 'http'
import fs from 'fs'
import url from 'url'
import request from 'request'
import { spawn } from 'child_process'
import colors from 'scoreboard-colors'

http.createServer(function (req, res) {
  var _url = url.parse(req.url, true)
    , path = _url.pathname

  if (path == '/index.html' || path == '/') {
    return fs.createReadStream('example/index.html').pipe(res)
  } else if (path == '/tree.css') {
    return fs.createReadStream('dist/tree.css').pipe(res)
  } else if (path === '/lots-o-docs.json') {
    return request('https://gist.githubusercontent.com/nathanbowser/7eda0518120d7bac6847/raw/c7de51421ef571232f2a2acb690edc2ba8261fac/gistfile1.json').pipe(res)
  } else if (path === 'example/documents.json') {
    return fs.createReadStream('./documents.json').pipe(res)
  } else if (path === '/tree-patch.json') {
    return fs.createReadStream('example/patch.json').pipe(res)
  } else if (path === '/matt-tree.json') {
    request('https://gist.githubusercontent.com/mattsgarlata/7c3229e5bff6b72c4d2c/raw/7960e5c3cdf9b0234e7b2b5145632bb3d32b1e4a/tree.json').pipe(res)
  } else if (path == '/bundle.js') {
    res.writeHead(200, {'Content-Type': 'application/javascript'})
    return fs.createReadStream('example/bundle.js').pipe(res)
  } else if (path == '/sms-tree.json') {
    return fs.createReadStream('example/tree.json').pipe(res)
  } else if (path == '/15-k-nodes.json') {
    return fs.createReadStream('example/15-k-nodes.json').pipe(res)
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.write('Not found')
    res.end()
  }


}).listen(3000)
