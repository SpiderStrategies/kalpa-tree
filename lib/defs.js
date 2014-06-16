var d3 = require ('d3')

module.exports = function (options) {
  function draw (selection) {
    selection.each(function (d) {
      d3.select(this).selectAll('defs')
        .data([options.gradients || []])
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
