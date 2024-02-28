const sendSettingUpdate = (settings) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, settings, function (response) {
            console.log(response);
        });
    });

}

(function () {
    // cff setting
    chrome.storage.local.get(['cff'], (result) => {
        let cffValue = result.cff == undefined ? -1 : result.cff
        // console.log(result)
        const radiosCff = document.getElementsByName("cff")
        for (let radio of radiosCff) {
            // add event handler
            radio.addEventListener("change", (e) => {
                // console.log(e.target.value)
                let objCff = { cff: parseInt(e.target.value) }
                chrome.storage.local.set(objCff, () => {
                    console.log(objCff)
                })
                sendSettingUpdate(objCff)
            })

            // restore value
            if (radio.value == cffValue) {
                radio.checked = true
            }
        }
    })

    // hints setting
    chrome.storage.local.get(['hint'], (result) => {
        let hintValue = result.hint == undefined ? false : result.hint
        const checkboxHints = document.getElementsByName("hint")
        if (checkboxHints.length > 0) {
            checkboxHints[0].addEventListener("change", (e) => {
                let objHint = { hints: e.target.checked }
                chrome.storage.local.set(objHint, () => {
                    console.log(objHint)
                })
                sendSettingUpdate(objHint)
            })

            // restore value
            checkboxHints[0].checked = hintValue
        }
    })


})()