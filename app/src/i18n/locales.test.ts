/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, 'locales');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flat(o: Record<string, unknown>, p = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') Object.assign(out, flat(v as Record<string, unknown>, `${p}${k}.`));
    else out[`${p}${k}`] = String(v);
  }
  return out;
}
const en = flat(load('en.json'));
const enBase = new Set(Object.keys(en).map((k) => k.replace(PLURAL, '')));
const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort();

describe.each(files.filter((f) => f !== 'en.json'))('locale %s', (file) => {
  const t = flat(load(file));
  const base = new Set(Object.keys(t).map((k) => k.replace(PLURAL, '')));

  it('has every key English has (plural forms count as the same key)', () => {
    expect([...enBase].filter((k) => !base.has(k))).toEqual([]);
  });
  it('has no stray keys that English lacks', () => {
    expect([...base].filter((k) => !enBase.has(k))).toEqual([]);
  });
  it('keeps every {{placeholder}} the English text uses, in every plural form', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(t)) {
      const enKey = enBase.has(k.replace(PLURAL, '')) ? Object.keys(en).find((e) => e.replace(PLURAL, '') === k.replace(PLURAL, '')) : undefined;
      if (!enKey) continue;
      const want = placeholders(en[enKey]);
      const have = placeholders(v);
      // zero/one/two forms may legitimately drop {{count}} (e.g. "no cards", "one card"); every other placeholder must remain
      const optional = /_(zero|one|two)$/.test(k);
      const missing = want.filter((p) => !have.includes(p) && !(optional && p === '{{count}}'));
      if (missing.length) bad.push(`${k}: missing ${missing.join(',')}`);
    }
    expect(bad).toEqual([]);
  });
  it('has no empty strings', () => {
    expect(Object.entries(t).filter(([, v]) => v.trim() === '').map(([k]) => k)).toEqual([]);
  });
});
