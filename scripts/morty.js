//
//
//

const PATH_CONFIG_FILE = "data/config.json"

// cognitive forcing function variations
const CFF_ONDEMAND = 1
const CFF_NONE = -1
const CFF_DEFAULT = 1

// design parameters for cff
const HEIGHT_CFF_CONTAINER = 100
const HEIGHT_POST_RESPONSE = 300
const INTERVAL_MONITOR_STREAMING = 1000 // ms

// design parameters for cff_wait
const FADE_RATIO = 1.25 // how fast the covered response area fades
const FADE_OPACITY = 0.05 // the lowest opacity
const FADE_INTERVAL = 100 // smoothness of fading

// design parameters for cff_ondemand
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


let _on = true
let _isStreaming = false
let _config = {}
let _observerNewResponse = undefined
let _elmResponse = undefined
let _divCff = undefined
let _elmPrompt = undefined
let _promptCurrent = undefined
let _placeholderPrompt = undefined
let _divAgreementRating = undefined
let _isFollowUp = false

// data logging
const TIMEOUT_AUTO_LOG_SAVE = 30000 // todo: increase this to, say, 5min
let _isLogging = true
let _sessionEntry
let _autoSaveTimeout
let _isWindowBlur = false   // has the user left the window
//
// callback function to execute when mutations are observed
//
const callbackNewResponse = (mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && typeof node.className.includes == "function" && node.className.includes(_config.KEYWORD_STREAMING)) {
                    _observerNewResponse.disconnect()

                    log("streaming starts")
                    _isStreaming = true

                    // data logging
                    _sessionEntry.timeStamp = time()
                    _sessionEntry.response.timeStreamingStarted = time()

                    monitorStreaming()

                    // reset all previous response elements to full opacity
                    var elements = document.querySelectorAll(_config.QUERY_ELM_RESPONSE)
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })
                    _elmResponse = elements[elements.length - 1]

                    logInteractionBehaviorOnResponse()

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
                    _elmResponse.parentElement.addEventListener("click", setupPostResponseElements)
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
    _elmResponse.parentElement.removeEventListener("click", revealResponse)
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
//  onRated: call back when rating changes
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
    e.target.setAttribute("placeholder", _placeholderPrompt)
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
    // create an instance of MutationObserver
    _observerNewResponse = new MutationObserver(callbackNewResponse)
    const divChat = document.querySelector(_config.QUERY_CHAT_DIV)
    _observerNewResponse.observe(divChat, { childList: true, subtree: true })

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
// initialization
//
const init = () => {
    log("morty ready")

    // intercept the sending of prompts: enter key and send button
    // _elmPrompt = document.getElementById(_config.ID_PROMPT_INPUT)

    // trigger mitigation from enter key press to send prompt
    document.addEventListener('keydown', function (event) {
        if (event.target.id === _config.ID_PROMPT_INPUT) {
            _promptCurrent = event.target.value
            if (_on && event.key === "Enter" && !event.shiftKey) {
                const prompt = event.target.value
                _isFollowUp = isFollowUp(prompt)
                configCff()

                // data logging
                _sessionEntry.prompt.text = _promptCurrent
                _sessionEntry.prompt.timeSent = time()
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
            configCff()

            // data logging
            _sessionEntry.prompt.text = _promptCurrent
            _sessionEntry.prompt.timeSent = time()
        }
    });

    // create on-web-page ui
    const btnSwitch = document.createElement('img')
    btnSwitch.src = chrome.runtime.getURL(_config.URL_ICON)
    btnSwitch.alt = 'Toggle Button'
    btnSwitch.classList.add("switch")
    btnSwitch.addEventListener('click', (e) => {
        _on = !_on
        btnSwitch.style.filter = _on ? '' : 'grayscale(100%)'
    })
    document.body.appendChild(btnSwitch)

    // extract the default placeholder in the prompt box
    let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
    _placeholderPrompt = elmPromptBox.getAttribute("placeholder")

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

    // remove the agreement rating when finished, providing a closure
    _divAgreementRating.querySelectorAll('[name="labelAgreement-dot"]').forEach(elm => {
        elm.addEventListener("click", () => {
            fadeOutAndRemove(_divAgreementRating)
        })
    })

    // starting a new prompt saves the previous session entry
    elmPromptBox.addEventListener("click", () => {
        if (_isLogging && _sessionEntry.timeStamp != undefined) {
            saveLog()
            clearTimeout(_autoSaveTimeout)
        }
    })
}

//
//  save the latest session's log entry
//
const saveLog = () => {
    if (!_isLogging || _sessionEntry == undefined || _sessionEntry.timeStamp == undefined) {
        return
    }
    const key = _sessionEntry.timeStamp
    let logItems = {}
    logItems[key] = _sessionEntry
    chrome.storage.sync.set(logItems, () => {
        log(_sessionEntry)
        _sessionEntry = createNewLogEntry()
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
            text: undefined
        },
        confidenceRating: {
            timeStamp: undefined, // todo: properly define this attr
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
            windowenterEvents: [],
            windowleaveEvents: [],
            keydownEvents: []
        },
        agreementRating: {
            timeStamp: undefined, // todo: properly define this attr
            rating: undefined
        }
    }
}

//
//  attach event listeners to log interaction behaviors
//
const logInteractionBehaviorOnResponse = () => {

    _elmResponse.addEventListener("click", (e) => {
        _sessionEntry.interactionBehaviors.clickEvents.push({ timeStamp: time() })
    })

    _elmResponse.addEventListener("mousewheel", (e) => {
        _sessionEntry.interactionBehaviors.scrollEvents.push({ timeStamp: time(), offset: e.deltaY })
    })

    _elmResponse.addEventListener("mousedown", (e) => {
        _sessionEntry.interactionBehaviors.mousedownEvents.push({ timeStamp: time(), coord: { x: e.clientX, y: e.clientY } })
    })

    _elmResponse.addEventListener("mousemove", (e) => {
        _sessionEntry.interactionBehaviors.mousemoveEvents.push({ timeStamp: time(), coord: { x: e.clientX, y: e.clientY } })
    })

    _elmResponse.addEventListener("mouseup", (e) => {
        _sessionEntry.interactionBehaviors.mouseupEvents.push({ timeStamp: time(), coord: { x: e.clientX, y: e.clientY } })
    })

    _elmResponse.addEventListener("mouseenter", (e) => {
        _sessionEntry.interactionBehaviors.mouseenterEvents.push({ timeStamp: time() })
    })

    _elmResponse.addEventListener("mouseleave", (e) => {
        _sessionEntry.interactionBehaviors.mouseleaveEvents.push({ timeStamp: time() })
    })

    window.addEventListener('blur', (e) => {
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
            console.info("auto save timeout started")
        }
    })

    window.addEventListener('focus', (e) => {
        _sessionEntry.interactionBehaviors.windowenterEvents.push({ timeStamp: time() })
        _isWindowBlur = true
        clearTimeout(_autoSaveTimeout)
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
    console.info("[morty]", msg)
}

//
//  entry function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL(PATH_CONFIG_FILE)

    // load _config file
    fetch(jsonFilePath)
        .then(response => response.json())
        .then(data => {
            _config = data

            init()

            chrome.storage.sync.get(null, function (items) {
                log('all data in sync storage:', items);
            })
            chrome.storage.sync.clear()
            _sessionEntry = createNewLogEntry()
        })
        .catch(error => console.error('Error fetching JSON:', error))
})()