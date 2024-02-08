//
//
//

const WAITTIME = 5000
const FADERATIO = 1.1
const FADEOPACITY = 0.05
const FADEINTERVAL = 200
const TIMEOUTSTREAMINGDONE = 5000

const IDBTNREVEAL = "btnReveal"

let config = {}

var tsAnsLastUpdated = -1
var elmAnswer = undefined

// Callback function to execute when mutations are observed
const callbackNewAnswer = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(config.KEYWORDSTREAMING)) {
                    console.log("streaming starts")
                    monitorStreamingEnd()

                    var elements = document.querySelectorAll('[data-message-author-role="assistant"]')
                    elmAnswer = elements[elements.length - 1]
                    elmAnswer.style.opacity = FADEOPACITY.toString()

                    addRevealButton(elmAnswer)

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
                fadeIn(elmAnswer)
            }, WAITTIME);
        }
    }, 2000);

}

const addRevealButton = (elmAnswer) => {
    const button = document.createElement("button")

    button.textContent = "Show AI Response";
    button.id = IDBTNREVEAL
    button.className = "btn-reveal";

    button.style.position = 'absolute'
    button.style.bottom = '0'
    // button.style.display = 'block'
    // button.style.marginLeft = 'auto'
    // button.style.marginRight = 'auto'
    // button.style.width = '25%'
    
    elmAnswer.parentElement.style.position = 'relative'
    // elmAnswer.parentElement.style.textAlign = 'center'

    button.addEventListener("click", function () {
        alert("Button was clicked!");
    });

    elmAnswer.parentElement.appendChild(button);
}

const removeRevealButton = () => {
    const button = document.getElementById(IDBTNREVEAL)
    button.remove()
}

(function () {
    // console.log("wait time")

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
                const observerNewAnswer = new MutationObserver(callbackNewAnswer);

                // Start observing the target node for configured mutations
                observerNewAnswer.observe(targetNode, config);
            } else if (request.message === "waittime off") {
                //  disconnect observer
            }
        }
    );

})();