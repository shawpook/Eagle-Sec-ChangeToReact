const status = document.querySelector('#status');
const setStatus = (text) => { status.textContent = text; };

async function send(type) {
  setStatus('Collecting...');
  const result = await chrome.runtime.sendMessage({ type });
  if (result && result.ok) setStatus('Sent to Eagle Reverse');
  else setStatus('Failed: ' + ((result && result.error) || 'unknown'));
}

document.querySelector('#collectPage').addEventListener('click', () => send('collect-page'));
document.querySelector('#collectImage').addEventListener('click', () => send('collect-image'));
document.querySelector('#openWorkbench').addEventListener('click', () => chrome.tabs.create({ url: 'http://localhost:5174/workbench.html' }));
