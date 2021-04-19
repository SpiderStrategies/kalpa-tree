var sass = require('node-sass')
  , fs = require('fs')
  , renderProperties = require('../render-properties')

sass.render(renderProperties, function (err, result) {
  if (err) {
    throw err
  }

  fs.writeFile(__dirname + '/../dist/tree.css', result.css, function (err) {
    if (err) {
      throw err
    }
  })
})
