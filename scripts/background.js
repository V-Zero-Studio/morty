chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, message.content, (response) => {
            console.log('Response from content script:', response);
            sendResponse(response);
          });
        }
      });
  
      // Indicate that the response is asynchronous
      return true;
  });
  