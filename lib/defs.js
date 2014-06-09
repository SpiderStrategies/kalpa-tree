var d3 = require ('d3')

// TODO Configurable would be nice
var gradients = [{
  attrs: {
    id: 'grad',
    x1: '0%',
    y1: '0%',
    x2: '70%',
    y2: '0%'
  },
  stops: [0, 50]
}, {
  attrs: {
    id: 'grad-selected',
    x1: '0%',
    y1: '0%',
    x2: '70%',
    y2: '0%'
  },
  stops: [0, 50]
}]

module.exports = function () {
  function draw (selection) {
    selection.each(function (d) {
      d3.select(this).selectAll('defs')
        .data([gradients])
        .enter()
        .append('defs')
        .selectAll('linearGradient')
        .data(function (d) {
          return d
        })
        .enter()
          .append('linearGradient')
          .each(function (d) {
            d3.select(this).attr(d.attrs)
          })
          .selectAll('stop')
            .data(function (d) {
              return d.stops
            })
            .enter()
            .append('stop')
            .attr('class', function (d) {
              return 'stop-' + d
            })
            .attr('offset', function (d) {
              return d + '%'
            })
    })

    return this
  }

  return draw

}
