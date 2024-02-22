//
//
//

// cognitive forcing function variations
const CFF_WAIT = 0
const CFF_ONDEMAND = 1
const CFF_OPTION_HINT = true

// design parameters for cff_wait
const WAIT_TIME = 5000
const FADE_RATIO = 1.25
const FADE_OPACITY = 0.05
const FADE_INTERVAL = 100

// design parameters for cff_ondemand
const ID_BTN_REVEAL = "btnReveal"
const TEXT_BTN_REVEAL = "Click to See AI Response"
const HTML_REVEAL_INFO = "Click anywhere to reveal AI response."

// design parameters for showing hints
const ID_HINT_TEXT = "pHint"

// the type of cognitive forcing function
const cff = CFF_ONDEMAND

let config = {}
let tsAnsLastUpdated = -1
let elmResponse = undefined
let divCff = undefined

//
// callback function to execute when mutations are observed
//
const callbackNewResponse = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(config.KEYWORDSTREAMING)) {
                    console.log("streaming starts")
                    monitorStreamingEnd()

                    var elements = document.querySelectorAll('[data-message-author-role="assistant"]')
                    elements.forEach((value, index, array) => {
                        array[index].style.opacity = 1
                    })
                    elmResponse = elements[elements.length - 1]
                    elmResponse.style.opacity = FADE_OPACITY.toString()

                    clearCffContainer(false)
                    elmResponse.parentElement.appendChild(divCff)

                    if (CFF_OPTION_HINT) {
                        addHintText(divCff)
                    }

                    if (cff == CFF_ONDEMAND) {
                        // addRevealButton(divCff)
                        const spanRevealInfo = document.createElement('span')
                        spanRevealInfo.innerHTML = HTML_REVEAL_INFO
                        divCff.appendChild(spanRevealInfo)
                        elmResponse.parentElement.addEventListener("click", revealResponse)
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
    else {
        clearCffContainer()
    }
}

//
//  a recurring function to monitor if streaming ends,
//  in which case certain element marked as streaming can no longer be found
//
const monitorStreamingEnd = () => {
    setTimeout(() => {
        var elements = document.querySelectorAll('[class*="' + config.KEYWORDSTREAMING + '"')
        if (elements.length > 0) {
            monitorStreamingEnd()
        } else {
            console.log("streaming ended")
            if (cff == CFF_WAIT) {
                setTimeout(() => {
                    fadeIn(elmResponse)
                }, WAIT_TIME)
            }
        }
    }, 2000)

}

//
// remove children in the container and remove the container
//
const clearCffContainer = (fadeOut = true) => {
    divCff.innerHTML = ""
    if(fadeOut) {
        fadeOutAndRemove(divCff)
    } else {
        divCff.remove()
    }
    elmResponse.parentElement.removeEventListener("click", revealResponse)
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
        clearCffContainer()
    })

    container.appendChild(button)
}

//
// add hint text over the response area that triggers users to think
//
const addHintText = (container) => {
    const paragraph = document.createElement("p")
    const k = Math.floor(Math.random() * 1009)
    paragraph.innerHTML = config.HINTTEXTS[k % config.HINTTEXTS.length]
    paragraph.id = ID_HINT_TEXT
    container.appendChild(paragraph)
}

//
//
//
const revealResponse = (e) => {
    fadeIn(elmResponse)
    clearCffContainer()
}

//
//
//
const fadeOutAndRemove = (element) => {
    // Apply the fade-out class
    element.classList.add('fade-out');
  
    // Listen for the end of the animation
    element.addEventListener('animationend', function() {
      // Remove the element from the DOM
      element.remove();
    });
  }

//
// initialization
//
const init = () => {
    // add observer to monitor streaming of ai response
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            console.log("Message from background script:", request.message)
            if (request.message === "cff on") {
                // create an instance of MutationObserver
                const observerNewResponse = new MutationObserver(callbackNewResponse)
                const divChat = document.querySelector(config.QUERYCHATDIV)
                observerNewResponse.observe(divChat, { childList: true, subtree: true })

                // create a container for added cff elements
                divCff = document.createElement("div")
                divCff.classList.add("cff-container")

            } else if (request.message === "WAIT_TIME off") {
                //  TODO: disconnect observer
            }
        }
    )

    // TODO: clean up the following
    // intercept the sending of prompts: enter key and send button
    let elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    elmPrompt.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.ctrlKey) {
            e.target.value += "Instead of showing me the response, show me some hints to help me think about my prompt."
        }
    }, true)

    // let elmSendBtn = document.querySelector(config.QUERYSENDBTN)
    // elmSendBtn.addEventListener('mousedown', (e) => {
    // let elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    // console.log("button", elmPrompt.value)
    // clearCffContainer()
    // })
}

//
//  entry function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL("data/config.json")

    // load config file
    fetch(jsonFilePath)
        .then(response => response.json()) // Parse the JSON from the response
        .then(data => {
            config = data
            init()
        })
        .catch(error => console.error('Error fetching JSON:', error))

})()