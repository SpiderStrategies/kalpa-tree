var optionalRequire = require("optional-require")(require)
, colors = optionalRequire('scoreboard-colors')

let renderProperties = {
  file: __dirname + '/style/' + (colors ? 'scoreboard' : 'default') + '-tree.scss'
}
  
if(colors) {
  renderProperties.includePaths = colors.includePaths
}
 
module.exports = renderProperties