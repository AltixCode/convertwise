# Convertwise — handoff

What was actually run, and what is still unknown. **Unverified is `UNKNOWN`,
never a pass** — a green build is not a verification.

Last updated: 2026-09-15

## Verification state

| Gate | State | Evidence |
|---|---|---|
| Lint | ✅ | `npm run lint` clean |
| Typecheck | ✅ | `npx tsc --noEmit` clean |
| Unit tests | ✅ | 394 passing, coverage thresholds met |
| i18n completeness (14 locales) | ✅ | `check-i18n: 14 locales × 79 keys — complete` |
| UI rules (colour tokens, `t()`) | ✅ | `check-ui-rules: 14 files clean` |
| iOS + Android bundle export | ✅ | `npx expo export` both platforms |
| CI green on a self-hosted runner | ⬜ | |
| `check:release` with real identifiers | ⬜ | |
| Builds, installs, launches on the iOS simulator | ⬜ | |
| Renders in light **and** dark on device | ⬜ | |
| Every feature driven on the Android emulator | ⬜ | |
| Purchase flow exercised against a real offering | ⬜ | |
| Ads served under real consent | ⬜ | |

## Store and service state

| | State | Id |
|---|---|---|
| Bundle id registered | ✅ | `com.altixcode.convertwise` (ASC `5JG7CC72MG`) |
| App Store Connect record | ⬜ | |
| iOS IAP created and priced | ⬜ | |
| Play Console app | ⬜ | |
| Play AAB uploaded (internal) | ⬜ | |
| Play in-app product | ⬜ | |
| AdMob apps (iOS + Android) | ⬜ | |
| AdMob ad units (6) | ⬜ | |
| AdMob GDPR + US-states messages published | ⬜ | |
| RevenueCat project, apps, entitlement, offering | ✅ | `proj14c4c30d`; iOS `app3e877125e1`, Android `appf226397ca2`; `remove_ads`; `default`/`$rc_lifetime` |

## Decisions the owner owns

- Publish on altixcode.com and itsata.com? **Not yet asked.**

## Known UNKNOWNs

- Everything above still marked ⬜. In particular **nothing has run on hardware**:
  the app has never launched, no screen has been seen in either appearance, no
  purchase has been attempted and no ad has been requested. A green
  `npm run verify` proves the graph resolves and the logic is sound; it proves
  nothing about the first frame.
- **AdMob is not provisioned.** AdMob has no public write API, and the browser
  profile that holds the logged-in console was held by another session. Until
  the two apps and six ad units exist, `check:release` fails by design and the
  app falls back to Google's test units.

## What this app actually does, so no claim outruns the code

- Eight offline categories (length, weight, temperature, volume, speed, area,
  data, time) built from exact international definitions, plus live currency.
- Currency rates come from ExchangeRate-API's keyless open endpoint, refreshed
  at most every 12 hours and cached on device. The provider updates **once a
  day**, so the app must never claim more often than that.
- The only network request the app makes is that rate fetch. It carries nothing
  about the user; there is no account and no analytics.
- The purchase removes the ads and lifts the three-pin free cap. There is no
  other gated feature, and the paywall copy says exactly that and no more.
