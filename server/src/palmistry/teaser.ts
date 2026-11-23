import type { PalmReading } from '../types/palm';

const MAX_TEASER_CHARS = 70;

/** The opening of a free-reading observation: the first sentence, cut at a word boundary so it fits on roughly one
 * line. Locked sections only ever send this to the client (the rest is what "unlocking" is for), so the full text
 * cannot be read out of the network response either. */
export function teaserText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const firstSentence = flat.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? flat;
  const base = firstSentence.replace(/[.!?]+$/, '');
  if (base.length <= MAX_TEASER_CHARS) return base;
  const cut = base.slice(0, MAX_TEASER_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\\-\\s]+$/, '');
}

/** A copy of the reading that is safe to send to its owner. Text the owner has not unlocked is reduced to a teaser:
 * - each locked section's observation, and
 * - the overall summary and the "combined patterns", until EVERY detected section is unlocked (the same rule as the
 *   app's "complete reading unlocked").
 * A reading with a generated premium report (legacy whole-report purchase) has everything unlocked. */
export function redactLockedSections(reading: PalmReading, unlocked: Set<string>): PalmReading {
  if (reading.premiumReport) return reading;
  const keys = reading.freeReading.sections.map((s) => s.sectionKey).filter((k): k is NonNullable<typeof k> => !!k);
  const everythingUnlocked = keys.length > 0 && keys.every((k) => unlocked.has(k));
  return {
    ...reading,
    freeReading: {
      ...reading.freeReading,
      summary: everythingUnlocked ? reading.freeReading.summary : teaserText(reading.freeReading.summary),
      summaryTruncated: !everythingUnlocked,
      combinedInterpretations: (reading.freeReading.combinedInterpretations ?? []).map((c) =>
        everythingUnlocked ? c : { ...c, text: teaserText(c.text), textTruncated: true },
      ),
      sections: reading.freeReading.sections.map((s) =>
        s.sectionKey && unlocked.has(s.sectionKey) ? s : { ...s, text: teaserText(s.text), textTruncated: true },
      ),
    },
  };
}
