import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import JSZip from 'jszip';
import { extractOfficeDocument } from '../backend/src/office-document-support.js';
import { renderOfficeThumbnail } from '../backend/src/office-thumbnail-renderer.js';
import { ThumbnailTaskService } from '../backend/src/thumbnail-task-service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-office-thumbnail-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

async function makeDocx(filePath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', [
    '<w:document xmlns:w="urn:word"><w:body>',
    '<w:p><w:r><w:t>Office Word Title</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Word body line</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join(''));
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function makeXlsx(filePath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Sheet A"/></sheets></workbook>');
  zip.file('xl/sharedStrings.xml', '<sst><si><t>Alpha</t></si><si><t>Beta</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12</v></c></row></sheetData></worksheet>');
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function makePptx(filePath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('ppt/slides/slide1.xml', [
    '<p:sld xmlns:a="urn:a"><p:cSld><p:spTree><p:sp><p:txBody>',
    '<a:p><a:r><a:t>Office Slide Title</a:t></a:r></a:p>',
    '<a:p><a:r><a:t>Slide point</a:t></a:r></a:p>',
    '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
  ].join(''));
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function freePort() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address && typeof address === 'object' ? address.port : null));
      });
    });
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  }
  throw new Error('could not allocate a free TCP port');
}

async function startServer() {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: stateFile,
      EAGLE_THUMBNAIL_CONCURRENCY: '3',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 15_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { child, base: `http://127.0.0.1:${apiPort}` };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function post(base, route, body) {
  return request(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForTask(base, taskId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

const docx = path.join(sourcesRoot, 'sample.docx');
const xlsx = path.join(sourcesRoot, 'sheet.xlsx');
const pptx = path.join(sourcesRoot, 'deck.pptx');
const broken = path.join(sourcesRoot, 'broken.docx');
const tooMany = path.join(sourcesRoot, 'too-many.docx');
await makeDocx(docx);
await makeXlsx(xlsx);
await makePptx(pptx);
fs.writeFileSync(broken, 'not a zip archive', 'utf8');
const manyZip = new JSZip();
for (let index = 0; index < 5000; index += 1) manyZip.file(`entry-${index}.txt`, 'x');
fs.writeFileSync(tooMany, await manyZip.generateAsync({ type: 'nodebuffer' }));

const docxDocument = await extractOfficeDocument(docx, 'docx');
if (!docxDocument.paragraphs.some((line) => line.includes('Word body line'))) throw new Error('docx extraction failed');
const xlsxDocument = await extractOfficeDocument(xlsx, 'xlsx');
if (!xlsxDocument.previewRows[0]?.includes('Alpha') || xlsxDocument.previewRows[0][1] !== '12') throw new Error('xlsx extraction failed');
const pptxDocument = await extractOfficeDocument(pptx, 'pptx');
if (pptxDocument.slides[0]?.title !== 'Office Slide Title') throw new Error('pptx extraction failed');

const directOutput = path.join(sourcesRoot, 'direct.png');
await renderOfficeThumbnail({ source: docx, output: directOutput, maxSize: 480, extension: 'docx', item: { name: 'direct' } });
const directMeta = await sharp(directOutput).metadata();
if (!directMeta.width || directMeta.width > 480 || directMeta.format !== 'png') throw new Error('direct office render failed');

let entryLimitError;
try { await extractOfficeDocument(tooMany, 'docx'); } catch (err) { entryLimitError = err; }
if (entryLimitError?.code !== 'OFFICE_ZIP_ENTRIES_EXCEEDED') throw new Error('office ZIP entry limit not enforced');
const placeholderOutput = path.join(sourcesRoot, 'placeholder.png');
await renderOfficeThumbnail({ source: tooMany, output: placeholderOutput, maxSize: 480, extension: 'docx', item: { name: 'too-many' } });
if (!fs.existsSync(placeholderOutput)) throw new Error('office placeholder fallback failed');

let server = await startServer();
try {
  const created = await post(server.base, '/api/library/create', { name: 'Office Cover', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', { paths: [docx, xlsx, pptx, broken] });
  if (imported.response.status !== 201 || imported.body.data.length !== 4) {
    throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
  }
  const items = new Map(imported.body.data.map((item) => [item.name, item]));
  for (const name of ['sample', 'sheet', 'deck', 'broken']) {
    const item = items.get(name);
    if (!item.thumbnailTask) throw new Error(`${name} did not enqueue an Office thumbnail task`);
    const finished = await waitForTask(server.base, item.thumbnailTask);
    if (finished.status !== 'complete') throw new Error(`${name} Office thumbnail failed: ${JSON.stringify(finished)}`);
    const infoDir = path.join(librariesRoot, 'Office Cover.library', 'images', `${item.id}.info`);
    const thumb = path.join(infoDir, `${item.name}_thumbnail.png`);
    if (!fs.existsSync(thumb)) throw new Error(`${name} Office thumbnail missing`);
    const meta = await sharp(thumb).metadata();
    if (!meta.width || meta.width > 480) throw new Error(`${name} Office thumbnail dimensions invalid`);
    const metadata = JSON.parse(fs.readFileSync(path.join(infoDir, 'metadata.json'), 'utf8'));
    if (metadata.noThumbnail || metadata.processingThumbnail || metadata.thumbnailTask || metadata.thumbnailError || !Array.isArray(metadata.palettes)) {
      throw new Error(`${name} Office metadata inconsistent`);
    }
  }

  const service = new ThumbnailTaskService();
  for (const ext of ['docx', 'xlsx', 'pptx']) {
    if (!service.supports(ext)) throw new Error(`office support missing: ${ext}`);
  }
} finally {
  await stopServer(server);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('OFFICE_THUMBNAIL_CLOSED_LOOP_OK');
