# Palm analysis layer

`PalmImageAnalyzer` (types.ts) is the stable interface between image upload and
the knowledge-base/report layer (see server/src/palmistry/).

Current implementation: `VisionAssistedPalmAnalyzer` (visionAssistedAnalyzer.ts).
It performs real pixel-level image-quality analysis (sharpness, brightness,
contrast, via the `sharp` package in palmistry/imageQuality.ts), then a single
Gemini vision call asking only for coarse, qualitative, per-field-confidence
observations (see palmistry/visionDetector.ts). This is explicitly NOT
classical CV landmark/crease segmentation: it does not claim exact line-path
geometry, curvature radius, or precise pixel coordinates. See
palmistry/featureMapper.ts for how raw vision signals are gated against
knowledge-base confidence thresholds before anything is ever reported as
`detected: true`.

## Swapping in true CV landmark detection

If a genuine trained hand-landmark/crease-segmentation model becomes available
and practical to run server-side without a GPU:

1. Add a new class implementing `PalmImageAnalyzer`, e.g. `MediaPipeHandAnalyzer`,
   using a hand-landmark model (MediaPipe Hands or similar) to locate the palm
   region, then classical CV (ridge/crease detection, e.g. Gabor filters or a
   trained segmentation model) to find heart/head/life/fate line candidates.
2. Map detected line geometry to the typed observation shapes in
   `src/types/palm.ts`, setting `detected: true` only when a line was
   actually found, with `confidence` reflecting real detection quality
   (e.g. contour length/continuity), never a fixed value.
3. Swap the instantiation in `src/routes/palm.ts` (where `VisionAssistedPalmAnalyzer`
   is constructed today) - no other file needs to change, since `PalmImageAnalyzer`
   is the stable contract.
