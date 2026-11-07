import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { assessImageQuality, autoOrientImage } from './imageQuality';
import { generateNoiseTestImage } from './testFixtures';

/**
 * EXIF-orientation verification. Rather than forcing a weak/synthetic test
 * (there is no meaningful fixture that proves "the photo looks visually
 * upright" without a human looking at it), this test proves the one thing
 * that IS mechanically verifiable: a real image tagged with a non-identity
 * EXIF orientation produces DIFFERENT pixel dimensions/layout after
 * `autoOrientImage` than the raw buffer does - i.e. the rotation genuinely
 * gets applied, not silently ignored. A wider manual/live check (actually
 * viewing a sideways phone photo before/after) is still the right way to
 * confirm the end-to-end visual result; that is noted in the final report
 * rather than faked here.
 */
describe('autoOrientImage', () => {
  it('physically rotates pixel data for a buffer with a non-identity EXIF orientation tag (90 degrees), changing width/height', async () => {
    // Build a real, rectangular (non-square) JPEG so a 90-degree rotation
    // is mechanically detectable via a width/height swap, then tag it with
    // EXIF orientation 6 ("rotate 90 CW to display correctly").
    const rect = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 120, g: 80, b: 60 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const rawMeta = await sharp(rect).metadata();
    expect(rawMeta.orientation).toBe(6);
    // Raw decode (no auto-rotate) reports the stored, un-rotated dimensions.
    expect(rawMeta.width).toBe(400);
    expect(rawMeta.height).toBe(200);

    const oriented = await autoOrientImage(rect);
    const orientedMeta = await sharp(oriented).metadata();
    // After physically applying orientation 6, width/height are swapped and
    // the EXIF tag itself is stripped (now absent or identity) so nothing
    // downstream re-applies the rotation a second time.
    expect(orientedMeta.width).toBe(200);
    expect(orientedMeta.height).toBe(400);
    expect(orientedMeta.orientation).toBeUndefined();
  });

  it('is a no-op for a buffer with no EXIF orientation tag', async () => {
    const plain = await generateNoiseTestImage(300, 150);
    const plainMeta = await sharp(plain).metadata();
    expect(plainMeta.orientation).toBeUndefined();

    const oriented = await autoOrientImage(plain);
    const orientedMeta = await sharp(oriented).metadata();
    expect(orientedMeta.width).toBe(plainMeta.width);
    expect(orientedMeta.height).toBe(plainMeta.height);
  });

  it('assessImageQuality still produces real metrics for an oriented buffer', async () => {
    const rect = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 120, g: 80, b: 60 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const oriented = await autoOrientImage(rect);
    const report = await assessImageQuality(oriented);
    expect(report.widthPx).toBe(200);
    expect(report.heightPx).toBe(400);
  });
});
