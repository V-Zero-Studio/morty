//
//  MORTY: VISUAL ANALYTICS MODULE
//

//
//  aggregate multiple series of log data and visualize it
//
const visualizeSeries = (containerVis) => {
  openDB((event) => {
    readFromDB((series) => {
      const mapDailyStats = new Map();
      const mapDailyMouseFootprintPerSession = new Map();

      // num of sessions per day
      for (const entry of series) {
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

        let footprintExisting = 0;
        if (mapDailyMouseFootprintPerSession.has(strDate)) {
          footprintExisting = mapDailyMouseFootprintPerSession.get(strDate);
        }
        mapDailyMouseFootprintPerSession.set(
          strDate,
          (footprintExisting + footprint / numSessions) | 0
        );
      }
      plot(
        mapDailyMouseFootprintPerSession,
        createDivVis("visMouseFootprint", containerVis)
      );
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

const fillMissingDates = (dataMap) => {
  // Convert dataMap to an array and sort by date
  const data = Array.from(dataMap, ([date, value]) => ({
    date: new Date(date),
    value,
  })).sort((a, b) => a.date - b.date);

  if (data.length === 0) return [];

  // Get the min and max dates
  const minDate = new Date(data[0].date);
  const maxDate = new Date(data[data.length - 1].date);

  // Create a map for quick lookup
  const dataMapObj = new Map(
    data.map((d) => [d.date.toISOString().split("T")[0], d.value])
  );

  // Generate all dates within the range
  const filledData = [];
  for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    filledData.push({
      date: new Date(dateStr),
      value: dataMapObj.has(dateStr) ? dataMapObj.get(dateStr) : 0,
    });
  }

  return filledData;
};

//
//  plotting data series in a div
//
const plot = (dataMap, idDivVis) => {
  // const data = Array.from(dataMap, ([date, value]) => ({
  //   date: new Date(date), // Convert to Date object
  //   value,
  // }));

  const data = fillMissingDates(dataMap);

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

  const svg = d3
    .select("#" + idDivVis)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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

  // the following values are static
  // not dynamically matching the actual tooltip dimensions
  const widthTooltip = 80;
  const heightTooltip = 10;

  // Create overlay rectangle for mouse events
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mouseover", () => {
      focus.style("display", null);
      tooltip.style("display", null);
    })
    .on("mouseout", () => {
      focus.style("display", "none");
      tooltip.style("display", "none");
    })
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
        .attr("x", Math.min(x(d.date) + 5, width - widthTooltip))
        .attr("y", Math.max(y(d.value) - 5, heightTooltip))
        .text(`${d3.timeFormat("%m/%d")(d.date)}: ${d.value}`);
    });
};
