import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  X, Check, Crown, ScanLine, Layers, Heart, Moon, MessageCircle, Leaf, ChevronDown, RefreshCw,
} from 'lucide-react-native';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { billingApi } from '../../services/billingApi';
import { BillingPeriod, SubscriptionPlan } from '../../types/billing';

/**
 * No billing SDK (RevenueCat / StoreKit / Google Play Billing) is wired
 * into this app - see the implementation report delivered alongside this
 * screen for the exact App Store Connect / Google Play Console setup
 * required. This constant gates the CTA into an honest "not yet available"
 * state instead of ever faking a successful purchase. Flip only once a
 * real billing integration exists and can verify a purchase server-side.
 */
const BILLING_CONFIGURED = false;

type BenefitCategory = {
  key: string;
  icon: typeof ScanLine;
  title: string;
  tagline: string;
  points: string[];
};

// Every point below is grounded in a real, currently-enforced server-side
// entitlement check (server/src/tarot/entitlements.ts, palm.ts, gemstone.ts,
// vastu.ts, astrology.ts, wellness/entitlements.ts, assistant/entitlementCheck.ts) -
// not aspirational copy. Numbers match the real free-tier caps so nothing
// here overpromises. "AI-powered" is used only where a real AI call is
// involved; horoscope/kundli calculation itself is deterministic math, not AI.
const BENEFIT_CATEGORIES: BenefitCategory[] = [
  {
    key: 'palm',
    icon: ScanLine,
    title: 'Advanced Palm Reading',
    tagline: 'Go deeper than your first free report.',
    points: [
      'Unlimited detailed palm reports (free plan includes 1)',
      'Unlimited AI-powered follow-up questions per reading (free plan includes 2)',
      'Every detected line and feature unlocked, not just one at a time',
      'Full access to your saved report history',
    ],
  },
  {
    key: 'tarot',
    icon: Layers,
    title: 'Premium Tarot',
    tagline: 'Every spread, not just the one-card draw.',
    points: [
      'All premium spreads: Three-Card, Five-Card, Celtic Cross and more (free plan includes the One-Card draw)',
      'AI-powered detailed tarot reports for any reading',
      'Up to 20 AI follow-up questions per day',
      'Full saved reading history',
    ],
  },
  {
    key: 'compatibility',
    icon: Heart,
    title: 'Love & Compatibility',
    tagline: 'Readings built for two.',
    points: [
      'Relationship Compatibility and Love & Relationship tarot spreads',
      "Astrology compatibility for another person's chart",
      'Personalised relationship insights grounded in your saved profile',
    ],
  },
  {
    key: 'astrology',
    icon: Moon,
    title: 'Complete Astrology Library',
    tagline: 'Vedic and Western, taken further.',
    points: [
      'Unlimited birth-chart (Kundli) generations (free plan includes 1)',
      "Generate another person's chart for compatibility",
      'Full Vedic and Western system access',
    ],
  },
  {
    key: 'ai',
    icon: MessageCircle,
    title: 'Personalised AI Experience',
    tagline: 'More conversation, grounded in your own data.',
    points: [
      'Up to 200 AI Companion messages per day (free plan includes 15)',
      'Context-aware answers using your saved readings and profile',
      'AI-powered follow-ups across Tarot, Palm and Gemstone reports',
    ],
  },
  {
    key: 'wellness',
    icon: Leaf,
    title: 'Self-Discovery & Wellness',
    tagline: 'Room to actually build a practice.',
    points: [
      'Unlimited active habits (free plan includes 3)',
      'All breathing techniques and guided meditations unlocked',
      'All wellness challenges unlocked',
      'Full mood-history view (free plan shows the last 7 days)',
      'More AI journal insights per day (free plan includes 2)',
    ],
  },
];

const COMPARISON_ROWS: { label: string; free: string; premium: string }[] = [
  { label: 'Palm detailed reports', free: '1', premium: 'Unlimited' },
  { label: 'Tarot spreads', free: 'One-Card only', premium: 'All spreads' },
  { label: 'Tarot follow-up questions', free: 'Not included', premium: 'Up to 20/day' },
  { label: 'Birth-chart (Kundli) generations', free: '1', premium: 'Unlimited' },
  { label: 'Another person’s chart / compatibility', free: 'Not included', premium: 'Included' },
  { label: 'AI Companion messages', free: '15/day', premium: '200/day' },
  { label: 'Active wellness habits', free: '3', premium: 'Unlimited' },
  { label: 'Mood history', free: '7 days', premium: 'Full history' },
];

function formatRupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function periodSuffix(period: BillingPeriod): string {
  if (period === 'monthly') return '/month';
  if (period === 'quarterly') return '/3 months';
  return '/year';
}

function planCtaLabel(plan: SubscriptionPlan | undefined): string {
  if (!plan) return 'Unlock Palm Setu Premium';
  return `Continue with ${plan.label}, ${formatRupees(plan.priceCents)}`;
}

export function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selected, setSelected] = useState<BillingPeriod>('monthly');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    billingApi.trackFunnelEvent('SUBSCRIPTION_SCREEN_OPENED').catch(() => {});
    billingApi
      .getPlans()
      .then(({ plans: loaded }) => {
        setPlans(loaded);
        // Default selection is Monthly - only overridden here if, for some
        // reason, the backend didn't return a monthly plan at all.
        if (!loaded.some((p) => p.id === 'monthly') && loaded[0]) setSelected(loaded[0].id);
      })
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === selected);

  const handleSelectPlan = (planId: BillingPeriod) => {
    if (planId === selected) return;
    Haptics.selectionAsync().catch(() => {});
    setSelected(planId);
    billingApi.trackFunnelEvent('SUBSCRIPTION_PLAN_SELECTED', planId).catch(() => {});
  };

  const handleToggleExpand = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    billingApi.trackFunnelEvent('CHECKOUT_INITIATED', selectedPlan.id).catch(() => {});
    if (!BILLING_CONFIGURED) {
      setCheckoutState('failed');
      return;
    }
    setCheckoutState('pending');
    // Real purchase flow would be invoked here (RevenueCat.purchasePackage /
    // native StoreKit / Play Billing) - intentionally not implemented, see
    // the implementation report for exactly what's required before this
    // branch can ever run.
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[tarotColor.indigo, tarotColor.violet, tarotColor.midnight]} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <View style={{ width: 36 }} />
            <IconButton icon={X} onPress={() => navigation.goBack()} tone={color.textPrimary} />
          </View>

          {/* --- Hero --------------------------------------------------- */}
          <View style={styles.hero}>
            <View style={styles.crownBadge}>
              <Crown size={22} color={tarotColor.gold} strokeWidth={1.75} />
            </View>
            <Text variant="display" weight="semibold" style={styles.heroTitle}>
              Unlock Your Complete Self-Discovery Journey
            </Text>
            <Text variant="bodySm" tone="secondary" style={styles.heroSubtitle}>
              Discover deeper insights into your palm, relationships, astrology and personal journey with Palm Setu Premium.
            </Text>
          </View>

          {/* --- Benefit categories -------------------------------------- */}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>Everything Included in Premium</Text>
          <View style={{ paddingHorizontal: spacing.lg }}>
            {BENEFIT_CATEGORIES.map((cat) => {
              const isExpanded = expandedKey === cat.key;
              const Icon = cat.icon;
              return (
                <Pressable key={cat.key} onPress={() => handleToggleExpand(cat.key)} style={styles.benefitCard}>
                  <View style={styles.benefitHeaderRow}>
                    <View style={styles.benefitIconWrap}>
                      <Icon size={18} color={tarotColor.gold} strokeWidth={1.75} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text variant="bodySm" weight="semibold">{cat.title}</Text>
                      <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>{cat.tagline}</Text>
                    </View>
                    <ChevronDown
                      size={16}
                      color={color.textSecondary}
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  </View>
                  {isExpanded && (
                    <View style={styles.benefitPoints}>
                      {cat.points.map((point) => (
                        <View key={point} style={styles.benefitPointRow}>
                          <Check size={13} color={tarotColor.lavender} strokeWidth={2.5} style={{ marginTop: 2 }} />
                          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.xs, flex: 1 }}>{point}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* --- Free vs Premium comparison -------------------------------- */}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>Free vs Premium</Text>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeaderRow}>
              <Text variant="caption" tone="muted" style={{ flex: 1.6 }}> </Text>
              <Text variant="caption" tone="secondary" weight="semibold" style={styles.comparisonCol}>Free</Text>
              <Text variant="caption" style={[styles.comparisonCol, { color: tarotColor.gold }]} weight="semibold">Premium</Text>
            </View>
            {COMPARISON_ROWS.map((row) => (
              <View key={row.label} style={styles.comparisonRow}>
                <Text variant="caption" tone="secondary" style={{ flex: 1.6 }}>{row.label}</Text>
                <Text variant="caption" tone="muted" style={styles.comparisonCol}>{row.free}</Text>
                <Text variant="caption" weight="semibold" style={[styles.comparisonCol, { color: tarotColor.gold }]}>{row.premium}</Text>
              </View>
            ))}
          </View>

          {/* --- Plan selector -------------------------------------------- */}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>Choose Your Plan</Text>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {plans.length === 0 && (
              <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.md }}>Loading plans...</Text>
            )}
            {plans.map((plan) => {
              const isSelected = plan.id === selected;
              return (
                <Pressable key={plan.id} onPress={() => handleSelectPlan(plan.id)} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
                  <View style={[styles.planCard, isSelected && styles.planCardSelected]}>
                    {plan.badge && (
                      <View style={[styles.planBadge, plan.badge === 'BEST_VALUE' ? styles.badgeGold : styles.badgeLavender]}>
                        <Text variant="caption" weight="semibold" style={{ color: plan.badge === 'BEST_VALUE' ? tarotColor.midnight : tarotColor.midnight, fontSize: 10 }}>
                          {plan.badge === 'BEST_VALUE' ? 'BEST VALUE' : 'POPULAR CHOICE'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.planRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySm" weight="semibold">{plan.label}</Text>
                        <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                          {formatRupees(plan.effectiveMonthlyCents)}/month equivalent
                        </Text>
                        {plan.savingsPercentVsMonthly > 0 && (
                          <Text variant="caption" style={{ color: color.success, marginTop: 2 }} weight="semibold">
                            Save {plan.savingsPercentVsMonthly}%
                          </Text>
                        )}
                      </View>
                      <View style={styles.planRight}>
                        <Text variant="subtitle" weight="semibold">{formatRupees(plan.priceCents)}</Text>
                        <Text variant="caption" tone="muted">{periodSuffix(plan.billingPeriod)}</Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <Check size={12} color={tarotColor.midnight} strokeWidth={3} />}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!BILLING_CONFIGURED && (
            <View style={styles.configNotice}>
              <Text variant="caption" style={{ color: color.warning }}>
                Billing is not yet configured for Palm Setu Premium (no RevenueCat, StoreKit or Google Play
                Billing integration exists yet). This screen will never charge you or grant Premium access.
              </Text>
            </View>
          )}

          {checkoutState === 'failed' && (
            <View style={styles.configNotice}>
              <Text variant="caption" style={{ color: color.danger }}>
                Purchases aren't available yet in this build. Nothing was charged.
              </Text>
            </View>
          )}

          <Pressable onPress={() => {}} style={styles.restoreRow}>
            <RefreshCw size={14} color={color.textSecondary} strokeWidth={1.75} />
            <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.xs }}>Restore Purchases</Text>
          </Pressable>

          <Text variant="caption" tone="muted" style={styles.legal}>
            Subscriptions renew automatically unless cancelled at least 24 hours before the end of the
            current period. Manage or cancel anytime in your App Store or Play Store account settings.{' '}
            <Text variant="caption" tone="accent">Terms</Text> · <Text variant="caption" tone="accent">Privacy</Text>
          </Text>
        </Animated.View>
      </ScrollView>

      {/* --- Sticky bottom CTA ------------------------------------------- */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <LinearGradient colors={['rgba(18,16,31,0)', tarotColor.midnight]} style={styles.ctaFade} pointerEvents="none" />
        <Pressable
          onPress={handleCheckout}
          disabled={checkoutState === 'pending' || !selectedPlan}
          style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.9 }]}
        >
          <Text variant="bodySm" weight="semibold" style={{ color: tarotColor.midnight }}>
            {checkoutState === 'pending' ? 'Processing...' : planCtaLabel(selectedPlan)}
          </Text>
        </Pressable>
        <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.xs }}>
          Secure billing through your App Store or Google Play account.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tarotColor.midnight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  crownBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(217, 184, 114, 0.14)',
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  benefitCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  benefitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217, 184, 114, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitPoints: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  benefitPointRow: {
    flexDirection: 'row',
  },
  comparisonCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  comparisonCol: {
    flex: 1,
    textAlign: 'right',
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    padding: spacing.md,
    position: 'relative',
    overflow: 'visible',
  },
  planCardSelected: {
    borderColor: tarotColor.gold,
    backgroundColor: 'rgba(217, 184, 114, 0.08)',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeGold: { backgroundColor: tarotColor.gold },
  badgeLavender: { backgroundColor: tarotColor.lavender },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planRight: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: tarotColor.gold,
    borderColor: tarotColor.gold,
  },
  configNotice: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217, 168, 87, 0.1)',
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  legal: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    textAlign: 'center',
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    // Solid backing behind the button/trust text - the gradient below is
    // only a short fade at the very top edge of this bar, so it must not
    // be the only thing standing between the CTA and the scrolled content
    // underneath (that let page content bleed through visibly behind the
    // button in testing).
    backgroundColor: tarotColor.midnight,
  },
  ctaFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -36,
    height: 36,
  },
  ctaButton: {
    backgroundColor: tarotColor.gold,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
