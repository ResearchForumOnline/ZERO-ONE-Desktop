'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = require('../electron/managed-local-runtime-manifest.json');
function verifyLocalRuntime(dir, platform = `${process.platform}-${process.arch}`) {
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json'), 'utf8'));
  const spec = manifest.platforms[platform];
  if (!spec || receipt.platform !== platform || receipt.runtimeVersion !== manifest.runtimeVersion || receipt.archiveSha256 !== spec.sha256 || !receipt.files?.length) throw new Error('CPU runtime provenance mismatch');
  for (const item of receipt.files) { if (!/^[\w.-]+$/.test(item.file)) throw new Error('Unsafe CPU runtime filename'); const data = fs.readFileSync(path.join(dir, item.file)); if (data.length !== item.bytes || crypto.createHash('sha256').update(data).digest('hex') !== item.sha256) throw new Error('CPU runtime file verification failed: ' + item.file); }
  if (!receipt.files.some(f => f.file === spec.executable) || !receipt.files.some(f => f.file === 'LICENSE-llama.cpp')) throw new Error('CPU runtime executable/license missing');
  return receipt;
}
if (require.main === module) { const result = verifyLocalRuntime(process.argv[2] || 'vendor/local-runtime', process.argv[3]); console.log(`Verified ${result.files.length} CPU runtime files (${result.platform})`); }
module.exports = { verifyLocalRuntime };
