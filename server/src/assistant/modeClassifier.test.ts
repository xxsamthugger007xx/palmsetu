import { describe, it, expect } from 'vitest';
import { classifyMode, generationOptionsForMode } from './modeClassifier';

describe('classifyMode', () => {
  it('defaults to fast for ordinary short questions', () => {
    expect(classifyMode('What does my tarot card mean?', false)).toBe('fast');
    expect(classifyMode('Explain my moon sign', false)).toBe('fast');
  });

  it('classifies deep-analysis keywords correctly', () => {
    expect(classifyMode('Can you give me a detailed career analysis using my chart?', false)).toBe('deep_analysis');
    expect(classifyMode('I want a comprehensive dasha analysis please', false)).toBe('deep_analysis');
    expect(classifyMode('Please compare my vedic and western placements in depth', false)).toBe('deep_analysis');
  });

  it('classifies a long multi-clause question as deep analysis even without keywords', () => {
    const longMessage = 'I have been thinking about my career, my relationships, my finances, and my overall '
      + 'direction in life lately, and I was wondering if you could help me understand how all of these different '
      + 'areas connect to each other based on what is available in my profile right now please.';
    expect(longMessage.length).toBeGreaterThan(220);
    expect(classifyMode(longMessage, false)).toBe('deep_analysis');
  });

  it('classifies premium_report only when both the keyword and an active upsell are present', () => {
    expect(classifyMode('Can I get the full report unlocked?', true)).toBe('premium_report');
    // Same phrasing but no active premium upsell for this user/feature -
    // never claim a premium_report mode that has nothing to upsell.
    expect(classifyMode('Can I get the full report unlocked?', false)).toBe('fast');
  });

  it('defaults to fast when uncertain, per the task requirement', () => {
    expect(classifyMode('hi', false)).toBe('fast');
    expect(classifyMode('thanks!', false)).toBe('fast');
  });
});

describe('generationOptionsForMode', () => {
  it('gives deep_analysis more reasoning budget and output room than fast', () => {
    const fast = generationOptionsForMode('fast');
    const deep = generationOptionsForMode('deep_analysis');
    expect(deep.maxOutputTokens!).toBeGreaterThan(fast.maxOutputTokens!);
    expect(fast.thinkingLevel).toBe('low');
    expect(deep.thinkingLevel).toBe('high');
  });

  it('keeps premium_report on the same fast/concise config as fast, since it never generates locked content', () => {
    expect(generationOptionsForMode('premium_report')).toEqual(generationOptionsForMode('fast'));
  });
});
