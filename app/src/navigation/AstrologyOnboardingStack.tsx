import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingAstrologySystemScreen } from '../screens/astrology/onboarding/OnboardingAstrologySystemScreen';
import { OnboardingDobScreen } from '../screens/astrology/onboarding/OnboardingDobScreen';
import { OnboardingTobScreen } from '../screens/astrology/onboarding/OnboardingTobScreen';
import { OnboardingPlaceScreen } from '../screens/astrology/onboarding/OnboardingPlaceScreen';
import { OnboardingConfirmScreen } from '../screens/astrology/onboarding/OnboardingConfirmScreen';
import { AstrologyOnboardingStep } from '../utils/onboardingStep';

export type AstrologyOnboardingStackParamList = {
  OnboardingAstrologySystem: undefined;
  OnboardingDob: undefined;
  OnboardingTob: undefined;
  OnboardingPlace: undefined;
  OnboardingConfirm: undefined;
};

const STEP_TO_ROUTE: Record<Exclude<AstrologyOnboardingStep, 'done'>, keyof AstrologyOnboardingStackParamList> = {
  system: 'OnboardingAstrologySystem',
  dob: 'OnboardingDob',
  tob: 'OnboardingTob',
  place: 'OnboardingPlace',
  confirm: 'OnboardingConfirm',
};

const Stack = createNativeStackNavigator<AstrologyOnboardingStackParamList>();

/**
 * Nested stack for the astrology-onboarding steps, mounted by RootNavigator
 * once per `astrologyStep` value (remounting on every step change via a
 * `key` on the outer screen) so `initialRouteName` always matches the real
 * resume point derived from the backend - this is how "closed mid-flow,
 * reopen, land on the right step" actually works, with no separate client
 * progress flag anywhere.
 */
export function AstrologyOnboardingStack({ initialStep }: { initialStep: Exclude<AstrologyOnboardingStep, 'done'> }) {
  return (
    <Stack.Navigator initialRouteName={STEP_TO_ROUTE[initialStep]} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingAstrologySystem" component={OnboardingAstrologySystemScreen} />
      <Stack.Screen name="OnboardingDob" component={OnboardingDobScreen} />
      <Stack.Screen name="OnboardingTob" component={OnboardingTobScreen} />
      <Stack.Screen name="OnboardingPlace" component={OnboardingPlaceScreen} />
      <Stack.Screen name="OnboardingConfirm" component={OnboardingConfirmScreen} />
    </Stack.Navigator>
  );
}
