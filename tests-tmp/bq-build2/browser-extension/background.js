const API = 'http://localhost:41593';

function postCapture(body) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body || {})) {
    if (Array.isArray(value)) form.set(key, JSON.stringify(value));
    else if (value !== undefined && value !== null) form.set(key, String(value));
  }
  return fetch(`${API}/api/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }).then((response) => response.json());
}

async function collectPage(payload) {
  return postCapture({
    type: 'import-images',
    title: payload.title || '',
    url: payload.url || '',
    website: payload.url || '',
    images: Array.isArray(payload.images) ? payload.images.map((src) => ({ src, title: payload.title || '' })) : [],
  });
}

async function collectImage(payload) {
  return postCapture({
    type: 'image',
    title: payload.title || '',
    src: payload.src || '',
    url: payload.url || '',
    website: payload.url || '',
  });
}

async function collectScreenshot(payload) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || tab.id === undefined) throw new Error('No active tab found');
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  return postCapture({
    type: 'screencapture',
    title: payload.title || tab.title || 'Page Screenshot',
    src: dataUrl,
    url: tab.url || payload.url || '',
    website: tab.url || payload.url || '',
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve()
    .then(() => {
      if (message.type === 'collect-page') return collectPage(message);
      if (message.type === 'collect-image') return collectImage(message);
      if (message.type === 'collect-screenshot') return collectScreenshot(message);
      throw new Error('Unknown collect type');
    })
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ eagleReverseExtensionReady: true });
});
