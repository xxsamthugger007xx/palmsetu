import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, Crown, RefreshCw, Tag, Check } from 'lucide-react-native';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { VerifyEmailCard } from '../../components/VerifyEmailCard';
import { ErrorState } from '../../components/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { billingApi } from '../../services/billingApi';
import { isBillingConfigured, getPackagesByPlan, purchasePlan, restorePurchases } from '../../services/purchases';
import { BillingPeriod, CouponValidation, SubscriptionPlan } from '../../types/billing';
import { PurchasesPackage } from 'react-native-purchases';
import { BenefitsList } from './BenefitsList';
import { ComparisonTable } from './ComparisonTable';
import { ReportSampleCard } from '../../components/ReportSampleCard';
import { PlanCards } from './PlanCards';
import { planCtaLabel } from './paywallData';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
export function PaywallScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { isGuest, account } = useAuth();
  const emailUnverified = !isGuest && !!account && !account.emailVerified;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansError, setPlansError] = useState(false);
  const [selected, setSelected] = useState<BillingPeriod>('monthly');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [checkoutErrorText, setCheckoutErrorText] = useState<string | null>(null);
  const [packagesByPlan, setPackagesByPlan] = useState<Record<string, PurchasesPackage>>({});
  const [restoring, setRestoring] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const billingReady = isBillingConfigured();

  const loadPlans = useCallback(() => {
    setPlansError(false);
    billingApi
      .getPlans()
      .then(({ plans: loaded }) => {
        setPlans(loaded);
        // Default selection is Monthly - only overridden here if, for some
        // reason, the backend didn't return a monthly plan at all.
        // Lead with the best-value plan; fall back to whatever exists.
        const best = loaded.find((p) => p.badge === 'BEST_VALUE') ?? loaded.find((p) => p.id === 'annual') ?? loaded[0];
        if (best) setSelected(best.id);
      })
      .catch(() => setPlansError(true));
  }, []);

  useEffect(() => {
    loadPlans();
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    billingApi.trackFunnelEvent('SUBSCRIPTION_SCREEN_OPENED').catch(() => {});
    if (billingReady) {
      getPackagesByPlan().then(setPackagesByPlan).catch(() => {});
    }
  }, []);

  const selectedPlan = plans.find((p) => p.id === selected);

  const handleSelectPlan = (planId: BillingPeriod) => {
    if (planId === selected) return;
    Haptics.selectionAsync().catch(() => {});
    setSelected(planId);
    billingApi.trackFunnelEvent('SUBSCRIPTION_PLAN_SELECTED', planId).catch(() => {});
    // A coupon's eligibility can be plan-specific - clear any applied
    // result rather than silently keep showing a discount that may no
    // longer apply to the newly-selected plan.
    setCouponResult(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !selected) return;
    setCouponChecking(true);
    try {
      const result = await billingApi.validateCoupon(couponInput.trim(), selected);
      setCouponResult(result);
    } catch {
      setCouponResult({ valid: false, reason: 'Could not check that code right now.' });
    } finally {
      setCouponChecking(false);
    }
  };


  // Premium is attached to the ACCOUNT (the server grants it to the signed-in user), so it follows them to any
  // device they log in on. A guest purchase would be tied to this one device, so ask for a free account first.
  const requireAccount = () => {
    navigation.navigate('Auth', { mode: 'signup', intent: t('paywall.intent.createFirst') });
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    if (isGuest) { requireAccount(); return; }
    if (emailUnverified) {
      // Checked BEFORE the store charges anything. An unverified address can't be used to recover the account, and
      // Premium lives on the account.
      setCheckoutState('failed');
      setCheckoutErrorText(t('paywall.error.verifyEmail'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    billingApi.trackFunnelEvent('CHECKOUT_INITIATED', selectedPlan.id).catch(() => {});
    setCheckoutErrorText(null);

    if (!billingReady) {
      setCheckoutState('failed');
      return;
    }

    const pkg = packagesByPlan[selectedPlan.id];
    if (!pkg) {
      setCheckoutState('failed');
      setCheckoutErrorText(t('paywall.error.planUnavailable'));
      return;
    }

    setCheckoutState('pending');
    try {
      const { appUserId, entitlementActive } = await purchasePlan(pkg);
      if (!entitlementActive) {
        setCheckoutState('failed');
        setCheckoutErrorText(t('paywall.error.notActiveYet'));
        return;
      }
      // The purchase itself already happened via the native billing sheet -
      // this call only asks the backend to re-verify and record it, never
      // what grants Premium (see routes/billing.ts's confirm-purchase).
      await billingApi.confirmPurchase(appUserId, couponResult?.valid ? couponInput.trim() : undefined);
      setCheckoutState('idle');
      navigation.goBack();
    } catch (__err) {
      const err = asApiError(__err);
      setCheckoutState('failed');
      if (err?.userCancelled) {
        setCheckoutState('idle'); // not an error - just dismiss silently
      } else {
        setCheckoutErrorText(err?.message ?? t('paywall.error.purchaseFailed'));
      }
    }
  };

  const handleRestore = async () => {
    if (isGuest) {
      // Restoring on a new device: log in first, so the purchase is matched to your account.
      navigation.navigate('Auth', { mode: 'login', intent: t('paywall.intent.logInToRestore') });
      return;
    }
    setRestoring(true);
    setCheckoutErrorText(null);
    try {
      const { appUserId, entitlementActive } = await restorePurchases();
      if (!entitlementActive) {
        setCheckoutErrorText(t('paywall.error.nothingToRestore'));
        return;
      }
      await billingApi.confirmPurchase(appUserId);
      navigation.goBack();
    } catch (__err) {
      const err = asApiError(__err);
      setCheckoutErrorText(err?.message ?? t('paywall.error.restoreFailed'));
    } finally {
      setRestoring(false);
    }
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
              {t('ui.PaywallScreen.unlockYourCompleteSelfDiscovery')}
            </Text>
            <Text variant="bodySm" tone="secondary" style={styles.heroSubtitle}>
              {t('ui.PaywallScreen.discoverDeeperInsightsIntoYour')}
            </Text>
          </View>

          {/* --- A look at what Premium adds -------------------------------- */}
          <ReportSampleCard />

          {/* --- Benefit categories -------------------------------------- */}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>{t('ui.PaywallScreen.everythingIncludedInPremium')}</Text>
          <BenefitsList />

          {/* --- Free vs Premium comparison -------------------------------- */}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>{t('ui.PaywallScreen.freeVsPremium')}</Text>
          <ComparisonTable />

          {/* --- Plan selector -------------------------------------------- */}
          {emailUnverified && (
            <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
              <VerifyEmailCard />
            </View>
          )}
          <Text variant="title" weight="semibold" style={styles.sectionTitle}>{t('ui.PaywallScreen.chooseYourPlan')}</Text>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {plans.length === 0 && !plansError && (
              <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.md }}>{t('ui.PaywallScreen.loadingPlans')}</Text>
            )}
            {plans.length === 0 && plansError && (
              <ErrorState message={t('ui.PaywallScreen.weCouldnTLoadThe')} onRetry={loadPlans} />
            )}
            <PlanCards plans={plans} selected={selected} onSelect={handleSelectPlan} />
          </View>

          {plans.length > 0 && (
            <View style={styles.couponSection}>
              <View style={styles.couponRow}>
                <Tag size={15} color={color.textSecondary} strokeWidth={1.75} />
                <TextInput
                  value={couponInput}
                  onChangeText={(v) => { setCouponInput(v); setCouponResult(null); }}
                  placeholder={t('ui.PaywallScreen.couponCode')}
                  placeholderTextColor={color.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.couponInput}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={handleApplyCoupon}
                  disabled={!couponInput.trim() || couponChecking}
                  style={({ pressed }) => [styles.couponApplyBtn, pressed && { opacity: 0.85 }, (!couponInput.trim() || couponChecking) && { opacity: 0.5 }]}
                >
                  <Text variant="caption" weight="semibold" style={{ color: tarotColor.midnight }}>
                    {couponChecking ? t('ui.PaywallScreen.checking') : t('ui.PaywallScreen.apply')}
                  </Text>
                </Pressable>
              </View>
              {couponResult && (
                couponResult.valid ? (
                  <View style={styles.couponFeedbackRow}>
                    <Check size={14} color={color.success} strokeWidth={2} />
                    <Text variant="caption" style={{ color: color.success, marginLeft: spacing.xs }}>
                      {t('ui.PaywallScreen.couponApplied', { percent: couponResult.discountPercent })}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" style={{ color: color.danger, marginTop: spacing.xs }}>{couponResult.reason}</Text>
                )
              )}
            </View>
          )}

          {!billingReady && (
            <View style={styles.configNotice}>
              <Text variant="caption" style={{ color: color.warning }}>
                {t('ui.PaywallScreen.billingIsNotYetConfigured')}
              </Text>
            </View>
          )}

          {checkoutState === 'failed' && (
            <View style={styles.configNotice}>
              <Text variant="caption" style={{ color: color.danger }}>
                {checkoutErrorText ?? t('paywall.error.unavailable')}
              </Text>
            </View>
          )}

          <Pressable accessibilityRole="button" onPress={handleRestore} disabled={restoring || !billingReady} style={styles.restoreRow}>
            <RefreshCw size={14} color={color.textSecondary} strokeWidth={1.75} />
            <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.xs }}>
              {restoring ? t('paywall.restoring') : t('paywall.restore')}
            </Text>
          </Pressable>

          <Text variant="caption" tone="muted" style={styles.legal}>
            {t('paywall.legal')}{' '}
            <Text variant="caption" tone="accent">{t('ui.PaywallScreen.terms')}</Text> · <Text variant="caption" tone="accent">{t('ui.PaywallScreen.privacy')}</Text>
          </Text>
        </Animated.View>
      </ScrollView>

      {/* --- Sticky bottom CTA ------------------------------------------- */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <LinearGradient colors={['rgba(18,16,31,0)', tarotColor.midnight]} style={styles.ctaFade} pointerEvents="none" />
        <Pressable accessibilityRole="button"
          onPress={handleCheckout}
          disabled={checkoutState === 'pending' || !selectedPlan}
          style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.9 }]}
        >
          <Text variant="bodySm" weight="semibold" style={{ color: tarotColor.midnight }}>
            {checkoutState === 'pending' ? t('paywall.processing') : planCtaLabel(selectedPlan, t, couponResult?.valid ? couponResult.discountedPriceCents : undefined)}
          </Text>
        </Pressable>
        <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {t('paywall.trust')}
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
  couponSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  couponInput: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    color: color.textPrimary,
  },
  couponApplyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: tarotColor.gold,
  },
  couponFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
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
