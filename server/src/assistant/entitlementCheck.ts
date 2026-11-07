import { getUserTier, AssistantFeature } from '../data/store';
import { UserFeatureData } from './dataRetrieval';

/**
 * Entitlement logic for the assistant, mirroring the REAL premium gates
 * already implemented in each feature's own route file - never a guess:
 *  - tarot: reading.detailedReportStatus - 'ready' only after a premium user
 *    has called POST /tarot/readings/:id/detailed-report (see routes/tarot.ts).
 *  - gemstone: free plan gets 1 report (MAX_REPORTS_FREE in routes/gemstone.ts);
 *    a premium user can have additional reports.
 *  - vastu: free plan gets 1 property/report (MAX_PROPERTIES_FREE in
 *    routes/vastu.ts); same shape as gemstone.
 *  - astrology: no premium gate exists in routes/astrology.ts today (only a
 *    free-tier follow-up question cap) - treated as free-only for the chat,
 *    never shown a premium card for it.
 *  - palm: no premium gate exists in routes/palm.ts today - treated as
 *    free-only, same as astrology.
 */
export interface PremiumCard {
  feature: AssistantFeature;
  title: string;
  description: string;
  ctaLabel: string;
  navigateTo: 'Paywall';
  deepLink?: { screen: string; params?: Record<string, unknown> };
}

export interface EntitlementResult {
  hasPremiumUpsell: boolean;
  premiumCard: PremiumCard | null;
}

export function evaluateEntitlement(
  userId: string,
  feature: AssistantFeature,
  data: UserFeatureData,
  premiumRecommendationCopy: string,
): EntitlementResult {
  const tier = getUserTier(userId);
  if (tier === 'premium') return { hasPremiumUpsell: false, premiumCard: null };

  if (feature === 'tarot' && data.tarot && data.tarot.detailedReportStatus !== 'ready') {
    return {
      hasPremiumUpsell: true,
      premiumCard: {
        feature: 'tarot',
        title: 'Unlock your detailed tarot report',
        description: premiumRecommendationCopy,
        ctaLabel: 'Upgrade to Premium',
        navigateTo: 'Paywall',
        deepLink: { screen: 'TarotReport', params: { readingId: data.tarot.id } },
      },
    };
  }

  if (feature === 'gemstone' && data.gemstone) {
    return {
      hasPremiumUpsell: true,
      premiumCard: {
        feature: 'gemstone',
        title: 'Get additional gemstone reports',
        description: premiumRecommendationCopy,
        ctaLabel: 'Upgrade to Premium',
        navigateTo: 'Paywall',
        deepLink: { screen: 'GemstoneReport', params: { reportId: data.gemstone.id } },
      },
    };
  }

  if (feature === 'vastu' && data.vastu) {
    return {
      hasPremiumUpsell: true,
      premiumCard: {
        feature: 'vastu',
        title: 'Analyze additional properties',
        description: premiumRecommendationCopy,
        ctaLabel: 'Upgrade to Premium',
        navigateTo: 'Paywall',
        deepLink: { screen: 'VastuReport', params: { reportId: data.vastu.id } },
      },
    };
  }

  // astrology, palm: no premium gate exists in this app today - free-only, no upsell.
  return { hasPremiumUpsell: false, premiumCard: null };
}
