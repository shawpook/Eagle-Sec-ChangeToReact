const fs = require('fs');
const path = require('path');
const os = require('os');

function writeMarker(name, extra) {
  try {
    fs.appendFileSync(
      path.join(os.tmpdir(), 'eagle-reverse-plugin-marker.txt'),
      `${name} ${extra || ''}\n`,
    );
  } catch (err) {
    console.error(err);
  }
}

eagle.onPluginCreate((plugin) => {
  writeMarker('PLUGIN-CREATED', plugin.manifest && plugin.manifest.id);
});

eagle.onPluginRun(() => {
  writeMarker('PLUGIN-RUN');
});
