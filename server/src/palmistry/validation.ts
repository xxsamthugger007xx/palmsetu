import { ImageQualityReport, ImageValidation, ValidationStatus } from '../types/palm';
import { RawDetectionResult } from './visionDetector';

/**
 * Combines the content-based validation outcome from visionDetector.ts
 * (is this even a hand/palm?) with the real pixel-level quality gates from
 * imageQuality.ts (is it sharp/bright/contrasty enough?) into one decision.
 * These are deliberately independent gates - an image can fail one, both,
 * or neither.
 */
export function buildImageValidation(raw: RawDetectionResult | null, imageQuality: ImageQualityReport): ImageValidation {
  if (!raw) {
    // No vision call could be made at all (no API key, or the call/parse
    // failed). Never fabricate a content judgment in this case - fall back
    // to quality gating only, same honest behavior as the rest of this
    // feature when detection is unavailable.
    return {
      status: imageQuality.ok ? 'accepted' : 'rejected_quality',
      reason: imageQuality.ok ? null : imageQuality.issues.join(' '),
      isHandDetected: true,
      isPalmVisible: true,
      handSide: 'unknown',
      handSideConfidence: 0,
      multipleHandsDetected: false,
      isFullyFramed: true,
    };
  }

  let status: ValidationStatus = raw.validationStatus;
  let reason = raw.rejectionReason;

  // Quality gating can still downgrade an otherwise content-accepted image -
  // genuinely poor quality independently makes a reading unreliable even
  // if the content is clearly a palm.
  if (!imageQuality.ok && (status === 'accepted' || status === 'accepted_partial')) {
    status = 'rejected_quality';
    reason = imageQuality.issues.join(' ');
  }

  if (!raw.isFullyFramed && status === 'accepted') {
    status = 'accepted_partial';
    reason = reason ?? 'We can only see part of your palm - make sure the whole palm and wrist are in frame for the fullest reading.';
  }

  return {
    status,
    reason,
    isHandDetected: raw.isHandDetected,
    isPalmVisible: raw.isPalmVisible,
    handSide: raw.handSide,
    handSideConfidence: raw.handSideConfidence,
    multipleHandsDetected: raw.multipleHandsDetected,
    isFullyFramed: raw.isFullyFramed,
  };
}

export function isAccepted(status: ValidationStatus): boolean {
  return status === 'accepted' || status === 'accepted_partial';
}
