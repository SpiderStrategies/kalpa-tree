var sass = require('node-sass')
  , fs = require('fs')
  , bourbon = require('bourbon')

sass.render({
  file: __dirname + '/../tree.scss',
  includePaths: bourbon.includePaths
}, function (err, result) {
  fs.writeFile(__dirname + '/../dist/tree.css', result.css, function (err) {
    if (err) {
      throw err
    }
  })
})
