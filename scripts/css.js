var sass = require('node-sass')
  , fs = require('fs')
  , colors = require('scoreboard-colors')

sass.render({
  file: __dirname + '/../style/tree.scss',
  includePaths: colors.includePaths
}, function (err, result) {
  if (err) {
    throw err
  }

  fs.writeFile(__dirname + '/../dist/tree.css', result.css, function (err) {
    if (err) {
      throw err
    }
  })
})
