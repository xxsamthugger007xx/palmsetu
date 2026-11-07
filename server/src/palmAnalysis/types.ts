import { PalmAnalysisResult } from '../types/palm';

/**
 * The analyzer contract. Any implementation (prototype heuristic, MediaPipe-based
 * landmark detector, third-party CV service) must satisfy this interface so it can
 * be swapped without touching routes or the interpretation layer.
 *
 * Hard rule: an implementation must never report `detected: true` for a region it
 * did not actually examine, and must never fabricate confidence to make a reading
 * feel more complete.
 */
export interface PalmImageAnalyzer {
  readonly version: string;
  analyze(imageBuffer: Buffer): Promise<PalmAnalysisResult>;
}
