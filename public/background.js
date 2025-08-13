chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[background.js] Received message:', msg, 'from:', sender);
  
  // Forward messages from content scripts to popup
  if (msg.type === 'selector-captured') {
    console.log('[background.js] Forwarding selector-captured to popup:', msg);
    // Send to popup
    chrome.runtime.sendMessage(msg).catch(err => {
      console.log('[background.js] Error sending to popup:', err);
    });
  }
  
  // Handle legacy message type
  if (msg.type === 'SELECTOR_PICKED') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, msg);
    });
  }
});
  