// 手造最小单页 PDF（蓝色矩形，200x200pt）——native-preview ai 路径 fixture 可行性实验
const fs = require('node:fs');

function buildMinimalPdf(outPath) {
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << >> >>\nendobj\n');
  const stream = '1 0 0 RG 1 1 1 rg 0 0 200 200 re f 0 0 1 rg 20 20 160 160 re f\n';
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(outPath, pdf, 'binary');
}

buildMinimalPdf(process.argv[2] || 'tests-tmp/minimal.ai.pdf');
console.log('PDF written:', process.argv[2] || 'tests-tmp/minimal.ai.pdf');
