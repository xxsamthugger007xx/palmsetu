import * as ImagePicker from 'expo-image-picker';

/**
 * Client-side image quality pre-check, run immediately after capture so users get
 * fast feedback before uploading. This is a heuristic gate, not the real analysis,
 * the authoritative palm analysis (see server/src/palmAnalysis/) runs server-side.
 *
 * IMPORTANT: this module must stay a thin, replaceable interface. It must never
 * claim to have detected specific palm lines - only surface basic capture issues
 * (missing dimensions, clearly tiny/corrupt files) that are cheap to check on-device.
 */
export interface ImageQualityCheck {
  ok: boolean;
  message: string;
}

export async function assessImageQuality(
  asset: ImagePicker.ImagePickerAsset
): Promise<ImageQualityCheck> {
  const { width, height, fileSize } = asset;

  if (!width || !height) {
    return { ok: false, message: 'Could not read this image. Please try taking another photo.' };
  }

  const megapixels = (width * height) / 1_000_000;
  if (megapixels < 0.3) {
    return {
      ok: false,
      message: 'This photo looks too low-resolution. Try retaking it closer and in better light.',
    };
  }

  if (fileSize !== undefined && fileSize < 20_000) {
    return {
      ok: false,
      message: 'This photo may be too compressed or blurry to analyze well. Try retaking it.',
    };
  }

  const aspectRatio = width / height;
  if (aspectRatio > 2.2 || aspectRatio < 0.45) {
    return {
      ok: false,
      message: 'Try framing just your palm, filling most of the photo.',
    };
  }

  return { ok: true, message: '' };
}
