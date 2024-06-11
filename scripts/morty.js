//
//
//

const PATH_CONFIG_FILE = "data/config.json"

// cognitive forcing function variations
const CFF_ONDEMAND = 1
const CFF_NONE = -1

// design parameters for cff
const HEIGHT_CFF_CONTAINER = 100
const HEIGHT_POST_RESPONSE = 300

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
    "Very confident",
    "Extremely confident"
]

// 
const AGREEMENT_QUESTION_PROMPT = "Do you agree with ChatGPT?"
const AGREEMENT_LEVELS = [
    "Totally disagree",
    "Somewhat disagree",
    "Doubt it",
    "Somewhat agree",
    "Totally agree"
]

// default values
const CFF_DEFAULT = 1

const TIMEOUT_PLACEHOLDER_RESET = 30000

const TEXT_POST_RESPONSE = "Tell ChatGPT which part(s) of its response you most disagree with"

let _on = true

// others
const INTERVAL_MONITOR_STREAMING = 2000 // ms
let _config = {}
let _observerNewResponse = undefined
let _elmResponse = undefined
let _divCff = undefined
let _elmPrompt = undefined
let _elmSendBtn = undefined
let _placeholderPrompt = undefined
let _confidence = undefined
let _divAgreementRating = undefined

//
// callback function to execute when mutations are observed
//
const callbackNewResponse = (mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && typeof node.className.includes == "function" && node.className.includes(_config.KEYWORD_STREAMING)) {
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
                    }

                    // reset the send button element b/c it will change in the next prompt
                    _elmSendBtn = undefined

                    // remove the diagreement rating ui
                    // _divAgreementRating.remove()

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
            console.log("streaming ends")

            if (_on) {
                // if the cff container has not been clear, don't set up post response yet;
                // instead, set it up when a user clicks to reveal response
                if (document.getElementsByClassName("cff-container").length <= 0) {
                    _setupPostResponseElements()
                } else {
                    _elmResponse.parentElement.addEventListener("click", _setupPostResponseElements)
                }
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

    const spanRevealInfo = document.createElement('span')
    spanRevealInfo.classList.add("reveal")
    spanRevealInfo.innerHTML = HTML_REVEAL_INFO
    _divCff.appendChild(spanRevealInfo)
    spanRevealInfo.addEventListener("click", revealResponse)
}

//
// set up confidence rating elements
//
const setupConfElements = (container) => {
    _confidence = undefined
    const divRating = _setupRatingUI("labelConfidence", CONFI_QUESTION_PROMPT, CONFIDENCE_LEVELS)
    container.prepend(divRating)
}

//
//
// 
// todo: move the style to .css
const _setupRatingUI = (id, question, labelsRating, row = false, onRated = undefined) => {
    const divRating = document.createElement("div")

    if (row) {
        divRating.style.display = "flex"
        divRating.style.flexDirection = "row"
    }

    // the question
    const pRatingQuestion = document.createElement("p")
    pRatingQuestion.innerHTML = question
    pRatingQuestion.style.marginRight = "5px"
    divRating.appendChild(pRatingQuestion)

    // the rating options
    const divDots = document.createElement("div")

    divDots.style.display = "flex"
    divDots.style.flexDirection = "row"

    for (let i = 0; i < labelsRating.length; i++) {
        const spanDot = document.createElement("span")
        spanDot.classList.add("dot")
        spanDot.setAttribute("name", id + "-dot")
        spanDot.addEventListener("mouseover", (e) => {
            document.getElementById(id + "-span").innerHTML = labelsRating[i]

            var dots = document.getElementsByName(id + "-dot")
            for (var j = 0; j < dots.length; j++) {
                if (j <= i) {
                    dots[j].classList.add("selected")
                } else {
                    dots[j].classList.remove("selected")
                }
            }
        })
        spanDot.addEventListener("click", (e) => {
            revealResponse()
            if (onRated) {
                onRated(i)
            }
        })
        divDots.appendChild(spanDot)
    }

    const spanConf = document.createElement("span")
    spanConf.setAttribute("id", id + "-span")
    spanConf.style.marginLeft = "5px"
    divDots.appendChild(spanConf)

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
//
//
const _prefixPrompt = (e) => {
    e.target.value = e.target.getAttribute("placeholder") + " "
    const textLength = e.target.value.length
    e.target.setSelectionRange(textLength, textLength)
    e.target.setAttribute("placeholder", _placeholderPrompt)
}

//
//
//
const _setupPostResponseElements = () => {
    // let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)

    // elmPromptBox.addEventListener("click", () => {
        // elmPromptBox.setAttribute("placeholder", _placeholderPrompt)
    // })

    // EXPERIMENTAL AREA
    const toolbar = document.querySelectorAll(_config.QUERY_TOOLBAR)[0]


    document.getElementsByName("labelAgreement" + "-dot").forEach(elm => elm.classList.remove('selected'));
    const label = document.getElementById("labelAgreement" + "-span")
    if (label != null) {
        label.innerHTML = ""
    }

    toolbar.appendChild(_divAgreementRating)

    // in case this is triggered by clicking the reveal response option
    // enable such handler only once
    _elmResponse.parentElement.removeEventListener("click", _setupPostResponseElements)
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


// attach event listenrs to prompt textbox to append cff inducing prompts
const attachEventListeners = () => {
    // intercept the sending of prompts: enter key and send button
    _elmPrompt = document.getElementById(_config.ID_PROMPT_INPUT)

    _elmPrompt.addEventListener('keydown', (e) => {
        if (_on && e.key === "Enter" && !e.shiftKey) {
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
    configCff()

    console.log("morty ready")

    attachEventListeners()

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

    // set up the disagreement rating ui
    _divAgreementRating = _setupRatingUI("labelAgreement", AGREEMENT_QUESTION_PROMPT, AGREEMENT_LEVELS, true, (idxRating) => {
        let elmPromptBox = document.getElementById(_config.ID_TEXTBOX_PROMPT)
        const ratingNormalized = idxRating * 1.0 / AGREEMENT_LEVELS.length
        const placeholder = "I " + AGREEMENT_LEVELS[idxRating].toLowerCase() + " because"
        if (ratingNormalized < 0.5) {
            elmPromptBox.setAttribute("placeholder", placeholder)
            elmPromptBox.addEventListener("click", _prefixPrompt)
            setTimeout(() => {
                elmPromptBox.removeEventListener("click", _prefixPrompt)
            }, TIMEOUT_PLACEHOLDER_RESET);
        } else {
            elmPromptBox.setAttribute("placeholder", _placeholderPrompt)
        }
    })
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
        })
        .catch(error => console.error('Error fetching JSON:', error))
})()