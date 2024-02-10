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

// design parameters for cff_ondemand
const IDBTNREVEAL = "btnReveal"
const TEXTBTNREVEAL = "Click to See AI Response"

// the type of cognitive forcing function
const cff = CFF_ONDEMAND

let config = {}
let tsAnsLastUpdated = -1
let elmResponse = undefined

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

                    if (cff == CFF_ONDEMAND) {
                        addRevealButton(elmResponse)
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
    // else {
    //     removeRevealButton()
    // }
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
//  add a button to the response area to reveal AI response
//
const addRevealButton = (elmResponse) => {
    const button = document.createElement("button")

    button.textContent = TEXTBTNREVEAL;
    button.id = IDBTNREVEAL
    button.className = "btn btn-reveal";

    // show the button at the bottom of the response area
    button.style.position = 'absolute'
    button.style.bottom = '0'
    // center the button
    button.style.left = '50%'
    button.style.transform = 'translateX(-50%)'

    elmResponse.parentElement.style.position = 'relative'

    // click to reveal AI response
    button.addEventListener("click", function () {
        fadeIn(elmResponse)
        removeRevealButton()
    });

    elmResponse.parentElement.appendChild(button);
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

const init = () => {
    // add observer to monitor streaming of ai response
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message === "cff on") {
                console.log("Message from background script:", request.message);
                // create an instance of MutationObserver
                const observerNewResponse = new MutationObserver(callbackNewResponse);
                // start observing the target node for configured mutations
                observerNewResponse.observe(document.body, { childList: true, subtree: true });
            } else if (request.message === "waittime off") {
                //  disconnect observer
            }
        }
    );

    let elmPrompt = document.getElementById(config.IDPROMPTINPUT)
    elmPrompt.addEventListener('keydown', (e) => {
        if (e.key === "Enter") {
            console.log(e.target.value)
        }
    })
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