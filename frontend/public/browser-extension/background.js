const API = 'http://localhost:41593';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'collect-page' || message.type === 'collect-image') {
    const body = new URLSearchParams({
      type: message.type === 'collect-image' ? 'image' : 'save-url',
      title: message.title || '',
      url: message.url || '',
      src: message.src || '',
      images: JSON.stringify(message.images || []),
    });
    fetch(`${API}/api/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ eagleReverseExtensionReady: true });
});
