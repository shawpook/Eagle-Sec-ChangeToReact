import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadServicePlugin } from '../backend/src/plugin-runtime.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, '../..', 'plugins/example-service-plugin');
const markerPath = path.join(os.tmpdir(), 'eagle-reverse-plugin-marker.txt');

fs.rmSync(markerPath, { force: true });
const plugin = loadServicePlugin(pluginRoot);
plugin.runLifecycle();

const marker = fs.readFileSync(markerPath, 'utf8');
if (!marker.includes('PLUGIN-CREATED') || !marker.includes('PLUGIN-RUN')) {
  throw new Error(`Plugin lifecycle marker missing events: ${marker}`);
}

console.log(`Plugin smoke passed: ${plugin.manifest.name} (${plugin.manifest.id})`);
