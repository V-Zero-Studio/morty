//
//
//

const PATH_CONFIG_FILE = "data/config.json";
const PATH_POPUP_HTML = "scripts/popup.html";
const PATH_VIS_LIB = "scripts/chart.js";

const INTERVAL_MONITOR_STREAMING = 1000; // ms

let _on = true;
let _isStreaming = false;
let _config = {};
let _observerNewResponse = undefined;
let _elmResponse = undefined;

// data logging
const DT_EVENTS = 250;
const TIMEOUT_AUTO_LOG_SAVE = 30000;
let _isLogging = true;
let _sessionEntry;
let _autoSaveTimeout;
let _isWindowBlur = false; // has the user left the window
let _db;
const ID_DB = "MortyDB";
const ID_STORE = "sessionStore";

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreaming = () => {
  setTimeout(() => {
    // indicator of streaming ended
    let elements = document.querySelectorAll(
      '[class*="' + _config.KEYWORD_STREAMING + '"]'
    );
    if (elements.length > 0) {
      monitorStreaming();
      log("monitoring streaming ...");
    } else {
      log("streaming ends");
      _isStreaming = false;

      // data logging
      _sessionEntry.response.timeStreamingEnded = time();
      _sessionEntry.response.height =
        _elmResponse.getBoundingClientRect().height;

      // auto save when the user is not focused on the current window
      if (_isWindowBlur) {
        _autoSaveTimeout = setTimeout(() => {
          saveLog();
        }, TIMEOUT_AUTO_LOG_SAVE);
      }
    }
  }, INTERVAL_MONITOR_STREAMING);
};

//
//  start the routine of monitoring streaming
//
const startMonitoring = () => {
  if (_isStreaming) {
    return;
  }

  log("looking for streaming div ...");
  let divStreaming = document.querySelector(
    "[class*='" + _config.KEYWORD_STREAMING + "']"
  );

  if (divStreaming != null) {
    log("found the streaming div!");
    let elements = document.querySelectorAll(_config.QUERY_ELM_RESPONSE);
    _elmResponse = elements[elements.length - 1];

    // keep monitoring until the actual response arrives
    if (_elmResponse.textContent.length == 0) {
      return;
    }

    log("streaming starts");
    _isStreaming = true;

    // data logging
    _sessionEntry.timeStamp = time();
    _sessionEntry.on = _on;
    _sessionEntry.response.timeStreamingStarted = time();
    _sessionEntry.viewHeight = window.innerHeight;

    monitorStreaming();

    logInteractionBehaviorOnResponse();
  } else {
    setTimeout(() => {
      startMonitoring();
    }, 1000);
  }
};

//
//  trigger a dialog to download an object as a json file
//
const downloadObjectAsJson = (exportObj, exportName) => {
  // convert the object to a JSON string
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportObj));

  // create an invisible anchor element
  const downloadAnchorNode = document.createElement("a");

  // set the download attribute with a filename
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");

  // append the anchor to the document, trigger a click on it, and then remove it
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

//
//
//
const initPopupUI = () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons and content
      buttons.forEach((btn) => btn.classList.remove("active"));
      contents.forEach((content) => content.classList.remove("active"));

      // Add active class to the clicked button and corresponding content
      button.classList.add("active");
      document
        .getElementById(button.getAttribute("data-tab"))
        .classList.add("active");
    });
  });
};

//
// initialization
//
const init = () => {
  log("ready");

  // trigger mitigation from enter key press to send prompt
  document.addEventListener(
    "keydown",
    async (event) => {
      if (event.target.id === _config.ID_PROMPT_INPUT) {
        _promptCurrent = event.target.innerText;

        if (event.key === "Enter" && !event.shiftKey) {
          const prompt = event.target.innerText;

          // data logging - saving previous session
          if (_isLogging && _sessionEntry != undefined) {
            await saveLog();
            clearTimeout(_autoSaveTimeout);
            log("auto save timeout cleared");
          }

          _sessionEntry = createNewLogEntry();
          _sessionEntry.prompt.text = _promptCurrent;
          _sessionEntry.prompt.timeSent = time();
          log("prompt logged");

          startMonitoring();
        }
      } else {
        // data logging
        if (_sessionEntry != undefined) {
          _sessionEntry.interactionBehaviors.keydownEvents.push({
            timeStamp: time(),
            key: event.key,
          });
        }
      }
    },
    true
  );

  // trigger mitigation from pressing send button
  document.addEventListener("click", function (event) {
    // currently svg can capture this button press but maybe also svg's
    // but with false positives, configCff wouldn't cause any subsequent actions
    if (event.target.tagName === "svg") {
      // data logging
      _sessionEntry = createNewLogEntry();
      _sessionEntry.prompt.text = _promptCurrent;
      _sessionEntry.prompt.timeSent = time();

      startMonitoring();
    }
  });

  // create on-web-page ui
  const btnSwitch = document.createElement("img");
  btnSwitch.src = chrome.runtime.getURL(_config.URL_ICON);
  btnSwitch.alt = "Toggle Button";
  btnSwitch.classList.add("switch");
  btnSwitch.style.filter = _on ? "" : "grayscale(100%)";
  btnSwitch.addEventListener("click", (e) => {
    if (popup.style.display === "none") {
      popup.style.display = "block";
      aggregateSeries();
      // testChartJs();
    } else {
      popup.style.display = "none";
    }
  });
  btnSwitch.addEventListener("dblclick", () => {
    readFromDB((logData) => {
      downloadObjectAsJson(logData, "morty_log_" + time().replace(":", "_"));
    });
  });
  document.body.appendChild(btnSwitch);

  // create on-web-page mini page
  const popup = document.createElement("div");
  popup.classList.add("mini-popup");
  popup.style.display = "none"; // Initially hidden
  document.body.appendChild(popup);

  // fetch the HTML file
  const popupHtmlPath = chrome.runtime.getURL(PATH_POPUP_HTML);
  fetch(popupHtmlPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load HTML file: ${response.statusText}`);
      }
      return response.text();
    })
    .then((htmlContent) => {
      // inject the HTML content into the target element
      popup.innerHTML = htmlContent;
      initPopupUI();
    })
    .catch((error) => {
      // handle errors
      log(error.message);
    });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (_sessionEntry == undefined) {
        return;
      }

      _sessionEntry.interactionBehaviors.windowleaveEvents.push({
        timeStamp: time(),
      });
      _isWindowBlur = false;
      // if the user leaves the page during streaming, we assume they are not done with the session
      // so we don't end and save the log entry
      if (!_isStreaming && _autoSaveTimeout == undefined) {
        _autoSaveTimeout = setTimeout(() => {
          saveLog();
          // in case the user wasn't engaged
          // fadeOutAndRemove(_divAgreementRating);
          _autoSaveTimeout = undefined;
        }, TIMEOUT_AUTO_LOG_SAVE);
        log("auto save timeout started");
      }
    } else if (document.visibilityState === "visible") {
      if (_sessionEntry == undefined) return;
      _sessionEntry.interactionBehaviors.windowenterEvents.push({
        timeStamp: time(),
      });
      _isWindowBlur = true;
      clearTimeout(_autoSaveTimeout);
      log("auto save timeout cleared");
      _autoSaveTimeout = undefined;
    }
  });
};

//
//  save the latest session's log entry
//
const saveLog = async () => {
  if (
    _sessionEntry == undefined ||
    _sessionEntry.timeStamp == undefined ||
    _sessionEntry.prompt.text == undefined
  ) {
    return;
  }

  return new Promise((resolve, reject) => {
    writeToDB(_sessionEntry, () => {
      log("data successfully stored.");
      log(_sessionEntry);
      _sessionEntry = undefined;
      resolve();
    });
  });
};

//
//
//
const aggregateSeries = () => {
  openDB((event) => {
    readFromDB((series) => {
      const series_timeStamps = [];
      const mapDailyStats = new Map();
      let cnt_sessions = 0;

      // preprocesing log for visualization
      for (const entry of series) {
        // log(entry)
        cnt_sessions += 1;
        series_timeStamps.push(entry.timeStamp);

        // update a map of daily stats
        const strDate = entry.timeStamp.split("T")[0];
        let numSessions = 0;
        if (mapDailyStats.has(strDate)) {
          numSessions = mapDailyStats.get(strDate);
        }
        mapDailyStats.set(strDate, numSessions + 1);
      }

      plot(mapDailyStats)

      // log(mapDailyStats)

      // const minDate = new Date(
      //   Math.min(...series_timeStamps.map((date) => new Date(date).getTime()))
      // );
      // const maxDate = new Date(
      //   Math.max(...series_timeStamps.map((date) => new Date(date).getTime()))
      // );
      // const days = ((maxDate - minDate) / (1000 * 60 * 60 * 24) | 0);
      // log("avg # of sessions per day: " + (cnt_sessions / days))

      // const dates = [...mapDailyStats.keys()].sort((a, b) =>
      //   a.localeCompare(b)
      // );
      // const minDate = dates[0]; // First date in sorted order
      // const maxDate = dates[dates.length - 1]; // Last date in sorted order
    });
  });
};

const plot = (dataMap) => {
  const data = Array.from(dataMap, ([date, value]) => ({
    date: new Date(date), // Convert to Date object
    value,
  }));

  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date)) // Get min and max dates
    .range([0, width]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)]) // Scale to max value
    .range([height, 0]);

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d"));
  const yAxis = d3.axisLeft(y);

  const svg = d3
    .select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  svg.append("g").attr("transform", `translate(0,${height})`).call(xAxis);

  svg.append("g").call(yAxis);

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
};

//
const testChartJs = () => {
  // set the dimensions and margins of the graph
  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 460 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  //Read the data
  d3.csv(
    "https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/3_TwoNumOrdered_comma.csv",

    // When reading the csv, I must format variables:
    function (d) {
      return { date: d3.timeParse("%Y-%m-%d")(d.date), value: d.value };
    }
  ).then(
    // Now I can use this dataset:
    function (data) {
      // Add X axis --> it is a date format
      const x = d3
        .scaleTime()
        .domain(
          d3.extent(data, function (d) {
            return d.date;
          })
        )
        .range([0, width]);
      svg
        .append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x));

      // Add Y axis
      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(data, function (d) {
            return +d.value;
          }),
        ])
        .range([height, 0]);
      svg.append("g").call(d3.axisLeft(y));

      // Add the line
      svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d.date);
            })
            .y(function (d) {
              return y(d.value);
            })
        );
    }
  );
};

//
//  create an empty new log entry
//
const createNewLogEntry = () => {
  return {
    timeStamp: time(),
    prompt: {
      timeSent: undefined,
      text: undefined,
    },
    response: {
      timeStreamingStarted: undefined,
      timeStreamingEnded: undefined,
      height: undefined,
    },
    interactionBehaviors: {
      scrollEvents: [],
      clickEvents: [],
      mousedownEvents: [],
      mousemoveEvents: [],
      mouseupEvents: [],
      mouseenterEvents: [],
      mouseleaveEvents: [],
      copyEvents: [],
      windowenterEvents: [],
      windowleaveEvents: [],
      keydownEvents: [],
    },
    agreementRating: {
      timeStamp: undefined, // the time of the last-hovered rating
      rating: undefined,
    },
  };
};

//
// for continuous data (e.g., mouse move, scrolling),
// push it to the queue if it's dt apart from previous data point
// (to avoid oversampling)
// aggrFunc is a custom function to aggregate "dense" data points' values into a single one
//
const pushIfApart = (array, entry, dt, aggrFunc) => {
  if (array.length === 0) {
    array.push(entry);
    return;
  }

  const timeStampPrev = array[array.length - 1].timeStamp;

  if (new Date().getTime() - new Date(timeStampPrev).getTime() > dt) {
    array.push(entry);
  } else if (aggrFunc != undefined) {
    aggrFunc(array, entry);
  }
};

//
//  attach event listeners to log interaction behaviors
//
const logInteractionBehaviorOnResponse = () => {
  _elmResponse.addEventListener("click", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.clickEvents.push({ timeStamp: time() });
  });

  _elmResponse.addEventListener("mousewheel", (e) => {
    if (_sessionEntry == undefined) return;
    pushIfApart(
      _sessionEntry.interactionBehaviors.scrollEvents,
      { timeStamp: time(), offset: e.deltaY },
      DT_EVENTS,
      (array, entry) => {
        if (array.length > 0) {
          array[array.length - 1].offset += entry.offset;
        }
      }
    );
  });

  _elmResponse.addEventListener("mousedown", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mousedownEvents.push({
      timeStamp: time(),
      coord: { x: e.clientX, y: e.clientY },
    });
  });

  _elmResponse.addEventListener("mousemove", (e) => {
    if (_sessionEntry == undefined) return;
    pushIfApart(
      _sessionEntry.interactionBehaviors.mousemoveEvents,
      { timeStamp: time(), coord: { x: e.clientX, y: e.clientY } },
      DT_EVENTS
    );
  });

  _elmResponse.addEventListener("mouseup", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseupEvents.push({
      timeStamp: time(),
      coord: { x: e.clientX, y: e.clientY },
    });
  });

  _elmResponse.addEventListener("mouseenter", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseenterEvents.push({
      timeStamp: time(),
    });
  });

  _elmResponse.addEventListener("mouseleave", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseleaveEvents.push({
      timeStamp: time(),
    });
  });

  _elmResponse.addEventListener("copy", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.copyEvents.push({
      timeStamp: time(),
      length: window.getSelection().toString().length,
    });
  });
};

//
//  shortcut method to get the current time as a string
//
const time = () => {
  return new Date().toISOString();
};

//
//  a short cut to do console.log
//
const log = (msg) => {
  console.info("[morty]", time(), msg);
};

//
//
//
const openDB = (onSuccess) => {
  const request = indexedDB.open(ID_DB, 1);

  request.onupgradeneeded = function (event) {
    _db = event.target.result;
    if (!_db.objectStoreNames.contains(ID_STORE)) {
      const store = _db.createObjectStore(ID_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      log("object store created");
    } else {
      log("object store already exists");
    }
  };

  request.onsuccess = function (event) {
    _db = event.target.result;
    log("database opened successfully in content script");
    onSuccess();
  };

  request.onerror = function (event) {
    log(event);
    log("error code: " + event.target.errorCode);
  };
};

//
// writing to indexedDB
//
const writeToDB = (data, onSuccess) => {
  const transaction = _db.transaction([ID_STORE], "readwrite");
  const store = transaction.objectStore(ID_STORE);

  const addRequest = store.add(data);

  addRequest.onsuccess = function (event) {
    log("data added successfully in content script");
    if (onSuccess != undefined) {
      onSuccess();
    }
  };

  addRequest.onerror = function (event) {
    log("error adding data in content script", event);
  };
};

//
//  reading from indexedDB
//
const readFromDB = (onSuccess) => {
  const transaction = _db.transaction([ID_STORE], "readonly");
  const store = transaction.objectStore(ID_STORE);

  const getRequest = store.getAll();

  getRequest.onsuccess = (event) => {
    if (onSuccess == undefined) {
      log("Data retrieved: ");
      log(getRequest.result);
    } else {
      onSuccess(getRequest.result);
    }
  };

  getRequest.onerror = (event) => {
    log("error retrieving data: ");
    log(event);
  };
};

const injectScript = (url, callback) => {
  const script = document.createElement("script");
  script.src = url;
  script.onload = callback; // Call the function when the script loads
  document.head.appendChild(script);
};

//
//  entry function
//
(function () {
  const jsonFilePath = chrome.runtime.getURL(PATH_CONFIG_FILE);

  // load _config file
  window.addEventListener("load", function () {
    fetch(jsonFilePath)
      .then((response) => response.json())
      .then((data) => {
        _config = data;

        init();

        // DANGER! KEEP IT COMMENTED
        // indexedDB.deleteDatabase(ID_DB);

        openDB(readFromDB);

        _sessionEntry = createNewLogEntry();
      })
      .catch((error) => console.error("Error fetching JSON:", error));
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log("from popup: " + request);
    sendResponse({ status: "message logged" });
  });
})();
