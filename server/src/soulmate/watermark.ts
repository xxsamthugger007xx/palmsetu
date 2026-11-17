import sharp from 'sharp';

/**
 * Adds a small "Palm Setu" text watermark to the bottom-right corner of an
 * image buffer, for the shared version only - the original saved image
 * (served by GET /soulmate/sketches/:id/image) is never touched or
 * overwritten by this; the watermark is composited fresh on every call to
 * the share-image endpoint and never persisted to disk.
 */
export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const meta = await image.metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 800;
  const fontSize = Math.max(16, Math.round(width * 0.035));

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .wmShadow { fill: rgba(0,0,0,0.45); font-size: ${fontSize}px; font-family: sans-serif; font-weight: 600; }
      .wm { fill: rgba(255,255,255,0.9); font-size: ${fontSize}px; font-family: sans-serif; font-weight: 600; }
    </style>
    <text x="${width - 10}" y="${height - 14}" text-anchor="end" class="wmShadow">Palm Setu</text>
    <text x="${width - 12}" y="${height - 16}" text-anchor="end" class="wm">Palm Setu</text>
  </svg>`;

  return image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
}
