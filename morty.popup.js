const sendSettingUpdate = (settings) => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, settings, function(response) {
          console.log(response);
        });
      });
      
}

(function () {
    const radiosCff = document.getElementsByName("cff")
    for (let radio of radiosCff) {
        radio.addEventListener("change", (e) => {
            console.log(e.target.value)
            sendSettingUpdate({cff: parseInt(e.target.value)})
        })
    }

    const checkboxHints = document.getElementsByName("hint")
    if(checkboxHints.length > 0) {
        checkboxHints[0].addEventListener("change", (e) => {
            sendSettingUpdate({hints: e.target.value})
        })
    }

})()