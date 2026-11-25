/**
 * In-memory config for the centralized AI assistant (see server/src/assistant).
 * Same prototype caveat as every other store in this app: lost on restart,
 * not shared across instances. Editable live via GET/PUT /admin/assistant-config
 * (super_admin only for PUT) so the assistant's name/voice/copy can change
 * without a redeploy. The chat system prompt and the app's welcome text both
 * read from this object - never a hardcoded string.
 */
export interface AssistantConfig {
  name: string;
  welcomeMessage: string;
  systemInstructions: string;
  enabledFeatures: {
    tarot: boolean;
    astrology: boolean;
    gemstone: boolean;
    vastu: boolean;
    palm: boolean;
  };
  premiumRecommendationCopy: string;
  updatedAt: string;
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  name: 'AI Astrologer',
  welcomeMessage:
    "Hi, I'm your Palm Setu AI Astrologer. Ask me about your tarot readings, birth chart, gemstone, vastu report or palm reading, and I will pull up what you actually have on file. You can ask me about anything else too.",
  systemInstructions:
    'Be warm and helpful. For their own readings, stay strictly grounded in the data provided to you and never invent chart, card, palm, or numeric details. For everything else, answer from general knowledge.',
  enabledFeatures: {
    tarot: true,
    astrology: true,
    gemstone: true,
    vastu: true,
    palm: true,
  },
  premiumRecommendationCopy: 'Unlock a deeper, AI-personalized reading with Palm Setu Premium.',
  updatedAt: new Date().toISOString(),
};

export let assistantConfig: AssistantConfig = { ...DEFAULT_ASSISTANT_CONFIG };

export function setAssistantConfig(next: Partial<AssistantConfig>): AssistantConfig {
  assistantConfig = {
    ...assistantConfig,
    ...next,
    enabledFeatures: { ...assistantConfig.enabledFeatures, ...(next.enabledFeatures ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  return assistantConfig;
}
