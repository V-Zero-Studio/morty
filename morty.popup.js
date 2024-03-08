//
// morty.popup.js
//

//
// send setting updates to the content script
//
const sendSettingUpdate = (settings) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, settings, function (response) {
            console.log(response);
        });
    });
}

//
// entry function
//
(function () {
    // cff setting
    chrome.storage.local.get(['cff'], (result) => {
        let cffValue = result.cff == undefined ? -1 : result.cff
        const radiosCff = document.getElementsByName("cff")
        for (let radio of radiosCff) {
            // add event handler
            radio.addEventListener("change", (e) => {
                let objCff = { cff: parseInt(e.target.value) }
                chrome.storage.local.set(objCff)
                sendSettingUpdate(objCff)
            })

            // restore value
            if (radio.value == cffValue) {
                radio.checked = true
            }
        }
    })

    // more wait time setting
    chrome.storage.local.get(['waitTime'], (result) => {
        let waitTimeValue = result.waitTime == undefined ? 0 : result.waitTime
        const inputMoreWait = document.getElementById("waitTime")
        if (inputMoreWait != null) {
            // add event handler
            inputMoreWait.addEventListener("change", (e) => {
                let objWaitTime = { waitTime: parseInt(e.target.value) * 1000 }
                chrome.storage.local.set(objWaitTime)
                sendSettingUpdate(objWaitTime)
            })

            // restore value
            inputMoreWait.value = waitTimeValue
        }
    })

    // hints setting
    chrome.storage.local.get(['hints'], (result) => {
        let hintValue = result.hints == undefined ? false : result.hints
        const checkboxHints = document.getElementById("hints")
        if (checkboxHints != null) {
            // add event handler
            checkboxHints.addEventListener("change", (e) => {
                let objHint = { hints: e.target.checked }
                chrome.storage.local.set(objHint)
                sendSettingUpdate(objHint)
            })

            // restore value
            checkboxHints.checked = hintValue
        }
    })

    // prompt augmentation setting
    chrome.storage.local.get(['promptAug'], (result) => {
        let promptAugValue = result.promptAug == undefined ? false : result.promptAug
        const checkboxPromptAug = document.getElementById("prompt-augmentation")
        if (checkboxPromptAug != null) {
            // add event handler
            checkboxPromptAug.addEventListener("change", (e) => {
                let objPromptAug = { promptAug: e.target.checked }
                chrome.storage.local.set(objPromptAug)
                sendSettingUpdate(objPromptAug)
            })

            // restore value
            checkboxPromptAug.checked = promptAugValue
        }
    })
})()