//
//
//

// cognitive forcing function variations
const CFF_WAIT = 0
const CFF_ONDEMAND = 1
const CFF_NONE = -1

// design parameters for cff_wait
const FADE_RATIO = 1.25
const FADE_OPACITY = 0.05
const FADE_INTERVAL = 100

// design parameters for cff_ondemand
const ID_BTN_REVEAL = "btnReveal"
const TEXT_BTN_REVEAL = "Click to See AI Response"
const HTML_REVEAL_INFO = "Click anywhere to reveal AI response."

// design parameters for showing hints
const ID_HINT_TEXT = "pHint"

// prompt-related parameters
const TEXT_PROMPT_TASK_TYPE_DETECTION = "\nBefore responding to the prompt, the first line of output should state whether the above prompt is an open-ended or closed-ended. Examples of open-ended tasks include writing, content creation, problem-solving, and idea generation."
const TEXT_PROMPT_HINTS = "\nIf it is an open-ended task, the next line should ask me a question to help me with the task in the format of 'Hint: ....?'."
const TEXT_PROMPT_AUGMENTATION = "\nIf it is an open-ended task, next, show me some hints that allow me to think about my request and then show the answer; if the above prompt is a closed-ended question, just show the answer."
const TEXT_NO_PROMPT_AUGMENTATION = "\nThe next line should start showing the answer."


// overreliance technique controls
let cff = CFF_NONE // which cognitive forcing function
let cffOptHints = false // whether to show hints when blocking the response
let promptAug = false   // whether to augment prompt to prevent overreliance
let waitTime = 0 // additional wait time after screening is finished
let _hint = undefined
let _promptExtra = ""

// others
const INTERVAL_MONITOR_STREAMING = 2000 // ms

let config = {}
let observerNewResponse = undefined
let elmResponse = undefined
let divCff = undefined
let elmPrompt = undefined
let elmSendBtn = undefined
//
// callback function to execute when mutations are observed
//
const callbackNewResponse = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(config.KEYWORDSTREAMING)) {
                    observerNewResponse.disconnect()

                    console.log("streaming starts")
                    monitorStreaming()

                    var elements = document.querySelectorAll(config.QUERYELMRESPONSE)
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })
                    elmResponse = elements[elements.length - 1]

                    doCff()
                    monitorTaskTypeInfo()

                    // reset the send button element b/c it will change in the next prompt
                    elmSendBtn = undefined

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
        clearCffContainer()
        removeIntermediateResponse()
    }
}

//
// monitor task type based on ai response
//
const monitorTaskTypeInfo = () => {
    setTimeout(() => {
        if (elmResponse.innerHTML.toLowerCase().includes("open-ended")) {
            // do nothing
        } else if (elmResponse.innerHTML.toLowerCase().includes("closed-ended")) {
            fadeIn(elmResponse)
        } else {
            monitorTaskTypeInfo()
        }
    }, INTERVAL_MONITOR_STREAMING)
}

//
// set up the cff elements
//
const doCff = () => {
    elmResponse.style.opacity = FADE_OPACITY.toString()
    clearCffContainer(false)
    elmResponse.parentElement.appendChild(divCff)

    if (cffOptHints) {
        _hint = undefined
    }

    if (cff == CFF_ONDEMAND) {
        const spanRevealInfo = document.createElement('span')
        spanRevealInfo.innerHTML = HTML_REVEAL_INFO
        divCff.appendChild(spanRevealInfo)
        elmResponse.parentElement.addEventListener("click", revealResponse)
    }
}

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreaming = () => {
    setTimeout(() => {
        // detecting AI-generated hints
        if (cffOptHints && document.getElementById(ID_HINT_TEXT) == undefined) {
            let pElms = elmResponse.querySelectorAll('p')
            pElms.forEach((elm) => {
                if (elm.textContent.includes("Hint:")) {
                    if (_hint != undefined && elm.textContent.length == _hint.length) {
                        addHintText(divCff, _hint)
                    }
                    _hint = elm.textContent
                }
            })
        }

        // indicator of streaming ended
        var elements = document.querySelectorAll('[class*="' + config.KEYWORDSTREAMING + '"')
        if (elements.length > 0) {
            monitorStreaming()
        } else {
            console.log("streaming ended")
            if (cff == CFF_WAIT) {
                setTimeout(() => {
                    fadeIn(elmResponse)
                }, waitTime)
            }
        }
    }, INTERVAL_MONITOR_STREAMING)

}

//
// remove children in the container and remove the container
//
const clearCffContainer = (fadeOut = true) => {
    divCff.innerHTML = ""
    if (fadeOut) {
        fadeOutAndRemove(divCff)
    } else {
        divCff.remove()
    }
    elmResponse.parentElement.removeEventListener("click", revealResponse)
}

//
//
//
const removeIntermediateResponse = () => {
    let pElms = elmResponse.querySelectorAll('p')
    pElms.forEach((elm) => {
        let text = elm.textContent.toLowerCase()
        if (text.includes("open-ended") || text.includes("closed-ended") || text.includes("Hint:")) {
            elm.remove()
        }
    })
}

//
//  add a button to the response area to reveal AI response
//
const addRevealButton = (container) => {
    const button = document.createElement("button")

    button.textContent = TEXT_BTN_REVEAL
    button.id = ID_BTN_REVEAL
    button.className = "btn-reveal"

    // click to reveal AI response
    button.addEventListener("click", function (e) {
        fadeIn(elmResponse)
        // clearCffContainer()
    })

    container.appendChild(button)
}

//
// add hint text over the response area that triggers users to think
//
const addHintText = (container, hint) => {
    const paragraph = document.createElement("p")
    const k = Math.floor(Math.random() * 1009)
    paragraph.innerHTML = hint == undefined ? config.HINTTEXTS[k % config.HINTTEXTS.length] : hint
    paragraph.id = ID_HINT_TEXT
    container.prepend(paragraph)
}

//
// reveal ai response
//
const revealResponse = (e) => {
    fadeIn(elmResponse)
    clearCffContainer()
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
    if (cff != CFF_NONE) {
        // create an instance of MutationObserver
        observerNewResponse = new MutationObserver(callbackNewResponse)
        const divChat = document.querySelector(config.QUERYCHATDIV)
        observerNewResponse.observe(divChat, { childList: true, subtree: true })

        // create a container for added cff elements
        divCff = document.createElement("div")
        divCff.classList.add("cff-container")

    } else if (cff === CFF_NONE) {
        if (observerNewResponse != undefined) {
            observerNewResponse.disconnect()
        }
    }
}

//
// initialization
//
const init = () => {
    // read stored settings
    chrome.storage.local.get(['cff'], (result) => {
        cff = result.cff == undefined ? -1 : result.cff
        configCff()
    })
    chrome.storage.local.get(['waitTime'], (result) => {
        waitTime = result.waitTime == undefined ? 0 : result.waitTime
    })
    chrome.storage.local.get(['hints'], (result) => {
        cffOptHints = result.hints == undefined ? false : result.hints
    })
    chrome.storage.local.get(['promptAug'], (result) => {
        promptAug = result.promptAug == undefined ? false : result.promptAug
    })

    console.log("morty ready")

    // receive setting updates from popup
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            console.log("updates from popup:", request)
            if (request.cff != undefined && cff != request.cff) {
                cff = request.cff
                configCff()
            } else if (request.waitTime != undefined) {
                waitTime = request.waitTime
            } else if (request.hints != undefined) {
                cffOptHints = request.hints
            } else if (request.promptAug != undefined) {
                promptAug = request.promptAug
            }

        }
    )

    // intercept the sending of prompts: enter key and send button
    elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    elmPrompt.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.ctrlKey) {
            _promptExtra = ""
            _promptExtra += TEXT_PROMPT_TASK_TYPE_DETECTION

            configCff()

            if (cffOptHints) {
                _promptExtra += TEXT_PROMPT_HINTS
            }

            if (promptAug) {
                _promptExtra += TEXT_PROMPT_AUGMENTATION
            } else {
                _promptExtra += TEXT_NO_PROMPT_AUGMENTATION
            }

            e.target.value += _promptExtra
        }
    }, true)

    // add prompt augmentation to the send button
    // because the send button is updated/renewed after typing in the prompt
    // an event handler needs to be added in real time
    // TODO: make it consistent with the keydown handler
    elmPrompt.addEventListener('keyup', (e) => {
        if (elmSendBtn == undefined) {
            elmSendBtn = document.querySelector(config.QUERYSENDBTN)
            elmSendBtn.addEventListener('mousedown', (e) => {
                if (cffOptHints) {
                    elmPrompt.value += TEXT_PROMPT_HINTS
                }

                if (promptAug) {
                    elmPrompt.value += TEXT_PROMPT_AUGMENTATION
                }
            }, true)
        }

        if(_promptExtra != undefined) {
             // Select all div elements
             const allDivs = document.querySelectorAll('div');

             // Filter divs that contain only text
             const textOnlyDivs = Array.from(allDivs).filter(div => {
                 // Check if every childNode is a text node (nodeType === 3)
                 return Array.from(div.childNodes).every(node => node.nodeType === 3);
             });

             textOnlyDivs.forEach((elm) => {
                 if (elm.innerHTML.includes(_promptExtra)) {
                     elm.innerHTML = elm.innerHTML.replace(_promptExtra, "")
                     return
                 }
             })

             _promptExtra = undefined
        }
    })

}

//
//  entry function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL("data/config.json")

    // load config file
    fetch(jsonFilePath)
        .then(response => response.json())
        .then(data => {
            config = data
            init()
        })
        .catch(error => console.error('Error fetching JSON:', error))

})()
