import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

/**
 * Real Google Play / App Store billing via RevenueCat - the SDK a React
 * Native app uses to talk to Play Billing/StoreKit without writing native
 * billing code. Requires:
 *  - A RevenueCat account (revenuecat.com) connected to the Google Play
 *    Console app (and App Store Connect, for iOS).
 *  - The 3 subscription products created in Play Console, matching exactly
 *    the ids in server/src/data/subscriptionPlans.ts's storeProductId:
 *    palmsetu_premium_monthly / _quarterly / _annual.
 *  - A RevenueCat "entitlement" called "premium" attached to all 3 products.
 *  - EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (the public SDK key from
 *    RevenueCat's dashboard, NOT the secret key) set in app/.env.
 * None of this can be done from code - see the setup checklist delivered
 * alongside this file for the exact dashboard steps.
 */

const ENTITLEMENT_ID = 'premium';

function apiKey(): string | null {
  // iOS key kept as a separate env var for when that platform is wired up -
  // Android is the only platform this app currently targets for billing.
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  return null;
}

export function isBillingConfigured(): boolean {
  return !!apiKey();
}

let configured = false;

/** Call once, after the user's real or guest id is known (see AuthContext) - RevenueCat uses this as its app_user_id, the same id the backend's server-side verification call looks up. */
export function configurePurchases(appUserId: string) {
  const key = apiKey();
  if (!key || configured) return;
  Purchases.configure({ apiKey: key, appUserID: appUserId });
  configured = true;
}

export interface PlanPackageMap {
  [planId: string]: PurchasesPackage;
}

/** Maps RevenueCat's current offering packages to our plan ids by their
 * underlying product identifier, so the UI never has to know RevenueCat's
 * own package-identifier conventions. */
export async function getPackagesByPlan(): Promise<PlanPackageMap> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return {};

  const map: PlanPackageMap = {};
  for (const pkg of current.availablePackages) {
    const productId = pkg.product.identifier;
    if (productId.includes('monthly')) map.monthly = pkg;
    else if (productId.includes('quarterly')) map.quarterly = pkg;
    else if (productId.includes('annual')) map.annual = pkg;
  }
  return map;
}

export interface PurchaseResult {
  appUserId: string;
  entitlementActive: boolean;
}

export async function purchasePlan(pkg: PurchasesPackage): Promise<PurchaseResult> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return toResult(customerInfo);
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const customerInfo = await Purchases.restorePurchases();
  return toResult(customerInfo);
}

function toResult(customerInfo: CustomerInfo): PurchaseResult {
  return {
    appUserId: customerInfo.originalAppUserId,
    entitlementActive: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
  };
}
