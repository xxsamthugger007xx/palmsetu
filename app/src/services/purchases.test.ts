import { describe, it, expect, vi, beforeEach } from 'vitest';

const sdk = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn().mockResolvedValue({}),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getOfferings: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('react-native-purchases', () => ({ default: sdk }));

async function load(withKey = true) {
  vi.resetModules();
  if (withKey) process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = 'goog_test'; else delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return import('./purchases');
}
beforeEach(() => { Object.values(sdk).forEach((f) => f.mockClear()); sdk.logIn.mockResolvedValue({}); });

describe('configurePurchases (Premium belongs to the account, so RevenueCat must follow the signed-in user)', () => {
  it('does nothing when billing is not configured', async () => {
    const p = await load(false);
    expect(p.isBillingConfigured()).toBe(false);
    p.configurePurchases('user-1');
    expect(sdk.configure).not.toHaveBeenCalled();
  });

  it('configures the SDK once with the first user id', async () => {
    const p = await load();
    expect(p.isBillingConfigured()).toBe(true);
    p.configurePurchases('guest-1');
    p.configurePurchases('guest-1');
    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'goog_test', appUserID: 'guest-1' });
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it('switches RevenueCat user on login / logout instead of staying on the first guest id', async () => {
    const p = await load();
    p.configurePurchases('guest-1');
    p.configurePurchases('user-abc'); // logged in
    expect(sdk.logIn).toHaveBeenCalledWith('user-abc');
    p.configurePurchases('user-abc'); // same id again: no extra call
    expect(sdk.logIn).toHaveBeenCalledTimes(1);
    p.configurePurchases('guest-2'); // logged out -> fresh guest
    expect(sdk.logIn).toHaveBeenLastCalledWith('guest-2');
    expect(sdk.configure).toHaveBeenCalledTimes(1);
  });

  it('retries the switch next time if RevenueCat rejected it', async () => {
    const p = await load();
    p.configurePurchases('guest-1');
    sdk.logIn.mockRejectedValueOnce(new Error('offline'));
    p.configurePurchases('user-abc');
    await Promise.resolve(); await Promise.resolve();
    p.configurePurchases('user-abc');
    expect(sdk.logIn).toHaveBeenCalledTimes(2);
  });
});

describe('purchase results', () => {
  const info = (active: boolean) => ({ originalAppUserId: 'user-abc', entitlements: { active: active ? { premium: {} } : {} } });

  it('reports whether the premium entitlement is active after a purchase', async () => {
    const p = await load();
    sdk.purchasePackage.mockResolvedValue({ customerInfo: info(true) });
    expect(await p.purchasePlan({} as any)).toEqual({ appUserId: 'user-abc', entitlementActive: true });
    sdk.purchasePackage.mockResolvedValue({ customerInfo: info(false) });
    expect((await p.purchasePlan({} as any)).entitlementActive).toBe(false);
  });

  it('restore reports the entitlement the same way', async () => {
    const p = await load();
    sdk.restorePurchases.mockResolvedValue(info(true));
    expect((await p.restorePurchases()).entitlementActive).toBe(true);
    sdk.restorePurchases.mockResolvedValue(info(false));
    expect((await p.restorePurchases()).entitlementActive).toBe(false);
  });

  it('maps store products to plans by product id', async () => {
    const p = await load();
    const pkg = (id: string) => ({ product: { identifier: id } });
    sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [pkg('palmsetu_premium_monthly'), pkg('palmsetu_premium_quarterly'), pkg('palmsetu_premium_annual'), pkg('other')] } });
    const map = await p.getPackagesByPlan();
    expect(Object.keys(map).sort()).toEqual(['annual', 'monthly', 'quarterly']);
    sdk.getOfferings.mockResolvedValue({ current: null });
    expect(await p.getPackagesByPlan()).toEqual({});
  });
});
