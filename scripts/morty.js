//
//
//

const PATH_CONFIG_FILE = "data/config.json"

// cognitive forcing function variations
const CFF_WAIT = 0
const CFF_ONDEMAND = 1
const CFF_NONE = -1

// design parameters for cff
const HEIGHT_CFF_CONTAINER = 100

// design parameters for cff_wait
const FADE_RATIO = 1.25 // how fast the covered response area fades
const FADE_OPACITY = 0.05 // the lowest opacity
const FADE_INTERVAL = 100 // smoothness of fading

// design parameters for cff_ondemand
const HTML_REVEAL_INFO = "(Click to reveal AI response)"

// design parameters for showing hints
const ID_HINT_TEXT = "pHint"

// prompt-related parameters
const LABEL_HINTS = "hint: "
const LABEL_CLOSED_ENDED_TASKS = "closed-ended"
const LABEL_OPEN_ENDED_TASKS = "open-ended"

// default values
const CFF_DEFAULT = 1
const WAITTIME_DEFAULT = 0
const HINTs_DEFAULT = true

const CONFI_QUESTION_PROMPT = "How confident are you if you were to respond to this prompt without ChatGPT's help?"

// appended prompt to ask for task type -- open vs. close ended
const TEXT_PROMPT_TASK_TYPE_DETECTION = "\nBefore responding to the prompt, the first line of output should state whether the above prompt is an open-ended or closed-ended. Examples of open-ended tasks include writing, content creation, problem-solving, and idea generation."
// appended prompt for hint
const TEXT_PROMPT_HINTS = "\nIf it is an open-ended task, first come up with a question to help me independently think about the task. The question should be in the format of '" + LABEL_HINTS + "'....?'."
// final line if no prompt augmentation; just show the response
const TEXT_NO_PROMPT_AUGMENTATION = "\nThe following line should then start showing the answer."
// whether to remove the intermediate prompts/response as a result of the above
let _toRemoveIntermediateContents = false

// overreliance technique controls
let _cff = CFF_ONDEMAND // which cognitive forcing function
let _cffOptHints = true // whether to show hints when blocking the response
let _waitTime = 0 // additional wait time after screening is finished
let _hint = undefined
let _on = true

// others
const INTERVAL_MONITOR_STREAMING = 2000 // ms
let _config = {}
let _observerNewResponse = undefined
let _elmResponse = undefined
let _divCff = undefined
let _elmPrompt = undefined
let _elmSendBtn = undefined

// TODO : find a bette way to let user choose how to add extra prompt
let _useCustomChatGPT = true

//
// callback function to execute when mutations are observed
//
const callbackNewResponse = (mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(_config.KEYWORD_STREAMING)) {
                    _observerNewResponse.disconnect()

                    console.log("streaming starts")
                    monitorStreaming()

                    // reset all previous response elements to full opacity
                    var elements = document.querySelectorAll(_config.QUERY_ELM_RESPONSE)
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })

                    _elmResponse = elements[elements.length - 1]

                    if (_on) {
                        setupCffElements()
                        setupConfElements(_divCff)
                        monitorTaskTypeInfo()
                    }

                    // reset the send button element b/c it will change in the next prompt
                    _elmSendBtn = undefined

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
    else {
        if (_toRemoveIntermediateContents) {
            removeIntermediateResponse()
        }
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
// monitor task type based on ai response
//
const monitorTaskTypeInfo = () => {
    setTimeout(() => {
        if (_elmResponse.innerHTML.toLowerCase().includes("open-ended")) {
            // do nothing
        } else if (_elmResponse.innerHTML.toLowerCase().includes("closed-ended")) {
            revealResponse()
        } else {
            monitorTaskTypeInfo()
        }
    }, INTERVAL_MONITOR_STREAMING)
}

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreaming = () => {
    setTimeout(() => {
        // detecting if AI-generated hints has not been created
        if (_cffOptHints && document.getElementById(ID_HINT_TEXT) == undefined) {
            let pElms = _elmResponse.querySelectorAll('p')
            pElms.forEach((elm) => {
                if (elm.textContent.toLowerCase().includes(LABEL_HINTS)) {
                    // if length doesn't change, that means the hints has been fully streamed
                    if (_hint != undefined && elm.textContent.length == _hint.length) {
                        let idxHintStart = _hint.indexOf(LABEL_HINTS) + LABEL_HINTS.length
                        setupHintElements(_divCff, _hint.substring(idxHintStart))
                    }
                    _hint = elm.textContent
                }
            })
        }

        // indicator of streaming ended
        var elements = document.querySelectorAll('[class*="' + _config.KEYWORD_STREAMING + '"')
        if (elements.length > 0) {
            monitorStreaming()
        } else {
            console.log("streaming ended")
            if (_cff == CFF_WAIT) {
                setTimeout(() => {
                    revealResponse()
                }, _waitTime)
            }
        }
    }, INTERVAL_MONITOR_STREAMING)

}

//
// remove children in the container and remove the container
//
const clearCffContainer = (fadeOut = true) => {
    _divCff.innerHTML = ""
    if (fadeOut) {
        fadeOutAndRemove(_divCff)
    } else {
        _divCff.remove()
    }
    _elmResponse.parentElement.removeEventListener("click", revealResponse)
}

//
//  remove the prompt appendix to obtain closed/open-endedness and hints
//
const removeIntermediatePrompt = (prompt) => {
    const allDivs = document.querySelectorAll('div');

    const textOnlyDivs = Array.from(allDivs).filter(div => {
        // check if every childNode is a text node (nodeType === 3)
        return Array.from(div.childNodes).every(node => node.nodeType === 3);
    });

    textOnlyDivs.forEach((elm) => {
        if (elm.innerHTML.includes(prompt)) {
            elm.innerHTML = elm.innerHTML.replace(prompt, "")
            console.log("intermediate prompt removed", prompt)
        }
    })
}

//
//  remove the response that shows closed/open-endedness and hints
//
const removeIntermediateResponse = () => {
    let pElms = document.querySelectorAll('p')
    pElms.forEach((elm) => {
        let text = elm.textContent.toLowerCase()
        if (text.includes(LABEL_OPEN_ENDED_TASKS) || text.includes(LABEL_CLOSED_ENDED_TASKS) || text.includes(LABEL_HINTS)) {
            elm.remove()
            console.log("intermediate response removed", text)
        }
    })
}

//
// set up the cff elements
//
const setupCffElements = () => {
    _elmResponse.style.opacity = FADE_OPACITY.toString()
    clearCffContainer(false)
    _elmResponse.parentElement.appendChild(_divCff)

    if (_cffOptHints) {
        _hint = undefined
    }

    if (_cff == CFF_ONDEMAND) {
        const spanRevealInfo = document.createElement('span')
        spanRevealInfo.classList.add("reveal")
        spanRevealInfo.innerHTML = HTML_REVEAL_INFO
        _divCff.appendChild(spanRevealInfo)
        // _elmResponse.parentElement.
        spanRevealInfo.addEventListener("click", revealResponse)
    }
}

//
// add hint text over the response area that triggers users to think
//
const setupHintElements = (container, hint) => {
    const paragraph = document.createElement("p")
    paragraph.classList.add("hint")
    const k = Math.floor(Math.random() * 1009)
    paragraph.innerHTML = hint == undefined ? _config.HINTTEXTS[k % _config.HINTTEXTS.length] : hint
    paragraph.id = ID_HINT_TEXT
    container.prepend(paragraph)
}

//
//
//
const setupConfElements = (container) => {
    const divRating = createConfRatingUI()
    // const ratingHtmlUrl = chrome.runtime.getURL("scripts/rating.html")
    // fetch(ratingHtmlUrl).
    // then(response => response.text()) // Get the response text
    // .then(html => {
    //     divRating.innerHTML = html; // Insert HTML into the DOM
    // })
    // .catch(err => {
    //     console.error('Failed to load page: ', err);
    //     document.getElementById('contentArea').innerHTML = 'Failed to load content.';
    // });
    container.prepend(divRating)

    // const ratingJsUrl = chrome.runtime.getURL("scripts/rating.js")
    // var th = document.getElementsByTagName('body')[0];
    // var s = document.createElement('script');
    // s.setAttribute('type', 'text/javascript');
    // s.setAttribute('src', ratingJsUrl);
    // th.appendChild(s);
}

const createConfRatingUI = () => {
    const divRating = document.createElement("div")

    const pRatingQuestion = document.createElement("p")
    pRatingQuestion.innerHTML = CONFI_QUESTION_PROMPT
    divRating.appendChild(pRatingQuestion)

    const divDots = document.createElement("div")

    for (let i = 1; i <= 5; i++) {
        const spanDot = document.createElement("span")
        spanDot.classList.add("dot")
        spanDot.addEventListener("click", () => { updateLabel(i) })
        divDots.appendChild(spanDot)
    }

    const spanConf = document.createElement("span")
    spanConf.setAttribute("id", "label")
    divDots.appendChild(spanConf)

    divRating.appendChild(divDots)

    return divRating
}

const updateLabel = (level) => {
    console.log("updating label")
    var labels = [
        "Not confident at all",
        "Slightly confident",
        "Moderately confident",
        "Very confident",
        "Extremely confident"
    ];
    document.getElementById("label").innerHTML = labels[level - 1];

    // Update dot appearance
    var dots = document.getElementsByClassName("dot");
    for (var i = 0; i < dots.length; i++) {
        if (i < level) {
            dots[i].classList.add("selected");
        } else {
            dots[i].classList.remove("selected");
        }
    }
}

//
// reveal ai response
//
const revealResponse = (e) => {
    clearCffContainer()
    fadeIn(_elmResponse)
}

//
//  append prompt to the user-input prompt (necessary hack for implementing cff and hint)
//
const appendPrompt = () => {
    let promptExtra = ""

    // if cff is on
    if (_cff != CFF_NONE) {
        promptExtra += TEXT_PROMPT_TASK_TYPE_DETECTION

        // hint option only make sense when cff is on
        if (_cffOptHints) {
            promptExtra += TEXT_PROMPT_HINTS
        }

        promptExtra += TEXT_NO_PROMPT_AUGMENTATION

        if (_toRemoveIntermediateContents) {
            setTimeout(() => {
                removeIntermediatePrompt(promptExtra)
            }, 1000)
        }
    }

    return promptExtra
}

//
// configure cff: start or stop the monitor for implementing cff on the response element
//
const configCff = () => {
    if (_cff != CFF_NONE) {
        // create an instance of MutationObserver
        _observerNewResponse = new MutationObserver(callbackNewResponse)
        const divChat = document.querySelector(_config.QUERY_CHAT_DIV)
        _observerNewResponse.observe(divChat, { childList: true, subtree: true })

        // create a container for added cff elements
        _divCff = document.createElement("div")
        _divCff.classList.add("cff-container")
        _divCff.classList.add(document.documentElement.getAttribute("class"))

        // position the cff container at a fixed position above the prompt input box
        let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
        const rect = elmPromptBox.getBoundingClientRect()
        const topPosition = rect.top + window.scrollY;
        _divCff.style.height = `${HEIGHT_CFF_CONTAINER}px`
        _divCff.style.top = `${topPosition - HEIGHT_CFF_CONTAINER}px`

    } else if (_cff === CFF_NONE) {
        if (_observerNewResponse != undefined) {
            _observerNewResponse.disconnect()
        }
    }
}

//
// attach event listenrs to prompt textbox to append cff inducing prompts
//
const attachEventListeners = () => {
    // intercept the sending of prompts: enter key and send button
    _elmPrompt = document.getElementById(_config.ID_PROMPT_INPUT)

    _elmPrompt.addEventListener('keydown', (e) => {
        if (_on && e.key === "Enter" && !e.shiftKey) {
            if (_cff != CFF_NONE && !_useCustomChatGPT) {
                const promptExtra = appendPrompt()
                if (e.target.value.indexOf(promptExtra) < 0) {
                    e.target.value += promptExtra
                }
            }
            configCff()
        }
    }, true)

    // add prompt augmentation to the send button
    // because the send button is updated/renewed after typing in the prompt
    // an event handler needs to be added in real time
    _elmPrompt.addEventListener('keyup', (e) => {
        if (_elmSendBtn == undefined) {
            _elmSendBtn = document.querySelector(_config.QUERY_SEND_BTN)
            if (_elmSendBtn != undefined) {
                _elmSendBtn.addEventListener('click', (e) => {
                    if (_on && _cff != CFF_NONE && !_useCustomChatGPT) {
                        const promptExtra = appendPrompt()
                        if (_elmPrompt.value.indexOf(promptExtra) < 0) {
                            _elmPrompt.value += promptExtra
                        }
                    }
                    configCff()
                }, true)
            }
        }
    })
}

//
// initialization
//
const init = () => {
    // read stored settings
    chrome.storage.local.get(['cff'], (result) => {
        _cff = result.cff == undefined ? CFF_DEFAULT : result.cff
        configCff()
    })
    chrome.storage.local.get(['waitTime'], (result) => {
        _waitTime = result.waitTime == undefined ? WAITTIME_DEFAULT : result.waitTime
    })
    chrome.storage.local.get(['hints'], (result) => {
        _cffOptHints = result.hints == undefined ? HINTs_DEFAULT : result.hints
    })

    console.log("morty ready")

    // receive setting updates from popup
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            console.log("updates from popup:", request)
            if (request.cff != undefined && _cff != request.cff) {
                _cff = request.cff
                configCff()
            } else if (request._waitTime != undefined) {
                _waitTime = request.waitTime
            } else if (request.hints != undefined) {
                _cffOptHints = request.hints
            }

        }
    )

    attachEventListeners()

    // intermediate prompts and responses will be retrieved from server
    // we can remove them manually
    if (_toRemoveIntermediateContents) {
        setTimeout(() => {
            removeIntermediatePrompt(TEXT_PROMPT_TASK_TYPE_DETECTION)
            removeIntermediatePrompt(TEXT_PROMPT_HINTS)
            removeIntermediatePrompt(TEXT_NO_PROMPT_AUGMENTATION)
            removeIntermediateResponse()
        }, 2000);
    }

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

            // clicking an <a/> will lose some event handlers so need to re-init everything
            setTimeout(() => {
                document.querySelectorAll('a').forEach(elmA => {
                    elmA.addEventListener('click', (e) => {
                        setTimeout(() => {
                            attachEventListeners()
                            console.log("re-init-ed")
                        }, 1000)
                    })
                })
            }, 1000)
        })
        .catch(error => console.error('Error fetching JSON:', error))
})()