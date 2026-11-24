# Real-phone test checklist (do this on an Android phone before release)

Use a **development build** (`eas build --profile development --platform android`) or, once the Play account exists,
the **internal testing track**. Expo Go cannot test items marked (build).

## 1. Palm scan (camera)
- [ ] First launch asks for camera permission; denying it shows a helpful message, not a crash.
- [ ] Scan with good light: result appears; locked sections show one line + "upgrade to see more".
- [ ] Scan with bad light / no hand: friendly "try again" message.
- [ ] Palm photo shows up in My Reports after closing and reopening the app (signed photo links work).

## 2. Notifications (build)
- [ ] Profile → Notifications → Daily reminders: enable, set a time 2 minutes ahead, lock the phone, receive it.
- [ ] Open the app daily: the streak reminder is NOT sent; skip a day: exactly one reminder arrives.
- [ ] Deny permission: the screen explains how to turn it on.

## 3. Google sign-in (build)
- [ ] Profile → Sign up → Continue with Google → pick account → lands on Home signed in, email shown in Profile.
- [ ] Sign out, sign in again: same account (no duplicate). Guest readings made before signing in are kept.
- [ ] Cancel the Google sheet: no error stuck on screen.
- [ ] Reinstall app, sign in with Google on a second phone: readings sync.

## 4. Purchase (internal testing track + a licence-tester Google account)
- [ ] Paywall shows the three real prices from Play.
- [ ] Buy monthly: Premium unlocks (tarot spreads, full AI chat, usage meter appears).
- [ ] Kill and reopen the app: still Premium. Sign in on another phone: Premium follows the account.
- [ ] Cancel in Play: access stays until the period ends, then returns to Free.
- [ ] Restore purchases works on a fresh install.

## 5. Everyday checks
- [ ] Back button on every screen never exits unexpectedly; keyboard never hides the chat box.
- [ ] Switch language to Hindi and Arabic (right-to-left): no cut-off text or mirrored-wrong icons.
- [ ] Airplane mode: friendly "no connection" message, app does not crash.
- [ ] Free account: 5 AI chat answers/day, then a clear note; tarot one-card works, other spreads ask for Premium.
- [ ] Delete account (Profile → Account management) works and signs you out.
- [ ] Crash reporting: with a Sentry DSN set, trigger a test error and see it in Sentry without any personal data.
