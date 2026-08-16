console.log('[feedback-capture] background service worker loaded');

async function startCapture(tab) {
  console.log('[feedback-capture] action clicked', tab && tab.url);
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    console.log('[feedback-capture] skipped — not an http(s) tab');
    return;
  }

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['overlay.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['overlay.js'],
  });
  await chrome.tabs.sendMessage(tab.id, {
    type: 'FEEDBACK_START_OVERLAY',
    screenshotDataUrl,
    devicePixelRatio: undefined, // computed in-page, kept here for clarity
  });
}

chrome.action.onClicked.addListener(startCapture);
