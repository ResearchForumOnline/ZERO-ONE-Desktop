// Build-time only: pinned upstream CPU engine, never executable downloads at user runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'electron/managed-local-runtime-manifest.json'), 'utf8'));
const key = process.argv[2] || `${process.platform}-${process.arch}`;
const spec = manifest.platforms[key]; if (!spec) throw new Error('Unsupported CPU runtime platform');
const hash = async p => { const h = crypto.createHash('sha256'); for await (const c of createReadStream(p)) h.update(c); return h.digest('hex'); };
const work = path.join(root, 'release-audit', 'runtime-stage', key);
await fs.mkdir(work, { recursive: true });
const archive = path.join(work, spec.asset);
if (!(await fs.stat(archive).catch(() => null)) || await hash(archive) !== spec.sha256) {
  const r = await fetch(`https://github.com/ggml-org/llama.cpp/releases/download/${manifest.runtimeVersion}/${spec.asset}`); if (!r.ok) throw new Error(`Runtime download HTTP ${r.status}`);
  const f = await fs.open(archive, 'w'); let bytes = 0; try { for await (const c of r.body) { bytes += c.length; if (bytes > spec.bytes) throw new Error('Runtime archive oversized'); await f.write(c); } } finally { await f.close(); }
}
if ((await fs.stat(archive)).size !== spec.bytes || await hash(archive) !== spec.sha256) throw new Error('Pinned runtime archive verification failed');
const unpack = path.join(work, 'unpack'); await fs.mkdir(unpack, { recursive: true });
{
  const listing = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (listing.some(p => path.isAbsolute(p) || p.split('/').includes('..'))) throw new Error('Runtime archive contains unsafe paths');
  execFileSync('tar', ['-xf', archive, '-C', unpack]);
}
const output = path.join(root, 'vendor', 'local-runtime'); await fs.mkdir(output, { recursive: true });
async function walk(dir) { let all = []; for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isSymbolicLink()) { const target = await fs.realpath(p); if (!target.startsWith(unpack + path.sep)) throw new Error('Runtime symlink escapes archive'); if ((await fs.stat(p)).isFile()) all.push(p); } else if (entry.isDirectory()) all.push(...await walk(p)); else all.push(p); } return all; }
const chosen = (await walk(unpack)).filter(p => { const n = path.basename(p); return n === spec.executable || /^llama-server-impl\.dll$|\.dll$|\.dylib$|\.so(?:\.[0-9]+)*$|^LICENSE/.test(n); });
if (!chosen.some(p => path.basename(p) === spec.executable)) throw new Error('Runtime server missing');
// Owned, exact output directory only. Remove stale previous platform files, not any other vendor tree.
for (const name of await fs.readdir(output)) { const p = path.join(output, name); if ((await fs.lstat(p)).isFile()) await fs.unlink(p); else throw new Error('Unexpected directory in runtime output'); }
const files = [];
for (const p of chosen) { const name = path.basename(p); if (files.some(f => f.file === name)) continue; const dest = path.join(output, name); await fs.copyFile(p, dest); if (!key.startsWith('win32')) await fs.chmod(dest, 0o755); files.push({ file: name, bytes: (await fs.stat(dest)).size, sha256: await hash(dest) }); }
const license = await fetch(`https://raw.githubusercontent.com/ggml-org/llama.cpp/${manifest.runtimeVersion}/LICENSE`); if (!license.ok) throw new Error('Upstream license missing'); await fs.writeFile(path.join(output, 'LICENSE-llama.cpp'), await license.text());
files.push({ file: 'LICENSE-llama.cpp', bytes: (await fs.stat(path.join(output, 'LICENSE-llama.cpp'))).size, sha256: await hash(path.join(output, 'LICENSE-llama.cpp')) });
const modelCardResponse = await fetch(`https://huggingface.co/${manifest.model.id}/raw/${manifest.model.revision}/README.md`); if (!modelCardResponse.ok) throw new Error('Pinned model attribution card missing');
const modelCard = Buffer.from(await modelCardResponse.arrayBuffer()); if (crypto.createHash('sha256').update(modelCard).digest('hex') !== manifest.model.modelCardSha256) throw new Error('Pinned model attribution changed');
await fs.writeFile(path.join(output, 'MODEL_CARD-OpenZero.txt'), modelCard);
await fs.writeFile(path.join(output, 'MODEL_TERMS_NOTICE.txt'), 'OpenZero Gemma4 E2B Agentic Q4_K_M\nIndependent fine-tune by shafire / OpenZero / TalkToAI. Based on Google Gemma; not affiliated with or endorsed by Google.\nModel data is downloaded separately to your own device. No redistribution or new model license is granted by ZERO ONE.\nReview Google Gemma Terms of Use: https://ai.google.dev/gemma/terms\nReview the exact pinned model card and OpenZero Community Source terms before downloading or commercial use:\n' + manifest.model.licenseUrl + '\nhttps://github.com/ResearchForumOnline/OpenZero/blob/main/LICENSE\nThe MIT license of the llama.cpp inference engine does not apply to the model weights.\n');
for (const name of ['MODEL_CARD-OpenZero.txt', 'MODEL_TERMS_NOTICE.txt']) files.push({ file: name, bytes: (await fs.stat(path.join(output, name))).size, sha256: await hash(path.join(output, name)) });
await fs.writeFile(path.join(output, 'provenance.json'), JSON.stringify({ schema: 1, runtimeVersion: manifest.runtimeVersion, platform: key, source: manifest.runtimeRepository, asset: spec.asset, archiveSha256: spec.sha256, archiveBytes: spec.bytes, files }, null, 2) + '\n');
console.log(`Staged ${key}: ${files.length} pinned CPU runtime files in ${output}`);
