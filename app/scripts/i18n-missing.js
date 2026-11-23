#!/usr/bin/env node
/** Lists UI strings that exist in English but are not translated yet, per language: npm run i18n:missing */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const PLURAL = /_(zero|one|two|few|many|other)$/;
function flat(o, p = '') { const out = {}; for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object') Object.assign(out, flat(v, p + k + '.')); else out[p + k] = v; } return out; }
const en = flat(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')));
const enBase = [...new Set(Object.keys(en).map((k) => k.replace(PLURAL, '')))];
const verbose = process.argv.includes('--keys');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'en.json')) {
  const t = flat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const have = new Set(Object.keys(t).map((k) => k.replace(PLURAL, '')));
  const missing = enBase.filter((k) => !have.has(k));
  console.log(`${f.replace('.json', '').padEnd(9)} ${String(enBase.length - missing.length).padStart(4)}/${enBase.length} translated, ${missing.length} falling back to English`);
  if (verbose) missing.forEach((k) => console.log('   ' + k));
}
