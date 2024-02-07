console.log("background.js")
// Example: Sending a message to the active tab in the current window
// chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//     var activeTab = tabs[0];
//     chrome.tabs.sendMessage(activeTab.id, {"message": "hello"});
// });

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Check if the tab's status is 'complete' which means the page and its resources are fully loaded
    if (changeInfo.status === 'complete') {
        // Send a message to the content script of this tab
        // chrome.tabs.sendMessage(tabId, {greeting: "Hello, content script! The page is loaded."}, function(response) {
        //     console.log(response.reply);
        // });
        chrome.tabs.sendMessage(tabId, {"message": "waittime on"});
    }
});
