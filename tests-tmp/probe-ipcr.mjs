import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const script = `
const {app, BrowserWindow} = require('electron');
app.whenReady().then(async () => {
  const w = new BrowserWindow({show:false, webPreferences:{nodeIntegration:true, contextIsolation:false}});
  await w.loadURL('data:text/html,<html><body>hi</body></html>');
  const r = await w.webContents.executeJavaScript('JSON.stringify([typeof window.ipcRenderer, typeof window.require, typeof window.global])');
  console.log('IPCR_PROBE ' + r);
  app.quit();
});
`;
fs.writeFileSync('tests-tmp/probe-ipcr.cjs', script);
