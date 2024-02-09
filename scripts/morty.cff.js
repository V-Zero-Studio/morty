//
//
//

const WAITTIME = 5000
const FADERATIO = 1.25
const FADEOPACITY = 0.05
const FADEINTERVAL = 100
const TIMEOUTSTREAMINGDONE = 5000

const IDBTNREVEAL = "btnReveal"

let config = {}

var tsAnsLastUpdated = -1
var elmResponse = undefined

// Callback function to execute when mutations are observed
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

                    addRevealButton(elmResponse)

                    return
                }
            })
        }

    }
}

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
    } else {
        removeRevealButton()
    }
}

const monitorStreamingEnd = () => {
    setTimeout(() => {
        var elements = document.querySelectorAll('[class*="' + config.KEYWORDSTREAMING + '"')
        if (elements.length > 0) {
            monitorStreamingEnd()
        } else {
            console.log("streaming ended")
            setTimeout(() => {
                fadeIn(elmResponse)
            }, WAITTIME);
        }
    }, 2000);

}

//
//  add a button to the response area to reveal AI response
//
const addRevealButton = (elmResponse) => {
    const button = document.createElement("button")

    button.textContent = "Click to see AI Response";
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
    if(button != null) {
        button.remove()
    }
}

(function () {
    const jsonFilePath = chrome.runtime.getURL("data/config.json");

    fetch(jsonFilePath)
        .then(response => response.json()) // Parse the JSON from the response
        .then(data => {
            console.log(data); // Here's your data
            config = data
        })
        .catch(error => console.error('Error fetching JSON:', error));

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message === "cff on") {
                console.log("Message from background script:", request.message);
                // Perform some action based on the message

                // Select the node that will be observed for mutations
                const targetNode = document.body; // You can change this to any other element

                // Options for the observer (which mutations to observe)
                const config = { childList: true, subtree: true };

                // Create an instance of MutationObserver
                const observerNewResponse = new MutationObserver(callbackNewResponse);

                // Start observing the target node for configured mutations
                observerNewResponse.observe(targetNode, config);
            } else if (request.message === "waittime off") {
                //  disconnect observer
            }
        }
    );

})();