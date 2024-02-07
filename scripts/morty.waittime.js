//
//
//

const WAITTIME = 5000
const FADERATIO = 1.1
const FADEOPACITY = 0.05
const FADEINTERVAL = 100 // Math.round(FADETIMEOUT / (Math.log(1 / FADEOPACITY) / Math.log(FADERATIO)))


const KEYWORDSTREAMING = "result-streaming"
const KEYWORDANSWER = "markdown" // prose w-full break-words dark:prose-invert light"

const TIMEOUTSTREAMINGDONE = 5000

var tsAnsLastUpdated = -1
var elmAnswer = undefined

// // Callback function to execute when mutations are observed
const callbackNewAnswer = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.className != undefined && node.className.includes(KEYWORDSTREAMING)) {
                    console.log("streaming starts")
                    monitorStreamingEnd()

                    var elements = document.querySelectorAll('[data-message-author-role="assistant"]')
                    elmAnswer = elements[elements.length - 1]
                    elmAnswer.style.opacity = FADEOPACITY.toString()

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
    }
    setTimeout(() => {
        fadeIn(elm)
    }, FADEINTERVAL);
}

const monitorStreamingEnd = () => {
    setTimeout(() => {
        var elements = document.querySelectorAll('[class*="' + KEYWORDSTREAMING + '"')
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

(function () {
    console.log("wait time")
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.message === "waittime on") {
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