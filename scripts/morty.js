//
//
//

const PATH_CONFIG_FILE = "data/config.json"

// design parameters for cff
const HEIGHT_CFF_CONTAINER = 100
const HEIGHT_POST_RESPONSE = 300
const INTERVAL_MONITOR_STREAMING = 1000 // ms

// design parameters for cff
const FADE_RATIO = 1.25 // how fast the covered response area fades
const FADE_OPACITY = 0.05 // the lowest opacity
const FADE_INTERVAL = 100 // smoothness of fading
const HTML_REVEAL_INFO = "(Click to reveal AI response)"

// users' confidence levels
const CONFI_QUESTION_PROMPT = "How confident are you if you were to respond to this prompt without ChatGPT's help?"
const CONFIDENCE_LEVELS = [
    "Not confident at all",
    "Slightly confident",
    "Moderately confident",
    "Quite confident",
    "Very confident"
]

// agreement rating
const AGREEMENT_QUESTION_PROMPT = "Do you agree with ChatGPT?"
const AGREEMENT_LEVELS = [
    "Totally disagree",
    "Somewhat disagree",
    "Have doubt",
    "Somewhat agree",
    "Totally agree"
]
const TIMEOUT_PLACEHOLDER_RESET = 30000
const STYLE_AGREEMENT_RATING = "rgba(255, 255, 0, 0.25)"


let _on = false
let _isStreaming = false
let _config = {}
let _observerNewResponse = undefined
let _elmResponse = undefined
let _divCff = undefined
let _promptCurrent = undefined
let _placeholderPrompt = undefined
let _divAgreementRating = undefined
let _isFollowUp = false

// data logging
const DT_EVENTS = 250
const TIMEOUT_AUTO_LOG_SAVE = 30000
let _isLogging = true
let _sessionEntry
let _autoSaveTimeout
let _isWindowBlur = false   // has the user left the window
let _db
const ID_DB = "MortyDB"
const ID_STORE = "sessionStore"

//
// callback function to execute when mutations are observed
//
const callbackNewResponse = (mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && typeof node.className.includes == "function" && node.className.includes(_config.KEYWORD_STREAMING)) {
                    var elements = document.querySelectorAll(_config.QUERY_ELM_RESPONSE)
                    _elmResponse = elements[elements.length - 1]

                    // keep monitoring until the actual response arrives
                    if (_elmResponse.textContent.length == 0) {
                        return
                    }
                    _observerNewResponse.disconnect()

                    log("streaming starts")
                    _isStreaming = true

                    // data logging
                    _sessionEntry.timeStamp = time()
                    _sessionEntry.on = _on
                    _sessionEntry.response.timeStreamingStarted = time()
                    _sessionEntry.viewHeight = window.innerHeight

                    monitorStreaming()

                    // reset all previous response elements to full opacity
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })

                    logInteractionBehaviorOnResponse()

                    _sessionEntry.prompt.isFollowUp = _isFollowUp
                    if (_on && !_isFollowUp) {
                        setupCffElements()
                        const divRating = setupRatingUI("labelConfidence", CONFI_QUESTION_PROMPT, CONFIDENCE_LEVELS, false, (idxRating) => {
                            // data logging
                            _sessionEntry.confidenceRating.rating = idxRating
                            _sessionEntry.confidenceRating.timeStamp = time()
                        })
                        _divCff.prepend(divRating)
                    }

                    return
                }
            })
        }
    }
}

//
//  fade in the AI response area
//
const fadeIn = (elm) => {
    if (elm == undefined) {
        return
    }

    const opacity = parseFloat(elm.style.opacity)
    if (opacity < 1) {
        elm.style.opacity = (opacity * FADE_RATIO).toString()
        setTimeout(() => {
            fadeIn(elm)
        }, FADE_INTERVAL)
    }
}

//
// fade out and remove an element
//
const fadeOutAndRemove = (element) => {
    // apply the fade-out class
    element.classList.add('fade-out')

    // listen for the end of the animation
    element.addEventListener('animationend', function () {
        element.classList.remove('fade-out')
        element.remove()
    });
}

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreaming = () => {
    setTimeout(() => {
        // indicator of streaming ended
        var elements = document.querySelectorAll('[class*="' + _config.KEYWORD_STREAMING + '"')
        if (elements.length > 0) {
            monitorStreaming()
            log("monitoring streaming ...")
        } else {
            log("streaming ends")
            _isStreaming = false

            // data logging
            _sessionEntry.response.timeStreamingEnded = time()
            _sessionEntry.response.height = _elmResponse.getBoundingClientRect().height

            if (_on) {
                // if the cff container has not been clear, don't set up post response yet;
                // instead, set it up when a user clicks to reveal response
                if (document.getElementsByClassName("cff-container").length <= 0) {
                    setupPostResponseElements()
                } else {
                    if (_elmResponse.parentElement != null) {
                        _elmResponse.parentElement.addEventListener("click", setupPostResponseElements)
                    }
                }

                _isFollowUp = false
            }

            // auto save when the user is not focused on the current window
            if (_isWindowBlur) {
                _autoSaveTimeout = setTimeout(() => {
                    saveLog()
                }, TIMEOUT_AUTO_LOG_SAVE);
            }
        }
    }, INTERVAL_MONITOR_STREAMING)

}

//
// remove children in the container and remove the container
//
const clearCffContainer = (fadeOut = true) => {
    if (fadeOut) {
        fadeOutAndRemove(_divCff)
    } else {
        _divCff.remove()
    }

    if (_elmResponse.parentElement != null) {
        _elmResponse.parentElement.removeEventListener("click", revealResponse)
    }
}

//
// set up the cff elements
//
const setupCffElements = () => {
    _elmResponse.style.opacity = FADE_OPACITY.toString()
    clearCffContainer(false)
    _elmResponse.parentElement.appendChild(_divCff)
    _elmResponse.parentElement.addEventListener("click", revealResponse)

    const spanRevealInfo = document.createElement('span')
    spanRevealInfo.classList.add("reveal")
    spanRevealInfo.innerHTML = HTML_REVEAL_INFO
    _divCff.appendChild(spanRevealInfo)

}

//
//  set up ui to specify rating
//  row: whether to place everything in a row (o/w in two lines: one for question and one for rating scale)
//  onRated: call back when rating changes (by mouse hovering)
//
const setupRatingUI = (id, question, labelsRating, row = false, onRated = undefined) => {
    const divRating = document.createElement("div")

    if (row) {
        divRating.classList.add("rating-row")
    }

    // the question
    const pRatingQuestion = document.createElement("p")
    pRatingQuestion.innerHTML = question
    pRatingQuestion.classList.add("rating-question")
    divRating.appendChild(pRatingQuestion)

    // the rating options
    const divDots = document.createElement("div")
    divDots.classList.add("dots")

    for (let i = 0; i < labelsRating.length; i++) {
        const spanDot = document.createElement("span")
        spanDot.classList.add("dot")
        spanDot.setAttribute("name", id + "-dot")
        spanDot.addEventListener("mouseover", (e) => {
            document.getElementById(id + "-span").innerHTML = labelsRating[i]

            const dots = document.getElementsByName(id + "-dot")
            for (let j = 0; j < dots.length; j++) {
                if (j <= i) {
                    dots[j].classList.add("selected")
                } else {
                    dots[j].classList.remove("selected")
                }
            }

            if (onRated) {
                onRated(i)
            }
        })

        divDots.appendChild(spanDot)
    }

    // the label that describes rating
    const spanRating = document.createElement("span")
    spanRating.setAttribute("id", id + "-span")
    spanRating.classList.add("rating")
    divDots.appendChild(spanRating)

    divRating.appendChild(divDots)

    return divRating
}

//
// reveal ai response
//
const revealResponse = () => {
    clearCffContainer(true)
    fadeIn(_elmResponse)
}

//
//  use a textarea's placeholder as a prefilled prefix for the text to be entered
//
const prefixPrompt = (e) => {
    e.target.value = e.target.getAttribute("placeholder") + " "
    const textLength = e.target.value.length
    e.target.setSelectionRange(textLength, textLength)

    // only do this prefixing once
    e.target.removeEventListener("click", prefixPrompt)
}

//
//  set up post response ui elements for mitigation 
//
const setupPostResponseElements = () => {
    const toolbar = document.querySelectorAll(_config.QUERY_TOOLBAR)[0]
    toolbar.appendChild(_divAgreementRating)

    document.getElementsByName("labelAgreement" + "-dot").forEach(elm => elm.classList.remove('selected'));
    const label = document.getElementById("labelAgreement" + "-span")
    if (label != null) {
        label.innerHTML = ""
    }

    // in case this is triggered by clicking the reveal response option
    // enable such handler only once
    _elmResponse.parentElement.removeEventListener("click", setupPostResponseElements)
}

//
//  use a simple rule to detect if the prompt is a follow-up based on disagreement
//
const isFollowUp = (prompt) => {
    for (idx in AGREEMENT_LEVELS) {
        if (idx <= AGREEMENT_LEVELS.length / 2) {
            if (prompt.includes("I " + AGREEMENT_LEVELS[idx].toLowerCase())) {
                return true
            }
        }
    }

    return false
}

//
// configure cff: start or stop the monitor for implementing cff on the response element
//
const configCff = () => {
    // create a container for added cff elements
    _divCff = document.createElement("div")
    _divCff.classList.add("cff-container")

    const isDarkMode = document.documentElement.getAttribute("class").indexOf("dark") > -1
    _divCff.classList.add(isDarkMode ? "dark" : "light")

    // position the cff container at a fixed position above the prompt input box
    let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
    let rect = elmPromptBox.getBoundingClientRect()
    let topPosition = rect.top + window.scrollY;
    _divCff.style.height = `${HEIGHT_CFF_CONTAINER}px`
    _divCff.style.top = `${topPosition - HEIGHT_CFF_CONTAINER}px`
}

//
//  start the routine of monitoring streaming
//
const startMonitoring = () => {
    // create an instance of MutationObserver
    _observerNewResponse = new MutationObserver(callbackNewResponse)
    const divChat = document.querySelector(_config.QUERY_CHAT_DIV)
    _observerNewResponse.observe(divChat, { childList: true, subtree: true })
}

//
//  trigger a dialog to download an object as a json file
//
const downloadObjectAsJson = (exportObj, exportName) => {
    // convert the object to a JSON string
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));

    // create an invisible anchor element
    const downloadAnchorNode = document.createElement('a');

    // set the download attribute with a filename
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");

    // append the anchor to the document, trigger a click on it, and then remove it
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}


//
// initialization
//
const init = () => {
    log("ready")

    // trigger mitigation from enter key press to send prompt
    document.addEventListener('keydown', async (event) => {
        if (event.target.id === _config.ID_PROMPT_INPUT) {
            _promptCurrent = event.target.innerText

            if (event.key === "Enter" && !event.shiftKey) {
                const prompt = event.target.innerText
                _isFollowUp = isFollowUp(prompt)

                if (_on) {
                    configCff()
                }

                // data logging - saving previous session
                if (_isLogging && _sessionEntry != undefined && _sessionEntry.timeStamp != undefined) {
                    await saveLog()
                    clearTimeout(_autoSaveTimeout)
                    log("auto save timeout cleared")
                }

                startMonitoring()

                _sessionEntry = createNewLogEntry()
                _sessionEntry.prompt.text = _promptCurrent
                _sessionEntry.prompt.timeSent = time()
                log("prompt logged")
            }
        } else {
            // data logging
            _sessionEntry.interactionBehaviors.keydownEvents.push({ timeStamp: time(), key: event.key })
        }

    }, true)

    // trigger mitigation from pressing send button
    document.addEventListener('click', function (event) {
        // currently svg can capture this button press but maybe also svg's
        // but with false positives, configCff wouldn't cause any subsequent actions
        if (event.target.tagName === "svg") {
            if (_on) {
                configCff()
            }

            startMonitoring()

            // data logging
            _sessionEntry = createNewLogEntry()
            _sessionEntry.prompt.text = _promptCurrent
            _sessionEntry.prompt.timeSent = time()
        }
    });

    // create on-web-page ui
    const btnSwitch = document.createElement('img')
    btnSwitch.src = chrome.runtime.getURL(_config.URL_ICON)
    btnSwitch.alt = 'Toggle Button'
    btnSwitch.classList.add("switch")
    btnSwitch.style.filter = _on ? '' : 'grayscale(100%)'
    btnSwitch.addEventListener('click', (e) => {
        // disabled for data logging under on/off conditions
        // todo: put back later when needed
        // _on = !_on
        // btnSwitch.style.filter = _on ? '' : 'grayscale(100%)'
    })
    btnSwitch.addEventListener("dblclick", () => {
        readFromDB((logData) => {
            downloadObjectAsJson(logData, "morty_log_" + time().replace(":", "_"))
        })
    })
    document.body.appendChild(btnSwitch)

    // extract the default placeholder in the prompt box
    let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
    if (elmPromptBox != null) {
        _placeholderPrompt = elmPromptBox.getAttribute("placeholder")
        // elmPromptBox.addEventListener("click", onClickPromptBox)
    } else {
        console.error("[morty]", "unable to locate prompt box!")
        alert("Error initiating MORTY. Please refresh this page.")
    }

    // set up the disagreement rating ui (just once)
    _divAgreementRating = setupRatingUI("labelAgreement", AGREEMENT_QUESTION_PROMPT, AGREEMENT_LEVELS, true, (idxRating) => {
        let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
        const ratingNormalized = idxRating * 1.0 / AGREEMENT_LEVELS.length
        const placeholder = "I " + AGREEMENT_LEVELS[idxRating].toLowerCase() + " because"
        if (ratingNormalized < 0.5) {
            elmPromptBox.setAttribute("placeholder", placeholder)

            // clicking the prompt box will use the placeholder as the prefix to prefill the prompt
            elmPromptBox.addEventListener("click", prefixPrompt)

            // remove it after a timeout, assuming the user would have ignored it by then
            setTimeout(() => {
                elmPromptBox.removeEventListener("click", prefixPrompt)
                elmPromptBox.setAttribute("placeholder", _placeholderPrompt)
            }, TIMEOUT_PLACEHOLDER_RESET);
        } else {
            elmPromptBox.setAttribute("placeholder", _placeholderPrompt)
            elmPromptBox.removeEventListener("click", prefixPrompt)
        }

        // data logging
        _sessionEntry.agreementRating.rating = idxRating
        _sessionEntry.agreementRating.timeStamp = time()
    })

    _divAgreementRating.style.background = STYLE_AGREEMENT_RATING

    // remove the agreement rating when finished, providing a closure
    _divAgreementRating.querySelectorAll('[name="labelAgreement-dot"]').forEach(elm => {
        elm.addEventListener("click", () => {
            fadeOutAndRemove(_divAgreementRating)
        })
    })

    // house keeping when starting a new chat
    let btnNewChat = document.querySelectorAll(_config.QUERY_NEWCHAT)[0]
    btnNewChat.addEventListener("click", () => {
        saveLog()
    })

}

//
//  save the latest session's log entry
//
const saveLog = async () => {
    if (_sessionEntry == undefined || _sessionEntry.timeStamp == undefined) {
        return
    }

    return new Promise((resolve, reject) => {
        writeToDB(_sessionEntry, () => {
            log('data successfully stored.')
            log(_sessionEntry)
            _sessionEntry = undefined
            resolve()
        })
    })

}

//
//  create an empty new log entry
//
const createNewLogEntry = () => {
    return {
        timeStamp: undefined,
        prompt: {
            timeStart: undefined,
            timeSent: undefined,
            text: undefined,
            isFollowUp: undefined
        },
        confidenceRating: {
            timeStamp: undefined, // the time of the last-hovered rating
            rating: undefined
        },
        response: {
            timeStreamingStarted: undefined,
            timeStreamingEnded: undefined,
            height: undefined
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
            keydownEvents: []
        },
        agreementRating: {
            timeStamp: undefined, // the time of the last-hovered rating
            rating: undefined
        }
    }
}

//
// for continuous data (e.g., mouse move, scrolling), 
// push it to the queue if it's dt apart from previous data point
// (to avoid oversampling)
// aggrFunc is a custom function to aggregate "dense" data points' values into a single one
//
const pushIfApart = (array, entry, dt, aggrFunc) => {
    if (array.length === 0) {
        array.push(entry)
        return
    }

    const timeStampPrev = array[array.length - 1].timeStamp

    if (new Date().getTime() - new Date(timeStampPrev).getTime() > dt) {
        array.push(entry)
    } else if (aggrFunc != undefined) {
        aggrFunc(array, entry)
    }
}

//
//  attach event listeners to log interaction behaviors
//
const logInteractionBehaviorOnResponse = () => {

    _elmResponse.addEventListener("click", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.clickEvents.push({ timeStamp: time() })
    })

    _elmResponse.addEventListener("mousewheel", (e) => {
        if (_sessionEntry == undefined) return
        pushIfApart(_sessionEntry.interactionBehaviors.scrollEvents, { timeStamp: time(), offset: e.deltaY }, DT_EVENTS, (array, entry) => {
            if (array.length > 0) {
                array[array.length - 1].offset += entry.offset
            }
        })
    })

    _elmResponse.addEventListener("mousedown", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.mousedownEvents.push({ timeStamp: time(), coord: { x: e.clientX, y: e.clientY } })
    })

    _elmResponse.addEventListener("mousemove", (e) => {
        if (_sessionEntry == undefined) return
        pushIfApart(_sessionEntry.interactionBehaviors.mousemoveEvents, { timeStamp: time(), coord: { x: e.clientX, y: e.clientY } }, DT_EVENTS)
    })

    _elmResponse.addEventListener("mouseup", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.mouseupEvents.push({ timeStamp: time(), coord: { x: e.clientX, y: e.clientY } })
    })

    _elmResponse.addEventListener("mouseenter", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.mouseenterEvents.push({ timeStamp: time() })
    })

    _elmResponse.addEventListener("mouseleave", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.mouseleaveEvents.push({ timeStamp: time() })
    })

    _elmResponse.addEventListener("copy", (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.copyEvents.push({ timeStamp: time(), length: window.getSelection().toString().length })
    })

    window.addEventListener('blur', (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.windowleaveEvents.push({ timeStamp: time() })
        _isWindowBlur = false
        // if the user leaves the page during streaming, we assume they are not done with the session
        // so we don't end and save the log entry
        if (!_isStreaming && _autoSaveTimeout == undefined) {
            _autoSaveTimeout = setTimeout(() => {
                saveLog()
                // in case the user wasn't engaged
                fadeOutAndRemove(_divAgreementRating)
                _autoSaveTimeout = undefined
            }, TIMEOUT_AUTO_LOG_SAVE);
            log("auto save timeout started")
        }
    })

    window.addEventListener('focus', (e) => {
        if (_sessionEntry == undefined) return
        _sessionEntry.interactionBehaviors.windowenterEvents.push({ timeStamp: time() })
        _isWindowBlur = true
        clearTimeout(_autoSaveTimeout)
        log("auto save timeout cleared")
        _autoSaveTimeout = undefined
    })
}

//
//  shortcut method to get the current time as a string
//
const time = () => {
    return new Date().toISOString()
}

//
//  a short cut to do console.log
//
const log = (msg) => {
    console.info("[morty]", time(), msg)
}

//
// todo: move this to a separate file
//
const openDB = (onSuccess) => {
    const request = indexedDB.open(ID_DB, 1);

    request.onupgradeneeded = function (event) {
        _db = event.target.result
        if (!_db.objectStoreNames.contains(ID_STORE)) {
            const store = _db.createObjectStore(ID_STORE, { keyPath: "id", autoIncrement: true })
            log("object store created")
        } else {
            log("object store already exists");
        }
    }

    request.onsuccess = function (event) {
        _db = event.target.result;
        log("database opened successfully in content script")
        onSuccess()
    }

    request.onerror = function (event) {
        log(event)
        log("error code: " + event.target.errorCode)
    }
}

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
            onSuccess()
        }
    };

    addRequest.onerror = function (event) {
        log("error adding data in content script", event);
    };
}

//
//  reading from indexedDB
//
const readFromDB = (onSuccess) => {
    const transaction = _db.transaction([ID_STORE], "readonly");
    const store = transaction.objectStore(ID_STORE);

    const getRequest = store.getAll();

    getRequest.onsuccess =
        (event) => {
            if (onSuccess == undefined) {
                log("Data retrieved: ")
                log(getRequest.result)
            } else {
                onSuccess(getRequest.result)
            }
        }

    getRequest.onerror = (event) => {
        log("error retrieving data: ")
        log(event)
    }
}

//
//  entry function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL(PATH_CONFIG_FILE)

    // load _config file
    window.addEventListener('load', function () {
        fetch(jsonFilePath)
            .then(response => response.json())
            .then(data => {
                _config = data

                init()

                // DANGER! KEEP IT COMMENTED
                // indexedDB.deleteDatabase(ID_DB);

                openDB(readFromDB)

                _sessionEntry = createNewLogEntry()
            })
            .catch(error => console.error('Error fetching JSON:', error))
    })
})()