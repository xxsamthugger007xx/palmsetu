import { it, expect } from 'vitest';
import { tarotCatalogue } from './catalogue';
import { drawSpread } from './drawService';
import { spreadDefinitions } from './spreads';
it('deck', () => {
  expect(tarotCatalogue.length).toBe(78);
  expect(new Set(tarotCatalogue.map((c) => c.id)).size).toBe(78);
  expect(tarotCatalogue.filter((c) => c.arcana === 'major').length).toBe(22);
  for (const [id, def] of Object.entries(spreadDefinitions)) for (let i = 0; i < 200; i++) {
    const d = drawSpread(id as any);
    expect(d.length).toBe(def.cardCount);
    expect(new Set(d.map((x) => x.cardId)).size).toBe(def.cardCount);
    d.forEach((x, idx) => { expect(x.positionIndex).toBe(idx); expect(x.positionName).toBe(def.positions[idx].name); });
  }
});

import { buildStaticInterpretation } from './interpretationService';
it('every spread interprets every card in its own positions, and yes/no carries its own result', () => {
  for (const [id, def] of Object.entries(spreadDefinitions)) {
    for (const category of ['general', 'love', 'career', 'question'] as const) {
      const draws = drawSpread(id as any);
      const interp = buildStaticInterpretation(draws, category, id as any);
      expect(interp.cardInterpretations).toHaveLength(def.cardCount);
      expect(interp.overallInterpretation.length).toBeGreaterThan(20);
      if (def.cardCount > 1) expect(interp.overallInterpretation).toContain(def.title);
      if (id === 'yes-no') expect(interp.yesNo).toBeTruthy(); else expect(interp.yesNo).toBeUndefined();
    }
  }
});
