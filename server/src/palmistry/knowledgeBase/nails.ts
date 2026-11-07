import { KnowledgeEntry } from './types';

const V = 'kb-1.0';
const SRC = ['Traditional Western palmistry compendia, cross-referenced for consistency'];

export const NAIL_ENTRIES: KnowledgeEntry[] = [
  {
    category: 'nail', featureId: 'nail-shape-length-width', featureName: 'Nail shape, length and width characteristics',
    location: 'Fingernails, assessed collectively across the visible fingers.',
    visualDescription: 'Broad categories only: short-and-wide, long-and-narrow, square, or rounded, assessed qualitatively from the image. No texture, color, ridging, or surface detail is assessed.',
    detectionCriteria: 'Coarse shape/proportion comparison only. Explicitly excludes any attempt to read nail color, ridges, spots, texture, or surface condition, since those visual cues are commonly (and incorrectly) associated with health claims in folk practice, and this app does not make health claims from nails.',
    confidenceThreshold: 0.4,
    traditionalMeaning: 'Traditionally read, in shape terms only, as a loose temperament cue: short-wide nails traditionally linked to a more critical, quick-to-judge temperament; long-narrow nails to a more idealistic, easily disappointed one; square nails to practicality; rounded nails to adaptability.',
    personalityInterpretation: 'Varies by shape as described above; always read as a mild tendency, not a fixed trait.',
    emotionalInterpretation: 'Not a primary emotional indicator in traditional practice; read lightly if at all.',
    relationshipInterpretation: 'Not typically read as relationship-specific.',
    strengths: ['Varies by shape'],
    challenges: ['Varies by shape'],
    freeReading: 'Your nails read as {shapeVariant}, a traditional (and minor) temperament cue.',
    premiumReading: 'Nail shape is one of the lightest-weight traditional markers covered in this app; it is read only for coarse shape and proportion, and explicitly never for color, ridging, texture, or any other surface characteristic, since those carry no legitimate basis for the health or nutrition claims sometimes attached to them in folk practice.',
    relatedFeatures: [],
    combinationRules: [],
    limitations: 'Never read as a health, nutrition, or medical diagnosis of any kind. Nail color, ridging, spotting, or any other surface/texture characteristic is explicitly out of scope for this app regardless of what folk practice claims about it.',
    sourceReferences: SRC,
    version: V,
  },
];
