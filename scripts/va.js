//
//  MORTY: VISUAL ANALYTICS MODULE
//

//
//  aggregate multiple series of log data and visualize it
//
const visualizeSeries = (containerVis) => {
  openDB((event) => {
    readFromDB((series) => {
      const series_timeStamps = []
      const mapDailyStats = new Map()
      let cnt_sessions = 0

      // preprocesing log for visualization
      for (const entry of series) {
        // log(entry)
        cnt_sessions += 1
        series_timeStamps.push(entry.timeStamp)

        // update a map of daily stats
        const strDate = entry.timeStamp.split("T")[0]
        let numSessions = 0
        if (mapDailyStats.has(strDate)) {
          numSessions = mapDailyStats.get(strDate)
        }
        mapDailyStats.set(strDate, numSessions + 1)
      }

      plot(mapDailyStats, createDivVis("visDailyStats", containerVis))
    })
  })
}

const createDivVis = (id, container) => {
  let divVis = document.createElement("div")
  divVis.id = id
  container.appendChild(divVis)
  return id
}

//
//  plotting data series in a div
//
const plot = (dataMap, idDivVis) => {
  const data = Array.from(dataMap, ([date, value]) => ({
    date: new Date(date), // Convert to Date object
    value,
  }))

  const margin = { top: 20, right: 30, bottom: 40, left: 50 }
  const width = 600 - margin.left - margin.right
  const height = 400 - margin.top - margin.bottom

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date)) // Get min and max dates
    .range([0, width])

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)]) // Scale to max value
    .range([height, 0])

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d"))
  const yAxis = d3.axisLeft(y)

  const svg = d3
    .select("#" + idDivVis)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  svg.append("g").attr("transform", `translate(0,${height})`).call(xAxis)

  svg.append("g").call(yAxis)

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value))

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line)
}
