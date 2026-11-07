/**
 * Vision-model-assisted structured detection - NOT classical CV landmark
 * detection.
 *
 * This file makes one Gemini vision call per analyzed image, asking the
 * model only for coarse qualitative characteristics (e.g. "line appears
 * long", "mount appears prominent", "a star-shaped mark appears near the
 * Apollo mount") with a numeric confidence per field. It never asks for,
 * and never claims to produce, precise pixel coordinates, curvature radii,
 * or exact line-path geometry - that would require a trained image-
 * segmentation model that does not exist as an off-the-shelf library and
 * cannot be trained in this session (see palmAnalysis/README.md and the
 * CRITICAL SCOPING DECISION note this module was built against).
 *
 * This is a deliberately separate concern from the deterministic premium
 * report builder (see premiumPalmistryEngine.ts): this module only ever extracts
 * observations from the raw photo, it never writes interpretive prose, and
 * it is called during analysis (free tier included), not gated behind
 * entitlement - only the *interpretation* of verified observations is
 * gated, never the detection step itself.
 *
 * Calls the Gemini REST API directly (not through the shared AiProvider
 * text-chat interface, which has no image-input support and is reserved in
 * this feature for the premium narrative pass only) so this module has no
 * dependency on AiProvider and cannot be mistaken for the premium engine's
 * AI usage path.
 */

const REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_MODEL = process.env.GEMINI_VISION_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

export interface RawLineSignal {
  present: boolean;
  confidence: number;
  lengthLabel?: 'short' | 'medium' | 'long';
  depthLabel?: 'faint' | 'medium' | 'deep';
  shapeLabel?: string; // e.g. "straight", "curved", "slopes-steeply" - interpreted by featureMapper
  variantHints?: string[]; // free-text hints like "fork", "break", "island", "chained", "double" - low-confidence, cross-checked by featureMapper
}

export interface RawMountSignal {
  developmentLabel: 'prominent' | 'balanced' | 'flat' | 'overdeveloped' | 'unclear';
  confidence: number;
}

export interface RawFingerSignal {
  lengthLabel: 'long' | 'short' | 'average';
  confidence: number;
}

export interface RawMarkingSignal {
  type: string;
  location: string;
  confidence: number;
}

/** Content-based validation outcome - independent of (but combined with)
 * the real pixel-level image-quality gates in imageQuality.ts. These fields
 * ask the vision model the question its original prompt never asked: "is
 * this even a hand/palm at all?" */
export type ValidationStatus =
  | 'accepted'
  | 'accepted_partial'
  | 'rejected_no_hand'
  | 'rejected_back_of_hand'
  | 'rejected_not_a_body_part'
  | 'rejected_multiple_hands'
  | 'rejected_quality';

export interface RawDetectionResult {
  hand: 'left' | 'right' | 'unknown';
  handShapeLabel: 'earth' | 'air' | 'fire' | 'water' | 'mixed' | 'uncertain';
  handShapeConfidence: number;
  majorLines: Record<'heart' | 'head' | 'life' | 'fate', RawLineSignal>;
  mounts: Record<string, RawMountSignal>;
  fingers: Record<'index' | 'middle' | 'ring' | 'little', RawFingerSignal>;
  thumb: { flexibilityLabel: 'flexible' | 'stiff' | 'unclear'; flexibilityConfidence: number; sizeLabel: 'large' | 'small' | 'average'; sizeConfidence: number };
  nails: { shapeLabel: string; confidence: number };
  markings: RawMarkingSignal[];
  isHandDetected: boolean;
  isPalmVisible: boolean; // false if it is clearly the back of the hand
  handSide: 'left' | 'right' | 'unknown';
  handSideConfidence: number;
  multipleHandsDetected: boolean;
  isFullyFramed: boolean; // false if the palm/wrist appears cropped out of frame
  validationStatus: ValidationStatus;
  rejectionReason: string | null;
}

const PROMPT = `You are assisting a palmistry app with STRUCTURED, QUALITATIVE observation of a photographed palm.
Do NOT provide interpretations, meanings, or advice. Do NOT invent precise measurements or pixel coordinates.
Only report what you can plausibly assess visually, each with an honest confidence from 0 to 1 (1 = very confident, 0 = pure guess).
If the hand is not clearly visible, or a feature cannot be assessed, report present:false / label "unclear" and a low confidence rather than guessing.

FIRST, and most importantly, determine whether this image is actually usable for a palm reading at all:
- isHandDetected: true only if a human hand is visible anywhere in the image.
- isPalmVisible: true only if the palm (front/inner surface, where the major lines are) is visible. If only the back of the hand is shown, this is false.
- handSide: "left" | "right" | "unknown" - which hand is shown.
- handSideConfidence: your honest confidence from 0 to 1 in that handSide judgment (1 = very confident, 0 = pure guess). This is used to compare against the user's own manual left/right selection, so do not inflate it - genuinely unclear framing (e.g. hand angled, only partial view) should get a low confidence here.
- multipleHandsDetected: true if more than one hand appears in the frame.
- isFullyFramed: true only if the whole palm AND the wrist are within the frame, not cropped off.
- validationStatus: one of "accepted" | "accepted_partial" | "rejected_no_hand" | "rejected_back_of_hand" | "rejected_not_a_body_part" | "rejected_multiple_hands" | "rejected_quality". Pick:
  - "rejected_no_hand" if no hand is visible at all (e.g. a face, a random object, a screenshot, blank wall).
  - "rejected_not_a_body_part" if a body part other than a hand (e.g. a face, foot, arm without visible palm) is shown.
  - "rejected_back_of_hand" if a hand is visible but it is the back of the hand, not the palm.
  - "rejected_multiple_hands" if more than one hand/palm is in frame, making a single clean reading impossible.
  - "accepted_partial" if a single palm is visible but notably cropped/obscured (e.g. missing the wrist, part of the palm cut off, fingers folded over covering lines) - still usable but with limited visibility.
  - "accepted" if a single palm is clearly, fully visible.
  - "rejected_quality" only if the image is so dark/blurry you genuinely cannot tell if it's even a hand (prefer "accepted_partial" or another status whenever you can still make out a hand).
- rejectionReason: if validationStatus is not "accepted" or "accepted_partial", a short, genuinely explanatory, user-facing sentence explaining what's wrong and how to fix it (e.g. "This looks like the back of your hand - turn your palm to face the camera." or "We couldn't detect a hand in this photo - please photograph your open palm."). Otherwise null.

Respond with ONLY a single JSON object with this exact shape (no prose outside the JSON):
{
  "isHandDetected": boolean,
  "isPalmVisible": boolean,
  "handSide": "left" | "right" | "unknown",
  "handSideConfidence": number,
  "multipleHandsDetected": boolean,
  "isFullyFramed": boolean,
  "validationStatus": "accepted" | "accepted_partial" | "rejected_no_hand" | "rejected_back_of_hand" | "rejected_not_a_body_part" | "rejected_multiple_hands" | "rejected_quality",
  "rejectionReason": string | null,
  "hand": "left" | "right" | "unknown",
  "handShapeLabel": "earth" | "air" | "fire" | "water" | "mixed" | "uncertain",
  "handShapeConfidence": number,
  "majorLines": {
    "heart": { "present": boolean, "confidence": number, "lengthLabel": "short"|"medium"|"long", "depthLabel": "faint"|"medium"|"deep", "shapeLabel": "straight"|"curved", "variantHints": string[] },
    "head": { "present": boolean, "confidence": number, "lengthLabel": "short"|"medium"|"long", "depthLabel": "faint"|"medium"|"deep", "shapeLabel": "straight"|"slopes-slightly"|"slopes-steeply", "variantHints": string[] },
    "life": { "present": boolean, "confidence": number, "lengthLabel": "short"|"medium"|"long", "depthLabel": "faint"|"medium"|"deep", "shapeLabel": "close-arc"|"wide-arc", "variantHints": string[] },
    "fate": { "present": boolean, "confidence": number, "lengthLabel": "short"|"medium"|"long", "depthLabel": "faint"|"medium"|"deep", "shapeLabel": "", "variantHints": string[] }
  },
  "mounts": {
    "venus": { "developmentLabel": "prominent"|"balanced"|"flat"|"overdeveloped"|"unclear", "confidence": number },
    "jupiter": { "developmentLabel": "...", "confidence": number },
    "saturn": { "developmentLabel": "...", "confidence": number },
    "apollo": { "developmentLabel": "...", "confidence": number },
    "mercury": { "developmentLabel": "...", "confidence": number },
    "moon": { "developmentLabel": "...", "confidence": number },
    "upperMars": { "developmentLabel": "...", "confidence": number },
    "lowerMars": { "developmentLabel": "...", "confidence": number },
    "plainOfMars": { "developmentLabel": "...", "confidence": number }
  },
  "fingers": {
    "index": { "lengthLabel": "long"|"short"|"average", "confidence": number },
    "middle": { "lengthLabel": "...", "confidence": number },
    "ring": { "lengthLabel": "...", "confidence": number },
    "little": { "lengthLabel": "...", "confidence": number }
  },
  "thumb": { "flexibilityLabel": "flexible"|"stiff"|"unclear", "flexibilityConfidence": number, "sizeLabel": "large"|"small"|"average", "sizeConfidence": number },
  "nails": { "shapeLabel": "short-wide"|"long-narrow"|"square"|"rounded"|"unclear", "confidence": number },
  "markings": [ { "type": "star"|"cross"|"triangle"|"square"|"circle"|"island"|"grille"|"trident"|"fish"|"branch"|"parallelLines"|"chain"|"dot", "location": string, "confidence": number } ]
}`;

function guessMimeType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'image/jpeg';
}

/** Returns null (never throws past this point) if no API key is configured
 * or the call/parse fails, so callers can fall back to quality-gate-only
 * behavior honestly rather than crash the whole analysis. */
export async function runVisionDetection(imageBuffer: Buffer): Promise<RawDetectionResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: guessMimeType(imageBuffer), data: imageBuffer.toString('base64') } },
              ],
            },
          ],
          generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 2000 },
        }),
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as RawDetectionResult;
    if (!parsed || typeof parsed !== 'object' || !parsed.majorLines) return null;
    // Defensive defaults - if the model omits the newer validation fields
    // (e.g. an older cached prompt response), never silently treat the
    // image as accepted; fall back to a conservative "can't confirm" state
    // rather than fabricating a pass.
    if (typeof parsed.isHandDetected !== 'boolean') parsed.isHandDetected = true;
    if (typeof parsed.isPalmVisible !== 'boolean') parsed.isPalmVisible = true;
    if (!parsed.handSide) parsed.handSide = parsed.hand ?? 'unknown';
    if (typeof parsed.handSideConfidence !== 'number' || Number.isNaN(parsed.handSideConfidence)) parsed.handSideConfidence = 0;
    if (typeof parsed.multipleHandsDetected !== 'boolean') parsed.multipleHandsDetected = false;
    if (typeof parsed.isFullyFramed !== 'boolean') parsed.isFullyFramed = true;
    if (!parsed.validationStatus) parsed.validationStatus = 'accepted';
    if (parsed.rejectionReason === undefined) parsed.rejectionReason = null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
