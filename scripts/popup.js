window.onload = function () {
  log("Popup loaded");
  // Perform initialization tasks here
};

const log = (msg) => {
  chrome.runtime.sendMessage({ content: msg }, (response) => {
    console.log("Response from background or content script:", response);
  });
};
