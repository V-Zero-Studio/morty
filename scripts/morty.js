//
// MORTY: MAIN
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

    logInteractionBehaviorOn(_elmResponse, _sessionEntry);
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
// initialize pop-up ui (on the web page)
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
  btnSwitch.classList.add("icon-button");
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
