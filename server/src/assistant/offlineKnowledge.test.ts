import { describe, expect, it } from 'vitest';
import { answerWithoutAi } from './offlineKnowledge';

const ctx = { moonSign: 'Scorpio', localDate: '2026-11-26' };

describe('answerWithoutAi', () => {
  const cases: [string, RegExp][] = [
    ['hello', /Namaste|Hello/],
    ['I have a meeting at 4pm, how will it go?', /Scorpio|prepare|Prepare|Go in steady/i],
    ['will my interview go well', /Prepare|steady/i],
    ['my boyfriend and I keep fighting', /Relationships|heart|breakup|love/i],
    ['should I invest in shares', /financial advisor/i],
    ['should I quit my job', /career|Career|resume|stuck/i],
    ['I feel so anxious', /breathe|Breathe/i],
    ['tell me a joke', /\?|!|\./],
    ['12 * 7', /= 84/],
    ['born on 5/7', /Gemini/],
    ['numerology 14/03/1995', /life path number/],
    ['what does this dream mean, I was flying', /Dreams/],
    ['good time to start a business', /morning/],
    ['what is the capital of france', /astrology|guidance|situation/],
    ['how much is premium', /Premium/],
  ];
  for (const [q, re] of cases) {
    it(`answers: ${q}`, () => {
      const a = answerWithoutAi(q, ctx);
      expect(a.length).toBeGreaterThan(8);
      expect(a).toMatch(re);
    });
  }
  it('works without any profile', () => { expect(answerWithoutAi('will it rain tomorrow')).toBeTruthy(); });
});
