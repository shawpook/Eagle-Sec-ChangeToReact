chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'collect-page') {
    const images = Array.from(document.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => src && !src.startsWith('data:'));
    sendResponse({
      title: document.title,
      url: location.href,
      images: images.slice(0, 50),
    });
    return false;
  }
  if (message.type === 'collect-image') {
    const selected = window.getSelection ? window.getSelection().toString() : '';
    sendResponse({
      title: document.title,
      url: location.href,
      src: selected || (document.querySelector('img') || {}).src || '',
      images: [],
    });
    return false;
  }
  return false;
});
