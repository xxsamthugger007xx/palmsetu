import { CombinedInterpretation, MatchedFeature } from '../types/palm';

/**
 * Deterministic combination rule engine (section 11 of the original ask).
 * Pure/deterministic, no AI call anywhere in this file. Each rule declares
 * the feature_ids it needs (each with its own minimum confidence) and
 * produces one combined interpretation string that adds something beyond
 * what the individual feature entries already said, without contradicting
 * them.
 */

export interface CombinationRule {
  ruleId: string;
  title: string;
  requires: { featureId: string; minConfidence: number }[];
  interpret: () => string;
}

export const COMBINATION_RULES: CombinationRule[] = [
  {
    ruleId: 'curved-deep-heart-line',
    title: 'Curved, deep heart line',
    requires: [
      { featureId: 'heart-line-curved', minConfidence: 0.6 },
      { featureId: 'heart-line-deep', minConfidence: 0.6 },
    ],
    interpret: () =>
      'Together, a curved and deep heart line are traditionally read as warmth that is both openly expressed and steadily held: feeling shown visibly, and feeling that, once formed, tends to last. This combination amplifies rather than duplicates either trait alone.',
  },
  {
    ruleId: 'straight-long-head-line',
    title: 'Straight, long head line',
    requires: [
      { featureId: 'head-line-straight', minConfidence: 0.6 },
      { featureId: 'head-line-long', minConfidence: 0.6 },
    ],
    interpret: () =>
      'A straight and long head line together are traditionally read as a mind that is both thorough and grounded: one that covers a problem fully while staying anchored in practical reality, rather than drifting into speculation.',
  },
  {
    ruleId: 'life-line-with-sister-line',
    title: 'Life line reinforced by a sister line',
    requires: [
      { featureId: 'life-line-sister-line', minConfidence: 0.45 },
    ],
    interpret: () =>
      'A sister line running alongside the life line is traditionally read as reinforcement to vitality during that stretch of life, and when read together with the life line\'s own depth and arc, the combination points to resilience that is actively supported, not only self-generated.',
  },
  {
    ruleId: 'fate-line-from-life-line-combo',
    title: 'Fate line rooted in the life line',
    requires: [
      { featureId: 'fate-line-starts-from-life-line', minConfidence: 0.45 },
    ],
    interpret: () =>
      'A fate line beginning from within the life line is traditionally read as a direction shaped substantially by family and early close relationships; read alongside the life line\'s own vitality markers, this suggests a path and an energy that grew up together, closely intertwined from early on.',
  },
  {
    ruleId: 'strong-sun-line-prominent-apollo',
    title: 'Strong Sun line with a prominent Apollo mount',
    requires: [
      { featureId: 'minor-sun-line', minConfidence: 0.45 },
      { featureId: 'mount-apollo', minConfidence: 0.5 },
    ],
    interpret: () =>
      'A clear sun line paired with a prominent Apollo mount is traditionally read as one of the more reinforcing combinations in palmistry: both independently point toward creative fulfillment and recognition, and together they strengthen that reading rather than simply repeating it, suggesting creative expression that is both internally motivated (the mount) and actively pursued (the line).',
  },
  {
    ruleId: 'prominent-jupiter-long-index',
    title: 'Prominent Jupiter mount with a long index finger',
    requires: [
      { featureId: 'mount-jupiter', minConfidence: 0.5 },
      { featureId: 'finger-index-long', minConfidence: 0.5 },
    ],
    interpret: () =>
      'A prominent Jupiter mount together with a long index finger is a classic traditional pairing read as a strong, well-integrated leadership inclination: the mount suggests the underlying drive, and the finger length suggests that drive has a natural outlet, together pointing to someone comfortable stepping into a guiding role.',
  },
  {
    ruleId: 'broken-fate-line-multiple-lines',
    title: 'Broken fate line with multiple fate lines present',
    requires: [
      { featureId: 'fate-line-break', minConfidence: 0.4 },
      { featureId: 'fate-line-multiple-lines', minConfidence: 0.4 },
    ],
    interpret: () =>
      'A break in the fate line occurring alongside multiple distinct fate lines is traditionally read as a deliberate, constructive pivot rather than simple disruption: the break marks the turning point, and the second line marks the new direction actively taken up afterward, read together as a resilient reinvention rather than two separate difficulties.',
  },
  {
    ruleId: 'heart-head-balance',
    title: 'Curved heart line with a straight head line',
    requires: [
      { featureId: 'heart-line-curved', minConfidence: 0.6 },
      { featureId: 'head-line-straight', minConfidence: 0.6 },
    ],
    interpret: () =>
      'A curved heart line alongside a straight head line is traditionally read as a pairing of openly expressed feeling with grounded, practical thinking: warmth that is shown readily, steadied by a mind that tends to stay anchored in realistic terms rather than getting swept along by it.',
  },
  {
    ruleId: 'head-life-independence',
    title: 'Head line separated from the life line, with a wide-arc life line',
    requires: [
      { featureId: 'head-line-separated-at-start-with-life-line', minConfidence: 0.5 },
      { featureId: 'life-line-wide-arc', minConfidence: 0.5 },
    ],
    interpret: () =>
      'A head line that starts clearly apart from the life line, read together with a life line that curves out in a wide arc, is traditionally read as independence of thought paired with an outward-facing confidence: a tendency to form one\'s own views and to move through the world without staying close to a cautious, narrow path.',
  },
  {
    ruleId: 'life-fate-direction',
    title: 'Deep life line with a fate line ending under Saturn',
    requires: [
      { featureId: 'life-line-deep', minConfidence: 0.5 },
      { featureId: 'fate-line-ends-under-saturn', minConfidence: 0.45 },
    ],
    interpret: () =>
      'A deep, clearly etched life line together with a fate line reaching its traditional full-length endpoint under the Saturn mount is traditionally read as sustained vitality in service of a steady, consistently pursued direction, rather than either trait sitting on its own.',
  },
  {
    ruleId: 'fate-sun-fulfillment',
    title: 'Fate line curving toward Apollo with a sun line present',
    requires: [
      { featureId: 'fate-line-ends-under-apollo', minConfidence: 0.45 },
      { featureId: 'minor-sun-line', minConfidence: 0.45 },
    ],
    interpret: () =>
      'A fate line that curves to end under the Apollo mount, read alongside a present sun line, is traditionally read as a reinforcing pair: a life direction that bends toward creative or publicly recognized work, together with the separate marker traditionally linked to fulfillment through that same kind of expression.',
  },
  {
    ruleId: 'heart-venus-warmth',
    title: 'Curved heart line with a developed Mount of Venus',
    requires: [
      { featureId: 'heart-line-curved', minConfidence: 0.6 },
      { featureId: 'mount-venus', minConfidence: 0.5 },
    ],
    interpret: () =>
      'A curved heart line together with a well-developed Mount of Venus is traditionally read as emotional warmth that is matched by genuine physical and relational vitality: feeling that is not only shown but also energetically backed, read as reinforcing rather than restating either trait alone.',
  },
  {
    ruleId: 'head-moon-imagination',
    title: 'Steeply sloping head line with a developed Mount of Moon',
    requires: [
      { featureId: 'head-line-slopes-steeply', minConfidence: 0.5 },
      { featureId: 'mount-moon', minConfidence: 0.5 },
    ],
    interpret: () =>
      'A head line that slopes steeply toward the wrist, read together with a developed Mount of Moon, is traditionally read as an imaginative, intuitive thinking style with a strong underlying wellspring to draw on: the line suggests the inclination, and the mount suggests the depth of inner resource behind it.',
  },
  {
    ruleId: 'multiple-prominent-mounts',
    title: 'Jupiter, Apollo and Mercury mounts all prominent',
    requires: [
      { featureId: 'mount-jupiter', minConfidence: 0.5 },
      { featureId: 'mount-apollo', minConfidence: 0.5 },
      { featureId: 'mount-mercury', minConfidence: 0.5 },
    ],
    interpret: () =>
      'Having the Jupiter, Apollo and Mercury mounts all read as prominent together is traditionally uncommon enough to note on its own: leadership inclination, creative drive, and communicative ease all registering strongly at once, traditionally read as a well-rounded profile rather than any single trait dominating.',
  },
  {
    ruleId: 'contrasting-heart-line-reach-expression',
    title: 'Long heart line that is also faintly etched (contrasting signals)',
    requires: [
      { featureId: 'heart-line-long', minConfidence: 0.6 },
      { featureId: 'heart-line-faint', minConfidence: 0.6 },
    ],
    interpret: () =>
      'A heart line that is both long and faintly etched carries two signals that traditionally pull in different directions: emotional reach that extends widely, but expressed tentatively rather than boldly. Traditional practice reads this as a genuine contrast worth sitting with rather than resolving into a single tidy trait - a generosity that may not always be visible from the outside.',
  },
];

/**
 * Evaluates every rule against the matched features from this analysis.
 * matchedFeatures must come from verified observations only (detected:true,
 * confidence above the per-feature threshold) - this function does not
 * re-check detection, it trusts its caller to have already filtered.
 */
export function evaluateCombinationRules(matchedFeatures: MatchedFeature[]): CombinedInterpretation[] {
  const confidenceById = new Map(matchedFeatures.map((m) => [m.featureId, m.confidence]));
  const results: CombinedInterpretation[] = [];

  for (const rule of COMBINATION_RULES) {
    const satisfied = rule.requires.every((req) => {
      const conf = confidenceById.get(req.featureId);
      return conf !== undefined && conf >= req.minConfidence;
    });
    if (!satisfied) continue;

    results.push({
      ruleId: rule.ruleId,
      title: rule.title,
      text: rule.interpret(),
      involvedFeatureIds: rule.requires.map((r) => r.featureId),
    });
  }

  return results;
}
