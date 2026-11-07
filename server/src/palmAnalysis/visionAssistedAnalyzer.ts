import { v4 as uuid } from 'uuid';
import { PalmAnalysisResult } from '../types/palm';
import { PalmImageAnalyzer } from './types';
import { assessImageQuality, autoOrientImage } from '../palmistry/imageQuality';
import { runVisionDetection } from '../palmistry/visionDetector';
import { mapRawDetectionToObservations } from '../palmistry/featureMapper';
import { buildImageValidation } from '../palmistry/validation';

/**
 * VISION-ASSISTED STRUCTURED DETECTION - replaces the old byte-size-only
 * PrototypePalmAnalyzer. This is explicitly NOT classical CV landmark/crease
 * segmentation (no MediaPipe-grade hand-landmark model is used): it is
 * real pixel-level image-quality analysis (via `sharp`) plus a single
 * Gemini vision call asked only for coarse qualitative characteristics,
 * each with its own numeric confidence (see palmistry/visionDetector.ts
 * for the exact prompt and output contract, and palmistry/featureMapper.ts
 * for how those raw signals are gated against knowledge-base thresholds
 * before being allowed to appear as `detected: true` anywhere).
 *
 * Why this approach and not a trained landmark model: a genuine hand-
 * landmark/crease-segmentation pipeline (e.g. MediaPipe Hands) only gives
 * joint/fingertip keypoints, not the fine crease-level detail (exact path,
 * depth, curvature of a heart/head/life/fate line) this app's knowledge
 * base describes - that level of detail requires a trained image-
 * segmentation model that does not exist as an installable off-the-shelf
 * library and cannot be trained in this session. Rather than fabricate
 * that capability, this analyzer uses Gemini's vision input for coarse,
 * qualitative, confidence-scored observations instead - see the
 * CRITICAL SCOPING DECISION note in the original task brief for the full
 * reasoning this design follows.
 *
 * If/when a genuine trained landmark model becomes available, it should
 * replace this file's `analyze()` body (and its registration in
 * routes/palm.ts) - the `PalmImageAnalyzer` interface is the stable
 * contract and does not need to change.
 */
export class VisionAssistedPalmAnalyzer implements PalmImageAnalyzer {
  readonly version = 'vision-assisted-1.0';

  async analyze(imageBuffer: Buffer): Promise<PalmAnalysisResult> {
    // Auto-orient once, upstream of both the quality metrics and the vision
    // call, so a photo with a non-identity EXIF orientation tag (e.g. taken
    // with the phone held sideways) is measured and detected in its
    // visually-upright form rather than its raw, rotated pixel layout.
    const orientedBuffer = await autoOrientImage(imageBuffer);
    const imageQuality = await assessImageQuality(orientedBuffer);

    // Still worth attempting detection even with quality issues noted, so
    // the user gets the most useful result possible, but quality issues
    // are always surfaced plainly either way.
    const raw = await runVisionDetection(orientedBuffer);
    const mapped = mapRawDetectionToObservations(raw);
    const validation = buildImageValidation(raw, imageQuality);

    return {
      analysisId: uuid(),
      analyzerVersion: this.version,
      detectionMethod: raw ? 'vision-model-assisted-structured' : 'unavailable',
      hand: mapped.hand,
      validation,
      imageQuality,
      handShape: mapped.handShape,
      majorLines: mapped.majorLines,
      minorLines: mapped.minorLines,
      mounts: mapped.mounts,
      fingers: mapped.fingers,
      thumb: mapped.thumb,
      nails: mapped.nails,
      specialMarkings: mapped.specialMarkings,
      uncertainFeatures: mapped.uncertainFeatures,
    };
  }
}
