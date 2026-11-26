import { DATA_DIR } from '../config/dataDir';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Real, persistent image storage on the server's own disk, under the same
 * data/ directory the SQLite database already lives in - survives restarts
 * exactly like every other persisted record in this app.
 *
 * This app has no cloud storage credentials configured anywhere (no AWS/GCS
 * keys, confirmed by checking server/.env.example - same honest gap as the
 * missing geocoding/payment-gateway credentials found elsewhere in this
 * session). Rather than fabricate a fake S3 integration, this stores real
 * files on real disk, genuinely persisted and access-controlled via the
 * existing ownership-check pattern in routes/palm.ts - a true "cloud
 * storage" swap (S3/GCS) would only need this module's three functions
 * reimplemented against a bucket client, the route layer would not change.
 */

const STORAGE_DIR = path.join(DATA_DIR, 'palmImages');

function ensureDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function filePathFor(readingId: string): string {
  return path.join(STORAGE_DIR, `${readingId}.jpg`);
}

export function saveReadingImage(readingId: string, buffer: Buffer): { hash: string } {
  ensureDir();
  fs.writeFileSync(filePathFor(readingId), buffer);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return { hash };
}

export function readReadingImage(readingId: string): Buffer | null {
  const p = filePathFor(readingId);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

export function deleteReadingImage(readingId: string): void {
  const p = filePathFor(readingId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
