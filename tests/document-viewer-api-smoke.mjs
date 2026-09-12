import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-doc-viewer-api-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

async function makeDocx(filePath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '</Types>',
  ].join(''));
  zip.file('_rels/.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '</Relationships>',
  ].join(''));
  zip.file('word/document.xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:body>',
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Office Word Title</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Word body line</w:t></w:r></w:p>',
    '</w:body>',
    '</w:document>',
  ].join(''));
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function makeXlsx(filePath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet A');
  sheet.addRow(['Alpha', 12]);
  sheet.addRow(['Beta', 34]);
  await workbook.xlsx.writeFile(filePath);
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
      // Force LibreOffice resolution to fail so convertible items report a
      // clean capability fallback instead of hanging on a real conversion.
      EAGLE_SOFFICE_PATH: path.join(tempRoot, 'no-such-soffice'),
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

const docxPath = path.join(sourcesRoot, 'doc-sample.docx');
const xlsxPath = path.join(sourcesRoot, 'sheet-sample.xlsx');
const pptxPath = path.join(sourcesRoot, 'slides-sample.pptx');
const pdfPath = path.join(projectRoot, 'frontend/public/mock-assets/sample.pdf');
const legacyDocPath = path.join(sourcesRoot, 'legacy.doc');

await makeDocx(docxPath);
await makeXlsx(xlsxPath);
await makePptx(pptxPath);
fs.writeFileSync(legacyDocPath, '%PDF-1.4 legacy-like file\n');

let server = await startServer();
try {
  const created = await post(server.base, '/api/library/create', { name: 'Doc Viewer', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', {
    paths: [docxPath, xlsxPath, pptxPath, pdfPath, legacyDocPath],
  });
  if (imported.response.status !== 201 || imported.body.data.length !== 5) {
    throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
  }
  const items = new Map(imported.body.data.map((item) => [item.name, item]));

  // ── Office read ──────────────────────────────────────────────────────────
  const docxRead = await request(server.base, `/api/v2/item/officeDocument?id=${items.get('doc-sample').id}`);
  if (docxRead.response.status !== 200 || docxRead.body.data.readerKind !== 'docx') {
    throw new Error(`docx read failed: ${JSON.stringify(docxRead.body)}`);
  }
  if (!Array.isArray(docxRead.body.data.blocks) || docxRead.body.data.blocks.length < 2) {
    throw new Error(`docx blocks missing: ${JSON.stringify(docxRead.body.data.blocks)}`);
  }
  if (typeof docxRead.body.data.mtimeMs !== 'number') {
    throw new Error('docx mtimeMs missing');
  }

  const xlsxRead = await request(server.base, `/api/v2/item/officeDocument?id=${items.get('sheet-sample').id}`);
  if (xlsxRead.response.status !== 200 || xlsxRead.body.data.readerKind !== 'xlsx') {
    throw new Error(`xlsx read failed: ${JSON.stringify(xlsxRead.body)}`);
  }
  if (!Array.isArray(xlsxRead.body.data.sheets) || xlsxRead.body.data.sheets[0]?.previewRows?.[0]?.[0] !== 'Alpha') {
    throw new Error(`xlsx sheets mismatch: ${JSON.stringify(xlsxRead.body.data.sheets)}`);
  }

  const pptxRead = await request(server.base, `/api/v2/item/officeDocument?id=${items.get('slides-sample').id}`);
  if (pptxRead.response.status !== 200 || pptxRead.body.data.readerKind !== 'pptx') {
    throw new Error(`pptx read failed: ${JSON.stringify(pptxRead.body)}`);
  }
  if (!Array.isArray(pptxRead.body.data.slides) || pptxRead.body.data.slides[0]?.texts?.[0] !== 'Office Slide Title') {
    throw new Error(`pptx slides mismatch: ${JSON.stringify(pptxRead.body.data.slides)}`);
  }

  // Unsupported Office extension must 415.
  const legacyRead = await request(server.base, `/api/v2/item/officeDocument?id=${items.get('legacy').id}`);
  if (legacyRead.response.status !== 415 || legacyRead.body.code !== 'OFFICE_FORMAT_UNSUPPORTED') {
    throw new Error(`legacy office read mismatch: ${JSON.stringify(legacyRead.body)}`);
  }

  // ── Office quick-edit save ───────────────────────────────────────────────
  const blocks = docxRead.body.data.blocks;
  blocks[0] = { ...blocks[0], text: 'Edited Title' };
  const saveInput = { readerKind: 'docx', blocks };
  const save = await post(server.base, '/api/v2/item/officeSave', {
    id: items.get('doc-sample').id,
    expectedMtimeMs: docxRead.body.data.mtimeMs,
    ...saveInput,
  });
  if (save.response.status !== 200 || typeof save.body.data.mtimeMs !== 'number') {
    throw new Error(`docx save failed: ${JSON.stringify(save.body)}`);
  }

  const docxAfter = await request(server.base, `/api/v2/item/officeDocument?id=${items.get('doc-sample').id}`);
  if (!docxAfter.body.data.blocks[0].text.includes('Edited Title')) {
    throw new Error(`docx round-trip failed: ${JSON.stringify(docxAfter.body.data.blocks[0])}`);
  }

  // Missing expectedMtimeMs → 400.
  const missingMtime = await post(server.base, '/api/v2/item/officeSave', { id: items.get('doc-sample').id, ...saveInput });
  if (missingMtime.response.status !== 400 || missingMtime.body.code !== 'OFFICE_SAVE_MTIME_REQUIRED') {
    throw new Error(`office mtime required mismatch: ${JSON.stringify(missingMtime.body)}`);
  }

  // Stale mtime → 409 conflict (use the pre-save mtime again).
  const conflict = await post(server.base, '/api/v2/item/officeSave', {
    id: items.get('doc-sample').id,
    expectedMtimeMs: docxRead.body.data.mtimeMs,
    ...saveInput,
  });
  if (conflict.response.status !== 409 || conflict.body.code !== 'OFFICE_SAVE_CONFLICT') {
    throw new Error(`office conflict mismatch: ${JSON.stringify(conflict.body)}`);
  }

  // ── PDF preview source (direct) ──────────────────────────────────────────
  const pdfSource = await request(server.base, `/api/v2/item/documentPreviewSource?id=${items.get('sample').id}`);
  if (pdfSource.response.status !== 200 || pdfSource.body.data.derived !== false || pdfSource.body.data.kind !== 'pdf') {
    throw new Error(`pdf source mismatch: ${JSON.stringify(pdfSource.body)}`);
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/v2\/item\/documentPreviewFile\?id=/.test(pdfSource.body.data.url)) {
    throw new Error(`pdf source url is not controlled: ${pdfSource.body.data.url}`);
  }

  const pdfFile = await fetch(pdfSource.body.data.url);
  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer());
  if (pdfFile.status !== 200 || !pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error(`pdf file stream failed: HTTP ${pdfFile.status}`);
  }

  // ── Convertible fallback without LibreOffice ─────────────────────────────
  const legacySource = await request(server.base, `/api/v2/item/documentPreviewSource?id=${items.get('legacy').id}`);
  if (legacySource.response.status !== 404) {
    throw new Error(`legacy convertible should fall back: ${JSON.stringify(legacySource.body)}`);
  }
  const docxSource = await request(server.base, `/api/v2/item/documentPreviewSource?id=${items.get('doc-sample').id}`);
  if (docxSource.response.status !== 404) {
    throw new Error(`docx convertible should fall back without LibreOffice: ${JSON.stringify(docxSource.body)}`);
  }
} finally {
  await stopServer(server);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('DOCUMENT_VIEWER_API_SMOKE_OK');
