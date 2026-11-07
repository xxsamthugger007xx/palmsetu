import { SpreadDefinition, SpreadType } from '../types/tarot';

export const spreadDefinitions: Record<SpreadType, SpreadDefinition> = {
  'one-card': {
    id: 'one-card', title: 'One-Card Draw', cardCount: 1, premium: false, available: true,
    description: 'A single card for quick, focused reflection.',
    positions: [{ index: 0, name: 'The Card', description: 'A focused reflection on your question or current moment.' }],
  },
  'three-card-ppf': {
    id: 'three-card-ppf', title: 'Past / Present / Future', cardCount: 3, premium: true, available: true,
    description: 'Three cards tracing how a situation has moved and where it may be heading.',
    positions: [
      { index: 0, name: 'Past', description: 'What has shaped this situation so far.' },
      { index: 1, name: 'Present', description: 'Where things stand right now.' },
      { index: 2, name: 'Future', description: 'A traditional reflection on where this may be heading - not a fixed outcome.' },
    ],
  },
  'three-card-scg': {
    id: 'three-card-scg', title: 'Situation / Challenge / Guidance', cardCount: 3, premium: true, available: true,
    description: 'Three cards framing a situation, its central challenge, and a path through it.',
    positions: [
      { index: 0, name: 'Situation', description: 'The heart of what’s going on.' },
      { index: 1, name: 'Challenge', description: 'What’s making this harder.' },
      { index: 2, name: 'Guidance', description: 'A traditional reflection on how to approach it.' },
    ],
  },
  'three-card-mbs': {
    id: 'three-card-mbs', title: 'Mind / Body / Spirit', cardCount: 3, premium: true, available: true,
    description: 'Three cards for personal reflection across mind, body and spirit - not medical advice.',
    positions: [
      { index: 0, name: 'Mind', description: 'What’s occupying your thoughts.' },
      { index: 1, name: 'Body', description: 'A reflective prompt about your energy and habits - not a health assessment.' },
      { index: 2, name: 'Spirit', description: 'What might nourish you on a deeper level right now.' },
    ],
  },
  'celtic-cross': {
    id: 'celtic-cross', title: 'Celtic Cross', cardCount: 10, premium: true, available: true,
    description: 'A ten-card in-depth spread tracing the full shape of a situation.',
    positions: [
      { index: 0, name: 'Present', description: 'The heart of the matter.' },
      { index: 1, name: 'Challenge', description: 'What crosses or complicates it.' },
      { index: 2, name: 'Foundation', description: 'What this situation is built on.' },
      { index: 3, name: 'Recent Past', description: 'What is now receding.' },
      { index: 4, name: 'Possible Outcome', description: 'A traditional reflection on where this may lead.' },
      { index: 5, name: 'Near Future', description: 'What is approaching next.' },
      { index: 6, name: 'Your Approach', description: 'How you’re meeting this.' },
      { index: 7, name: 'External Influences', description: 'What around you is shaping this.' },
      { index: 8, name: 'Hopes & Fears', description: 'What you’re holding inside about it.' },
      { index: 9, name: 'Outcome', description: 'A traditional overall reflection - not a guaranteed result.' },
    ],
  },
  'love-relationship': {
    id: 'love-relationship', title: 'Love & Relationship Reading', cardCount: 5, premium: true, available: true,
    description: 'A five-card spread for current or new relationships, compatibility, challenges, or your personal love life and self-love - shaped by the question or context you bring to it.',
    positions: [
      { index: 0, name: 'You', description: 'Where you stand emotionally right now in this area of love.' },
      { index: 1, name: 'The Other Person / What You Seek', description: 'The other person in the relationship, or what you are drawn toward if there is no one specific yet.' },
      { index: 2, name: 'The Connection', description: 'The nature of the bond or dynamic between you - or within yourself, for a self-love reading.' },
      { index: 3, name: 'Challenge', description: 'What is making this harder right now.' },
      { index: 4, name: 'Potential', description: 'A traditional reflection on where this may be heading - not a fixed outcome.' },
    ],
  },
  'career-finance': {
    id: 'career-finance', title: 'Career & Finance Reading', cardCount: 3, premium: true, available: true,
    description: 'Three cards reflecting on your current work or financial situation, what stands in the way, and a path forward.',
    positions: [
      { index: 0, name: 'Current Situation', description: 'Where things stand in your work or finances right now.' },
      { index: 1, name: 'Obstacle', description: 'What is getting in the way of progress.' },
      { index: 2, name: 'Guidance', description: 'A traditional reflection on how to move forward - not financial advice.' },
    ],
  },
  'yes-no': {
    id: 'yes-no', title: 'Yes / No Reading', cardCount: 1, premium: false, available: true,
    description: 'A single card read for a traditional yes/no leaning on a clear, specific question - a quick directional reflection, not a certainty.',
    positions: [
      { index: 0, name: 'The Card', description: 'The single card whose traditional nature and orientation shapes the yes/no leaning.' },
    ],
  },
  'relationship-compatibility': {
    id: 'relationship-compatibility', title: 'Relationship Compatibility Reading', cardCount: 4, premium: true, available: true,
    description: 'A four-card comparative spread for how you and another person relate - what connects you and what challenges you.',
    positions: [
      { index: 0, name: 'You', description: 'What you bring to this relationship.' },
      { index: 1, name: 'Them', description: 'What the other person brings to this relationship, as traditionally reflected by the card, not a reading of their literal thoughts.' },
      { index: 2, name: 'What Connects You', description: 'The traditional common ground or bond between you.' },
      { index: 3, name: 'What Challenges You', description: 'Where friction or difference between you shows up.' },
    ],
  },
};

export function getSpread(id: SpreadType): SpreadDefinition {
  const spread = spreadDefinitions[id];
  if (!spread) throw new Error(`Unknown spread: ${id}`);
  return spread;
}

export function listAvailableSpreads(): SpreadDefinition[] {
  return Object.values(spreadDefinitions);
}
