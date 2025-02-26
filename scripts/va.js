//
//  MORTY: VISUAL ANALYTICS MODULE
//

//
//  aggregate multiple series of log data and visualize it
//
const visualizeSeries = (containerVis) => {
  openDB((event) => {
    readFromDB((series) => {
      // const series_timeStamps = []
      const mapDailyStats = new Map();
      const mapDailyMouseFootprintPerSession = new Map();
      // let cnt_sessions = 0

      // num of sessions per day
      for (const entry of series) {
        // cnt_sessions += 1
        // series_timeStamps.push(entry.timeStamp)

        const strDate = entry.timeStamp.split("T")[0];

        // calculate num of sessions
        let numSessions = 0;
        if (mapDailyStats.has(strDate)) {
          numSessions = mapDailyStats.get(strDate);
        }
        mapDailyStats.set(strDate, numSessions + 1);
      }
      plot(mapDailyStats, createDivVis("visDailyStats", containerVis));

      // avg mouse footprint per session per day
      for (const entry of series) {
        const strDate = entry.timeStamp.split("T")[0];
        numSessions = mapDailyStats.get(strDate);

        // mouse move footprint
        const mousemoveEvents = entry.interactionBehaviors.mousemoveEvents;
        let footprint = 0;
        let coordPrev;
        for (event of mousemoveEvents) {
          const coord = event.coord;
          if (coordPrev != undefined) {
            const dx = coord.x - coordPrev.x;
            const dy = coord.y - coordPrev.y;
            footprint += Math.sqrt(dx * dx + dy * dy);
          }
          coordPrev = coord;
        }

        let footprintExisting = 0
        if(mapDailyMouseFootprintPerSession.has(strDate)) {
          footprintExisting = mapDailyMouseFootprintPerSession.get(strDate)
        }
        mapDailyMouseFootprintPerSession.set(strDate, footprintExisting + footprint / numSessions);
      }
      plot(mapDailyMouseFootprintPerSession, createDivVis("visMouseFootprint", containerVis));
      
    });
  });
};

//
//
//
const createDivVis = (id, container) => {
  let divVis = document.createElement("div");
  divVis.id = id;
  container.appendChild(divVis);
  return id;
};

//
//  plotting data series in a div
//
const plot = (dataMap, idDivVis) => {
  const data = Array.from(dataMap, ([date, value]) => ({
    date: new Date(date), // Convert to Date object
    value,
  }));

  const widthContainer = document.getElementById(idDivVis).offsetWidth;
  const visHeight = 80;
  const margin = { top: 5, right: 5, bottom: 5, left: 5 };
  const width = widthContainer - margin.left - margin.right;
  const height = visHeight - margin.top - margin.bottom;

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date)) // Get min and max dates
    .range([0, width]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)]) // Scale to max value
    .range([height, 0]);

  // const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d"))
  // const yAxis = d3.axisLeft(y)

  const svg = d3
    .select("#" + idDivVis)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // svg
  //   .append("g")
  //   .attr("transform", `translate(0,${height})`)
  //   .call(xAxis)
  //   .selectAll("path, line, text")
  //   .attr("stroke", "black")

  // svg
  //   .append("g")
  //   .call(yAxis)
  //   .selectAll("path, line, text")
  //   .attr("stroke", "black")

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);

  //
  // hovering feature
  //

  const focus = svg.append("g").style("display", "none");

  // Circle marker
  focus.append("circle").attr("r", 5).attr("fill", "red");

  // Tooltip text
  const tooltip = svg
    .append("text")
    .attr("class", "tooltip")
    .attr("x", 10)
    .attr("y", 10)
    .attr("fill", "black");

  // Create overlay rectangle for mouse events
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mouseover", () => focus.style("display", null))
    .on("mouseout", () => focus.style("display", "none"))
    .on("mousemove", function (event) {
      const [mouseX] = d3.pointer(event, this);

      // Bisector to find nearest date
      const bisect = d3.bisector((d) => d.date).left;
      const x0 = x.invert(mouseX);
      const index = bisect(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      const d = d1 && x0 - d0.date > d1.date - x0 ? d1 : d0;

      // Move the focus circle
      focus.attr("transform", `translate(${x(d.date)},${y(d.value)})`);

      // Update tooltip text
      tooltip
        .attr("x", x(d.date) + 10)
        .attr("y", y(d.value) - 10)
        .text(`${d3.timeFormat("%Y-%m-%d")(d.date)}: ${d.value}`);
    });
};
