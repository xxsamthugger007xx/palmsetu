import fs from 'fs';
import path from 'path';

/**
 * Soulmate Sketch portraits are a pre-generated static asset library (see
 * data/soulmateCatalogAssets/ and catalogData.json) - there is no per-sketch
 * generated file to save or delete any more. This module just resolves a
 * catalogue filename to its real bytes on disk, for the image/share-image
 * routes and the share watermarking step.
 */

const STORAGE_DIR = path.join(__dirname, '..', '..', 'data', 'soulmateCatalogAssets');

function mimeTypeFor(filename: string): string {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/** filename must be an exact catalogue entry (see catalogMatcher.ts) - never
 * accepts an arbitrary path, so this can't be used to read outside the
 * static asset directory. */
export function readSoulmateCatalogImage(filename: string): { buffer: Buffer; mimeType: string } | null {
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) return null;
  const p = path.join(STORAGE_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return { buffer: fs.readFileSync(p), mimeType: mimeTypeFor(filename) };
}
