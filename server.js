var http = require('http')
  , colors = [ 'ff0000', '00ff00', '00ffff', '0000ff' ]
  , _ = require('lodash')

http.createServer(function (req, res) {
  var id = 0

   var scorecardTree = [{
     id: ++id,
     label: 'Scorecard Node ' + id,
     color: colors[id%4]
   }]

   function generateChildren (numChildren, subLevels) {
     var nodes = []
     _.times(numChildren, function () {
       var node = {
         id: ++id,
         label: 'Scorecard Node ' + id,
         color: colors[id%4]
       }

       node.children = subLevels === 0 ? [] : generateChildren(numChildren, subLevels-1)

       nodes.push(node)
     })

     return nodes
   }

  res.end(JSON.stringify({
    id: ++id,
    label: 'Node ' + id ,
    color: colors[id % 4],
    children: generateChildren(10, 1)
  }))
}).listen(3000)
