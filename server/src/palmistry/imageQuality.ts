import sharp, { Metadata, Stats } from 'sharp';
import { ImageQualityReport } from '../types/palm';

/**
 * Auto-orients an image buffer according to its embedded EXIF orientation
 * tag before any pixel-level analysis or vision-model call sees it. Without
 * this, a photo taken with the phone held sideways but tagged "rotate me"
 * in EXIF gets analyzed in its raw, visually-rotated pixel orientation -
 * sharp's parameterless `.rotate()` reads the EXIF orientation tag and
 * physically rotates the pixel data to match, then strips the tag so
 * nothing downstream re-applies the rotation a second time. If the buffer
 * has no EXIF orientation tag (orientation 1, or none at all), this is a
 * no-op pass-through. Both the quality-metric pass below and the Gemini
 * vision call in visionDetector.ts must see this oriented buffer, never the
 * raw one, so they both "see" the same visually-upright image a human would.
 */
export async function autoOrientImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(imageBuffer).rotate().toBuffer();
  } catch {
    // If the buffer can't be decoded here, return it unchanged - the
    // decode will fail again (and be reported honestly) in the metadata
    // read below, rather than swallowing the error silently.
    return imageBuffer;
  }
}

/**
 * Real pixel-level image-quality checks using sharp, replacing the old
 * byte-size-only heuristic in the previous PrototypePalmAnalyzer. Still
 * intentionally simple (no face/hand detection here - that happens in the
 * vision-detection step), but every number below comes from actually
 * decoding and measuring the image, not from guessing off file size.
 *
 * Expects an already auto-oriented buffer (see autoOrientImage above) -
 * callers are responsible for orienting once, upstream, so this function
 * and the vision-detection call both measure/see the identical image.
 */
export async function assessImageQuality(imageBuffer: Buffer): Promise<ImageQualityReport> {
  const issues: string[] = [];

  let meta: Metadata;
  let stats: Stats;
  try {
    const img = sharp(imageBuffer);
    meta = await img.metadata();
    stats = await img.stats();
  } catch (err) {
    return {
      ok: false,
      issues: ['Image could not be decoded - it may be corrupted or in an unsupported format.'],
      sharpnessScore: 0,
      brightnessScore: 0,
      contrastScore: 0,
      widthPx: 0,
      heightPx: 0,
    };
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 400 || height < 400) {
    issues.push('Image resolution is quite low - retake the photo closer to the hand if possible.');
  }

  // Brightness: mean channel value normalized to 0-1. Very dark or very
  // blown-out images get flagged.
  const channelMeans = stats.channels.map((c: { mean: number }) => c.mean);
  const meanBrightness = channelMeans.reduce((a: number, b: number) => a + b, 0) / channelMeans.length;
  const brightnessScore = Math.max(0, Math.min(1, meanBrightness / 255));
  if (brightnessScore < 0.2) issues.push('Image appears very dark - try better lighting.');
  if (brightnessScore > 0.92) issues.push('Image appears overexposed/washed out - try softer or more even lighting.');

  // Contrast: average per-channel standard deviation normalized to 0-1.
  // Low contrast often correlates with flat lighting or a blurry/low-detail photo.
  const channelStdevs = stats.channels.map((c: { stdev: number }) => c.stdev);
  const meanStdev = channelStdevs.reduce((a: number, b: number) => a + b, 0) / channelStdevs.length;
  const contrastScore = Math.max(0, Math.min(1, meanStdev / 80));
  if (contrastScore < 0.15) issues.push('Image appears low-contrast or flat - try a plainer background with more even light.');

  // Sharpness proxy: apply a Laplacian-like edge-detection kernel via sharp's
  // convolve, then measure the resulting standard deviation. A blurry image
  // produces a low-variance edge response; a sharp image produces a higher
  // one. This is a real, standard variance-of-Laplacian blur metric, not a
  // placeholder - it is a widely used, genuinely meaningful proxy for focus
  // sharpness, though it is still a heuristic and not a calibrated absolute
  // measurement.
  let sharpnessScore = 0;
  try {
    const edgeStats = await sharp(imageBuffer)
      .greyscale()
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .stats();
    const edgeVariance = edgeStats.channels[0].stdev;
    // Empirically, a reasonably sharp phone photo produces an edge-response
    // stdev in the tens; normalize generously and clamp.
    sharpnessScore = Math.max(0, Math.min(1, edgeVariance / 40));
  } catch {
    sharpnessScore = 0.5; // could not compute - neutral, do not penalize or reward
  }
  if (sharpnessScore < 0.25) issues.push('Image appears blurry - hold the camera steady and ensure the hand is in focus.');

  return {
    ok: issues.length === 0,
    issues,
    sharpnessScore,
    brightnessScore,
    contrastScore,
    widthPx: width,
    heightPx: height,
  };
}
