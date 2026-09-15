# Convertwise — service identifiers

Every id provisioned for this app, and what is still missing. No secret belongs
in this file: the RevenueCat **public** SDK keys are client-side identifiers but
are still kept out of the repo and set as GitHub Actions secrets instead, so
there is exactly one place they live.

## Apple

| | |
|---|---|
| Bundle id | `com.altixcode.convertwise` |
| ASC bundle-id record | `5JG7CC72MG` |
| App Store Connect app record | **not created** |
| IAP product id | `com.altixcode.convertwise.removeads` (not created) |

## Google Play

| | |
|---|---|
| Package name | `com.altixcode.convertwise` |
| Play Console app | **not created** |
| In-app product | `remove_ads` (not created) |

A Play app has **no package name until its first bundle is uploaded**, so the
order is: create the app → upload an AAB to internal testing → then create the
product. Build that first AAB from a non-production profile so it carries test
ad units; internal testers must not generate live impressions.

## RevenueCat

| | |
|---|---|
| Project | `proj14c4c30d` |
| iOS app | `app3e877125e1` |
| Android app | `appf226397ca2` |
| Entitlement | `entlf41f6a9691` — `remove_ads` |
| Offering | `ofrng72fcb4cc2b` — `default` (current) |
| Package | `pkge40ca627eb6` — `$rc_lifetime` |

Products are attached once the store products exist; the catalogue is complete
and correct without them, and the paywall shows its "store unavailable" state
until then rather than a wrong price.

Public SDK keys are **not** returned by `rc apps show`. Fetch them with
`rc api GET "/projects/proj14c4c30d/apps/<appId>/public_api_keys"`. They are set
as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` on `AltixCode/convertwise`.

## AdMob — **not provisioned**

AdMob has no public write API at all; the two apps, six ad units and both
consent messages must be created in the browser console. Until they exist:

- `npm run check:release` fails, by design, and no production build can be made.
- The app runs on Google's **test** ad units, which serve perfectly and earn
  nothing. That is the failure mode the check exists to catch.

What is needed, once the console is reachable:

| | |
|---|---|
| AdMob apps | iOS + Android, answering **"No, not listed on a supported app store"** |
| Ad units | banner, interstitial, rewarded — per platform, six total |
| Consent | a **GDPR message** and a **US-states message**, both *published* |

The consent messages are not optional. The SDK can only present a message that
exists, and this app fails closed on missing consent — so without them an EEA
user sees **no ads at all**, which looks exactly like a broken integration.

Expect "Requires review — limited ad serving" for a few days after launch. That
is not an integration bug.

## GitHub secrets on `AltixCode/convertwise`

| Secret | Set |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | ✅ |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | ✅ |
| `EXPO_TOKEN` | ✅ |
| `ADMOB_IOS_APP_ID` | ⬜ blocked on AdMob |
| `ADMOB_ANDROID_APP_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_IOS_BANNER_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID` | ⬜ blocked on AdMob |
| `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID` | ⬜ blocked on AdMob |
