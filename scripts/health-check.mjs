const checks = [
  ['Vite pages', 'http://127.0.0.1:5176/pages.html'],
  ['Workbench', 'http://127.0.0.1:5176/workbench.html'],
  ['API library', 'http://127.0.0.1:41595/api/library/info'],
  ['Thumbnail service', 'http://127.0.0.1:41592/?filePath=%2Fmock-library%2FEagle%20Reverse%20Demo.library%2Fimages%2FMOCK0001.info%2FWelcome%20Library_thumbnail.png'],
  ['Extension service', 'http://127.0.0.1:41593/api/extension/status'],
];

const results = [];
for (const [name, url] of checks) {
  try {
    const res = await fetch(url);
    results.push({ name, ok: res.ok, status: res.status });
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
  }
}

for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.status ? ` ${entry.status}` : ` :: ${entry.error}`}`);
}
if (results.some((entry) => !entry.ok)) process.exit(1);
console.log(`Health check passed: ${results.length}/${results.length}`);
