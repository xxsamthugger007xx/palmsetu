import { KnowledgeEntry } from './types';

const V = 'kb-1.0';
const SRC = ['Traditional elemental hand-shape classification (Earth/Air/Fire/Water), cross-referenced across Western palmistry compendia'];
const base = { category: 'handShape' as const, location: 'Overall hand: palm shape and finger length/proportion considered together.', version: V, sourceReferences: SRC };

export const HAND_SHAPE_ENTRIES: KnowledgeEntry[] = [
  { ...base, featureId: 'hand-shape-earth', featureName: 'Earth hand (square palm, short-to-moderate fingers)',
    visualDescription: 'A broadly square or rectangular palm with fingers that are short to moderate relative to palm length.', detectionCriteria: 'Palm width-to-length ratio close to 1, finger-to-palm length ratio on the shorter side, assessed qualitatively from the image.', confidenceThreshold: 0.45,
    traditionalMeaning: 'Traditionally associated with practicality, reliability, and a grounded, hands-on approach to life.', personalityInterpretation: 'Practical, steady, prefers tangible results over abstraction.', emotionalInterpretation: 'Processes feeling through action rather than extended reflection.', relationshipInterpretation: 'Shows care through reliable, concrete support rather than grand gestures.',
    strengths: ['Reliability', 'Practical problem-solving', 'Steadiness'], challenges: ['May be slower to engage with abstract or purely emotional conversation'],
    freeReading: 'Your hand shape reads as Earth: a square palm with shorter fingers, traditionally linked to practicality and steadiness.',
    premiumReading: 'An Earth hand shape is traditionally read as grounded and practical, someone who shows up reliably and prefers tangible action over abstract discussion. In work, this suits roles with clear, concrete outcomes; in relationships, care tends to show up as dependable support.',
    relatedFeatures: [], combinationRules: [], limitations: 'A traditional symbolic classification only, never a measure of intelligence, capability, or worth, and classification is probabilistic, not a rigid box - see the mixed/uncertain entry for when proportions do not clearly fit one type.' },
  { ...base, featureId: 'hand-shape-air', featureName: 'Air hand (square-to-rectangular palm, long fingers)',
    visualDescription: 'A square or rectangular palm with fingers that are notably long relative to palm length.', detectionCriteria: 'Palm width-to-length ratio moderate, finger-to-palm length ratio on the longer side, assessed qualitatively from the image.', confidenceThreshold: 0.45,
    traditionalMeaning: 'Traditionally associated with intellectual curiosity, communication, and a love of ideas.', personalityInterpretation: 'Curious, analytical, enjoys conversation and new information.', emotionalInterpretation: 'Processes feeling partly through talking and analyzing it.', relationshipInterpretation: 'Values intellectual connection and open communication.',
    strengths: ['Curiosity', 'Communication skill', 'Adaptability of thought'], challenges: ['May intellectualize feelings rather than simply experiencing them'],
    freeReading: 'Your hand shape reads as Air: a squarish palm with long fingers, traditionally linked to curiosity and communication.',
    premiumReading: 'An Air hand shape is traditionally read as intellectually curious and communicative, drawn to ideas and conversation. In work, this suits roles involving analysis, writing, or exchange of ideas; in relationships, connection often grows through conversation.',
    relatedFeatures: [], combinationRules: [], limitations: 'A traditional symbolic classification only, never a measure of intelligence, and classification is probabilistic, not a rigid box.' },
  { ...base, featureId: 'hand-shape-fire', featureName: 'Fire hand (rectangular/elongated palm, short-to-moderate fingers)',
    visualDescription: 'An elongated rectangular palm with fingers that are short to moderate relative to palm length.', detectionCriteria: 'Palm width-to-length ratio elongated, finger-to-palm length ratio on the shorter side, assessed qualitatively from the image.', confidenceThreshold: 0.45,
    traditionalMeaning: 'Traditionally associated with energy, enthusiasm, and a drive toward action.', personalityInterpretation: 'Energetic, enthusiastic, enjoys momentum and new initiatives.', emotionalInterpretation: 'Feelings show up visibly and quickly, with intensity.', relationshipInterpretation: 'Brings passion and spontaneity into a relationship.',
    strengths: ['Energy', 'Enthusiasm', 'Initiative'], challenges: ['Enthusiasm can outpace follow-through on sustained, less exciting tasks'],
    freeReading: 'Your hand shape reads as Fire: an elongated palm with shorter fingers, traditionally linked to energy and enthusiasm.',
    premiumReading: 'A Fire hand shape is traditionally read as energetic and action-oriented, drawn to momentum and new starts. In work, this suits roles with variety and visible impact; in relationships, warmth tends to show up as visible, spontaneous enthusiasm.',
    relatedFeatures: [], combinationRules: [], limitations: 'A traditional symbolic classification only, never a measure of personality disorder or any clinical trait, and classification is probabilistic, not a rigid box.' },
  { ...base, featureId: 'hand-shape-water', featureName: 'Water hand (elongated/oval palm, long fingers)',
    visualDescription: 'An elongated or oval palm with fingers that are notably long relative to palm length.', detectionCriteria: 'Palm width-to-length ratio elongated, finger-to-palm length ratio on the longer side, assessed qualitatively from the image.', confidenceThreshold: 0.45,
    traditionalMeaning: 'Traditionally associated with emotional depth, sensitivity, and imagination.', personalityInterpretation: 'Sensitive, intuitive, attuned to atmosphere and feeling.', emotionalInterpretation: 'Processes experience through feeling first.', relationshipInterpretation: 'Values emotional depth and attunement in closeness.',
    strengths: ['Empathy', 'Imagination', 'Emotional depth'], challenges: ['Sensitivity can tip into absorbing others\' moods without enough boundary'],
    freeReading: 'Your hand shape reads as Water: an elongated palm with long fingers, traditionally linked to emotional depth and sensitivity.',
    premiumReading: 'A Water hand shape is traditionally read as emotionally deep and intuitive, attuned closely to feeling and atmosphere. In work, this suits roles drawing on empathy or creativity; in relationships, connection tends to be felt vividly and valued highly.',
    relatedFeatures: [], combinationRules: [], limitations: 'A traditional symbolic classification only, never a diagnosis of sensitivity as a clinical trait, and classification is probabilistic, not a rigid box.' },
  { ...base, featureId: 'hand-shape-mixed-uncertain', featureName: 'Mixed or uncertain hand shape (does not clearly fit one elemental type)',
    visualDescription: 'Palm and finger proportions fall between the four classical types, or image angle/framing prevents a confident ratio measurement.', detectionCriteria: 'Proportions do not clearly favor one elemental type, or measurement confidence itself is too low to classify.', confidenceThreshold: 0.3,
    traditionalMeaning: 'Traditionally, many real hands blend more than one elemental quality rather than fitting one box neatly - this is read as a blend of traits rather than a forced single classification.', personalityInterpretation: 'Likely carries a blend of traits from more than one elemental type, worth reading alongside the specific line, mount, and finger observations rather than relying on hand shape alone.',
    emotionalInterpretation: 'Not confidently classifiable from shape alone in this case.', relationshipInterpretation: 'Not confidently classifiable from shape alone in this case.',
    strengths: ['Likely draws on strengths from more than one elemental type'], challenges: ['A single hand-shape label would oversimplify this particular hand'],
    freeReading: 'Your hand shape does not clearly fit one of the four classical types, which traditional practice reads as a genuine blend rather than a forced label.',
    premiumReading: 'Rather than force this hand into one of the four classical elemental types, this reading treats the proportions as a genuine blend, or as not confidently measurable from the submitted image, and leans more heavily on the specific line, mount, and finger findings elsewhere in this report.',
    relatedFeatures: [], combinationRules: [], limitations: 'An honest "uncertain" classification is always preferred over forcing a confident-sounding label onto ambiguous proportions.' },
];
