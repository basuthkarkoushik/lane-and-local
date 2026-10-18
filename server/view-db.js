// Shows data/db.json as tables in your browser. Read-only: it never changes the database.
// Run:  node view-db.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DB = process.env.NDD_DB_PATH || path.join(__dirname, 'data', 'db.json');
const OUT = path.join(__dirname, 'data', 'db-view.html');
const HIDDEN = new Set(['password_hash', 'token_hash']); // secrets are never shown

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const show = (v) => {
  if (v === null || v === undefined) return '<span class="n">null</span>';
  if (typeof v === 'object') return `<code>${esc(JSON.stringify(v))}</code>`;
  return esc(v);
};

function table(name, rows) {
  if (!rows.length) return `<h2>${esc(name)} <small>(0)</small></h2><p class="n">No rows</p>`;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !HIDDEN.has(c));
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td>${show(r[c])}</td>`).join('')}</tr>`).join('');
  return `<h2>${esc(name)} <small>(${rows.length})</small></h2><div class="w"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

if (!fs.existsSync(DB)) {
  console.log('db.json not found. Start the server once with "npm start" so it is created.');
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(DB, 'utf-8'));

const parts = [];
for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) parts.push(table(key, val));
  else if (val && typeof val === 'object') {
    const entries = Object.entries(val);
    const nested = entries.length && entries.every(([, v]) => v && typeof v === 'object');
    parts.push(table(key, nested ? entries.map(([k, v]) => ({ key: k, ...v })) : entries.map(([k, v]) => ({ setting: k, value: v }))));
  }
}
const nav = Object.keys(db).map((k) => `<a href="#${esc(k)}">${esc(k)}</a>`).join(' ');
const html = `<!doctype html><meta charset="utf-8"><title>Database viewer</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;background:#f6f7fb;color:#14172b}
h1{margin:0 0 4px} h2{margin:32px 0 8px} small{color:#6b7088;font-weight:500}
.w{overflow:auto;background:#fff;border:1px solid #e5e7f0;border-radius:10px}
table{border-collapse:collapse;font-size:13px;width:100%}
th{position:sticky;top:0;background:#2e31be;color:#fff;text-align:left;padding:8px 10px;white-space:nowrap}
td{padding:7px 10px;border-top:1px solid #eef0f5;vertical-align:top;max-width:360px;overflow-wrap:anywhere}
tr:nth-child(even) td{background:#fafbff} .n{color:#9aa0b8} code{font-size:12px}
p.n{margin:0} .top{color:#6b7088;margin-bottom:12px} nav a{margin-right:12px}
</style>
<h1>Database viewer</h1>
<div class="top">File: ${esc(DB)} · read-only · password and session hashes are hidden · refresh by running the command again</div>
<nav>${nav}</nav>${parts.join('')}`;

fs.writeFileSync(OUT, html);
console.log('Created ' + OUT);
const open = process.platform === 'win32' ? `start "" "${OUT}"` : process.platform === 'darwin' ? `open "${OUT}"` : `xdg-open "${OUT}"`;
exec(open, () => {});