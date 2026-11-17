import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Soulmate Sketch portraits are a pre-generated static asset library (see
 * app/assets/soulmate-sketches/ and catalogData.json) - there is no per-sketch
 * generated file to save or delete any more. This module just resolves a
 * catalogue filename to its real bytes on disk, for the image/share-image
 * routes and the share watermarking step.
 */

const STORAGE_DIR = path.resolve(__dirname, '../../../app/assets/soulmate-sketches');

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
  try {
    const buffer = fs.readFileSync(p);
    if (buffer.length === 0) return null;
    const mimeType = mimeTypeFor(filename);
    if (!mimeType.startsWith('image/')) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

/** Confirms the selected catalogue file can be parsed as an image before a
 * sketch is marked complete. Metadata parsing also rejects truncated or
 * malformed image headers without producing a transformed copy. */
export async function isReadableSoulmateCatalogImage(filename: string): Promise<boolean> {
  const stored = readSoulmateCatalogImage(filename);
  if (!stored) return false;

  try {
    const metadata = await sharp(stored.buffer).metadata();
    const expectedFormat = stored.mimeType === 'image/png' ? 'png' : 'jpeg';
    return metadata.format === expectedFormat
      && Number.isFinite(metadata.width) && (metadata.width ?? 0) > 0
      && Number.isFinite(metadata.height) && (metadata.height ?? 0) > 0;
  } catch {
    return false;
  }
}
