import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export interface PremiumCard {
  feature: string;
  title: string;
  description: string;
  ctaLabel: string;
  navigateTo: 'Paywall';
  deepLink?: { screen: string; params?: Record<string, unknown> };
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  detectedFeature?: string | null;
  premiumCard?: PremiumCard | null;
  createdAt: string;
}

export interface AssistantConversationSummary {
  id: string;
  updatedAt: string;
  createdAt: string;
  lastMessage: string | null;
  messageCount: number;
}

export interface AssistantConversation {
  id: string;
  userId: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  conversationId: string;
  reply: string;
  premiumCard: PremiumCard | null;
  suggestedFollowUps: string[];
  detectedFeature: string | null;
}

export const assistantApi = {
  getConfig: () => request<{ name: string; welcomeMessage: string }>('/assistant/config'),

  sendMessage: (conversationId: string | null, message: string, screenContext?: string | null) =>
    request<SendMessageResponse>('/assistant/message', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message, screenContext: screenContext ?? null }),
    }),

  listConversations: () => request<{ items: AssistantConversationSummary[] }>('/assistant/conversations'),

  getConversation: (id: string) => request<AssistantConversation>(`/assistant/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<{ ok: true }>(`/assistant/conversations/${id}`, { method: 'DELETE' }),

  getSuggestedQuestions: () => request<{ questions: string[] }>('/assistant/suggested-questions'),
};
