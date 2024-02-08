// console.log("background.js")

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Check if the tab's status is 'complete' which means the page and its resources are fully loaded
    if (changeInfo.status === 'complete') {
        // Send a message to the content script of this tab
        chrome.tabs.sendMessage(tabId, {"message": "cff on"});
    }
});
