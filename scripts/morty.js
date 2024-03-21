//
//
//

// cognitive forcing function variations
const CFF_WAIT = 0
const CFF_ONDEMAND = 1
const CFF_NONE = -1

// design parameters for cff
const HEIGHT_CFF_CONTAINER = 100

// design parameters for cff_wait
const FADE_RATIO = 1.25
const FADE_OPACITY = 0.05
const FADE_INTERVAL = 100

// design parameters for cff_ondemand
// const ID_BTN_REVEAL = "btnReveal"
const TEXT_BTN_REVEAL = "Click to See AI Response"
const HTML_REVEAL_INFO = "(Click to reveal AI response)"

// design parameters for showing hints
const ID_HINT_TEXT = "pHint"

// prompt-related parameters
const LABEL_HINTS = "hint:"
const LABEL_CLOSED_ENDED_TASKS = "closed-ended"
const LABEL_OPEN_ENDED_TASKS = "open-ended"

const TEXT_PROMPT_TASK_TYPE_DETECTION = "\nBefore responding to the prompt, the first line of output should state whether the above prompt is an open-ended or closed-ended. Examples of open-ended tasks include writing, content creation, problem-solving, and idea generation."
const TEXT_PROMPT_HINTS = "\nIf it is an open-ended task, first come up with a question to help me independently think about the task. The question should be in the format of '" + LABEL_HINTS + "' ....?'."
const TEXT_PROMPT_AUGMENTATION = "\nIf it is an open-ended task, next, show me some hints that allow me to think about my request and then show the answer; if the above prompt is a closed-ended question, just show the answer."
const TEXT_NO_PROMPT_AUGMENTATION = "\nThe following line should then start showing the answer."

// overreliance technique controls
let _cff = CFF_NONE // which cognitive forcing function
let _cffOptHints = false // whether to show hints when blocking the response
let _promptAug = false   // whether to augment prompt to prevent overreliance
let _waitTime = 0 // additional wait time after screening is finished
let _hint = undefined

// others
const INTERVAL_MONITOR_STREAMING = 2000 // ms

let _config = {}
let _observerNewResponse = undefined
let _elmResponse = undefined
let _divCff = undefined
let _elmPrompt = undefined
let _elmSendBtn = undefined
//
// callback function to execute when mutations are observed
//
const callbackNewResponse = (mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(_config.KEYWORDSTREAMING)) {
                    _observerNewResponse.disconnect()

                    console.log("streaming starts")
                    monitorStreaming()

                    var elements = document.querySelectorAll(_config.QUERYELMRESPONSE)
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })
                    _elmResponse = elements[elements.length - 1]

                    doCff()
                    monitorTaskTypeInfo()

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
        removeIntermediateResponse()
    }
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
// set up the cff elements
//
const doCff = () => {
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
        _elmResponse.parentElement.addEventListener("click", revealResponse)
    }
}

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreaming = () => {
    setTimeout(() => {
        // detecting AI-generated hints
        if (_cffOptHints && document.getElementById(ID_HINT_TEXT) == undefined) {
            let pElms = _elmResponse.querySelectorAll('p')
            pElms.forEach((elm) => {
                if (elm.textContent.toLowerCase().includes(LABEL_HINTS)) {
                    if (_hint != undefined && elm.textContent.length == _hint.length) {
                        let idxHintStart = _hint.indexOf(LABEL_HINTS) + (LABEL_HINTS + ": ").length
                        addHintText(_divCff, _hint.substring(idxHintStart))
                    }
                    _hint = elm.textContent
                }
            })
        }

        // indicator of streaming ended
        var elements = document.querySelectorAll('[class*="' + _config.KEYWORDSTREAMING + '"')
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
// add hint text over the response area that triggers users to think
//
const addHintText = (container, hint) => {
    const paragraph = document.createElement("p")
    paragraph.classList.add("hint")
    const k = Math.floor(Math.random() * 1009)
    paragraph.innerHTML = hint == undefined ? _config.HINTTEXTS[k % _config.HINTTEXTS.length] : hint
    paragraph.id = ID_HINT_TEXT
    container.prepend(paragraph)
}

//
// reveal ai response
//
const revealResponse = (e) => {
    clearCffContainer()
    fadeIn(_elmResponse)
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
// configure cff: start or stop the monitor for implementing cff on the response element
//
const configCff = () => {
    if (_cff != CFF_NONE) {
        // create an instance of MutationObserver
        _observerNewResponse = new MutationObserver(callbackNewResponse)
        const divChat = document.querySelector(_config.QUERYCHATDIV)
        _observerNewResponse.observe(divChat, { childList: true, subtree: true })

        // create a container for added cff elements
        _divCff = document.createElement("div")
        _divCff.classList.add("cff-container")

        // position the cff container at a fixed position
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
// initialization
//
const init = () => {
    // read stored settings
    chrome.storage.local.get(['cff'], (result) => {
        _cff = result.cff == undefined ? -1 : result.cff
        configCff()
    })
    chrome.storage.local.get(['_waitTime'], (result) => {
        _waitTime = result._waitTime == undefined ? 0 : result._waitTime
    })
    chrome.storage.local.get(['hints'], (result) => {
        _cffOptHints = result.hints == undefined ? false : result.hints
    })
    chrome.storage.local.get(['_promptAug'], (result) => {
        _promptAug = result._promptAug == undefined ? false : result._promptAug
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
                _waitTime = request._waitTime
            } else if (request.hints != undefined) {
                _cffOptHints = request.hints
            } else if (request._promptAug != undefined) {
                _promptAug = request._promptAug
            }

        }
    )

    // intercept the sending of prompts: enter key and send button
    _elmPrompt = document.getElementById(_config.IDPROMPTINPUT)
    _elmPrompt.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
            let promptExtra =  ""
            
            // todo: sort out the logic below
            if(_cff != CFF_NONE) {
                promptExtra += TEXT_PROMPT_TASK_TYPE_DETECTION

                if (_cffOptHints) {
                    promptExtra += TEXT_PROMPT_HINTS
                }
            }

            if (_promptAug) {
                promptExtra += TEXT_PROMPT_AUGMENTATION
            } else if(_cff != CFF_NONE) {
                promptExtra += TEXT_NO_PROMPT_AUGMENTATION
            }

            e.target.value += promptExtra

            setTimeout(() => {
                removeIntermediatePrompt(promptExtra)
            }, 1000);

            configCff()
        }
    }, true)

    // add prompt augmentation to the send button
    // because the send button is updated/renewed after typing in the prompt
    // an event handler needs to be added in real time
    // todo: make it consistent with the keydown handler
    _elmPrompt.addEventListener('keyup', (e) => {
        if (_elmSendBtn == undefined) {
            _elmSendBtn = document.querySelector(_config.QUERYSENDBTN)
            _elmSendBtn.addEventListener('mousedown', (e) => {
                if (_cffOptHints) {
                    _elmPrompt.value += TEXT_PROMPT_HINTS
                }

                if (_promptAug) {
                    _elmPrompt.value += TEXT_PROMPT_AUGMENTATION
                }
            }, true)
        }
    })

    setTimeout(() => {
        removeIntermediatePrompt(TEXT_PROMPT_TASK_TYPE_DETECTION)
        removeIntermediatePrompt(TEXT_PROMPT_HINTS)
        removeIntermediatePrompt(TEXT_NO_PROMPT_AUGMENTATION)
        // todo: remove prompt agumentation, if applicable
        removeIntermediateResponse()
    }, 2000);

}

//
//  entry function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL("data/config.json")

    // load _config file
    fetch(jsonFilePath)
        .then(response => response.json())
        .then(data => {
            _config = data
            init()
        })
        .catch(error => console.error('Error fetching JSON:', error))

})()
