document.documentElement.setAttribute('data-eagle-reverse-content', '1');

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
    const images = Array.from(document.querySelectorAll('img')).map((img) => img.currentSrc || img.src).filter((src) => src && src.startsWith('http'));
    sendResponse({
      title: document.title,
      url: location.href,
      src: images[0] || '',
      images: [],
    });
    return false;
  }
  return false;
});

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.channel !== 'eagle-reverse-collect') return;
  document.documentElement.setAttribute('data-eagle-reverse-message-received', '1');
  const request = data.request || {};
  const images = Array.from(document.querySelectorAll('img'))
    .map((img) => img.currentSrc || img.src)
    .filter((src) => src && !src.startsWith('data:'));
  const payload = {
    type: request.type === 'collect-page' ? 'collect-page' : 'collect-image',
    title: document.title,
    url: location.href,
    src: images[0] || request.src || '',
    images,
  };
  chrome.runtime.sendMessage(payload, (response) => {
    document.documentElement.setAttribute('data-eagle-reverse-send-response', '1');
    window.postMessage({ channel: 'eagle-reverse-collect-response', response }, '*');
  });
});
