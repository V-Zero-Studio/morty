//
//
//

// cognitive forcing function variations
const CFF_WAIT = 0
const CFF_ONDEMAND = 1

// design parameters for cff_wait
const WAITTIME = 5000
const FADERATIO = 1.25
const FADEOPACITY = 0.05
const FADEINTERVAL = 100
const TIMEOUTSTREAMINGDONE = 5000

//
// const CLASSRESPONSEPARENT = "parentResponse"

// design parameters for cff_ondemand
const IDBTNREVEAL = "btnReveal"
const TEXTBTNREVEAL = "Click to See AI Response"

// design parameters for showing hints
const IDHINTTEXT = "pHint"

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
                    elmResponse = elements[elements.length - 1]
                    elmResponse.style.opacity = FADEOPACITY.toString()

                    elmResponse.parentElement.appendChild(divCff);

                    addHintText(divCff)

                    if (cff == CFF_ONDEMAND) {
                        addRevealButton(divCff)
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
        elm.style.opacity = (opacity * FADERATIO).toString()
        setTimeout(() => {
            fadeIn(elm)
        }, FADEINTERVAL);
    }
    else {
        removeHintText()
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
                }, WAITTIME);
            }
        }
    }, 2000);

}

//
//
//
const createCffContainer = () => {
    divCff = document.createElement("div")
    divCff.classList.add("cff-container")
}

//
//  add a button to the response area to reveal AI response
//
const addRevealButton = (container) => {
    const button = document.createElement("button")

    button.textContent = TEXTBTNREVEAL;
    button.id = IDBTNREVEAL
    button.className = "btn btn-reveal";

    // click to reveal AI response
    button.addEventListener("click", function () {
        fadeIn(elmResponse)
        removeRevealButton()
        removeHintText()
    });

    container.appendChild(button);
}

//
//  remove the button that reveals AI response
//
const removeRevealButton = () => {
    const button = document.getElementById(IDBTNREVEAL)
    if (button != null) {
        button.remove()
    }
}

//
//
//
const addHintText = (container) => {
    const paragraph = document.createElement("p")
    const k = Math.floor(Math.random() * 1009)
    paragraph.innerHTML = config.HINTTEXTS[k % config.HINTTEXTS.length]
    paragraph.id = IDHINTTEXT
    container.appendChild(paragraph)
}

//
//
//
const removeHintText = () => {
    const paragraph = document.getElementById(IDHINTTEXT)
    if (paragraph != null) {
        paragraph.remove()
    }
}

const init = () => {
    // add observer to monitor streaming of ai response
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            console.log("Message from background script:", request.message);
            if (request.message === "cff on") {
                // create an instance of MutationObserver
                const observerNewResponse = new MutationObserver(callbackNewResponse);
                // start observing the target node for configured mutations
                observerNewResponse.observe(document.body, { childList: true, subtree: true });
                
                // create a container for added cff elements
                createCffContainer()

            } else if (request.message === "waittime off") {
                //  TODO: disconnect observer
            }
        }
    );

    // intercept the sending of prompts: enter key and send button
    // let elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    // elmPrompt.addEventListener('keydown', (e) => {
    //     if (e.key === "Enter") {
    //         console.log("enter", e.target.value)
    //     }
    // })

    // let elmSendBtn = document.querySelector(config.QUERYSENDBTN)
    // elmSendBtn.addEventListener('click', (e) => {
    //     let elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    //     console.log("button", elmPrompt.value)
    // })
}

//
//  "init" function
//
(function () {
    const jsonFilePath = chrome.runtime.getURL("data/config.json");

    // load config file
    fetch(jsonFilePath)
        .then(response => response.json()) // Parse the JSON from the response
        .then(data => {
            console.log(data); // Here's your data
            config = data
            init()
        })
        .catch(error => console.error('Error fetching JSON:', error));

})();