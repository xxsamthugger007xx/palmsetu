/**
 * Shared detection thresholds. Nothing is ever surfaced as `detected: true`
 * unless its confidence clears one of these floors (or, for a feature with
 * its own `confidenceThreshold` in the knowledge base, that entry's own
 * threshold - which is usually set stricter for harder-to-verify markings
 * like islands, dots, and the fish mark).
 */
// Chosen value and reasoning (gap-closing review, not a rebuild): 0.6 was
// kept rather than loosened or tightened further, because it already sits
// at the strict end of the 0.55-0.7 band that is reasonable for this kind
// of coarse qualitative vision-model signal, and it matches the precedent
// this codebase already set for its own confidence-gated decisions - most
// notably visionDetector.ts's prompt asks the model for "honest confidence
// ... 0 = pure guess" on the same 0-1 scale, and headLine.ts's own
// knowledge-base entry for the single most commonly over-claimed feature
// (head-line-long) independently arrived at the same 0.6 value. A photo
// that only produces mediocre/ambiguous signals (confidence clustering
// around 0.4-0.55) will not clear this floor and is correctly routed to
// uncertainFeatures instead of inflating the free reading's section count -
// see featureMapper.test.ts for a test asserting exactly this.
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Below this, a feature is never matched at all, regardless of what the
 * knowledge base entry's own threshold says - this is a hard floor against
 * ever treating a near-zero-confidence guess as a real signal. */
export const ABSOLUTE_MINIMUM_CONFIDENCE = 0.2;
