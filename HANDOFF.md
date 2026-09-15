# Convertwise — handoff

What was actually run, and what is still unknown. **Unverified is `UNKNOWN`,
never a pass** — a green build is not a verification.

Last updated: 2026-09-15 (device pass complete)

## Verification state

| Gate | State | Evidence |
|---|---|---|
| Lint | ✅ | `npm run lint` clean |
| Typecheck | ✅ | `npx tsc --noEmit` clean |
| Unit tests | ✅ | 397 passing, coverage thresholds met |
| i18n completeness (14 locales) | ✅ | `check-i18n: 14 locales × 79 keys — complete` |
| UI rules (colour tokens, `t()`) | ✅ | `check-ui-rules: 14 files clean` |
| iOS + Android bundle export | ✅ | `npx expo export` both platforms |
| CI green on a self-hosted runner | ⬜ | |
| `check:release` with real identifiers | ✅ | `✓ All 10 release identifiers are set.` |
| Builds, installs, launches on the iOS simulator | ✅ | iPhone 17 / iOS 27; installed, launched, alive after 10s, no UIScene death in the device log |
| Renders in light **and** dark on device | ✅ | both appearances captured on iOS and Android |
| Every feature driven on the Android emulator | ✅ | convert, swap, unit picker, category switch, copy, pin, currency — see below |
| Purchase flow exercised against a real offering | ⬜ | |
| Ads served under real consent | ✅ | `[ads] consent {"canServeAds":true}` then a live test banner rendered on screen |

## Store and service state

| | State | Id |
|---|---|---|
| Bundle id registered | ✅ | `com.altixcode.convertwise` (ASC `5JG7CC72MG`) |
| App Store Connect record | ⬜ | |
| iOS IAP created and priced | ⬜ | |
| Play Console app | ⬜ | |
| Play AAB uploaded (internal) | ⬜ | |
| Play in-app product | ⬜ | |
| AdMob apps (iOS + Android) | ✅ | `ca-app-pub-2504845459806550~2550873404` / `~2549470377` |
| AdMob ad units (6) | ✅ | banner, interstitial, rewarded per platform — read back from AdMob, all present |
| AdMob GDPR + US-states messages published | ⬜ | |
| RevenueCat project, apps, entitlement, offering | ✅ | `proj14c4c30d`; iOS `app3e877125e1`, Android `appf226397ca2`; `remove_ads`; `default`/`$rc_lifetime` |

## Decisions the owner owns

- Publish on altixcode.com and itsata.com? **Not yet asked.**

## Known UNKNOWNs

- **The purchase flow has never been exercised against a real offering.** There
  is no App Store Connect app record yet, so there is no store product, so
  RevenueCat's `default` offering carries no package. The paywall correctly
  renders its "store unavailable" state — verified on the emulator — but
  `purchase()` itself is `UNKNOWN`.
- **AdMob consent messages are not published.** The apps and ad units exist and
  a banner serves, but the GDPR and US-states messages must be published by
  hand in the console. Until they are, an EEA user sees **no ads at all**,
  because the SDK can only present a message that exists and this app fails
  closed on missing consent. That is not an integration bug and it will not
  show up in QA outside the EEA.
- **No App Store Connect or Play Console record.** ASC needs a human to sign in
  again; Play needs an AAB uploaded before its product can be created.
- CI on the self-hosted runner has not yet gone green for this repo.

## What was actually proved on device, and how

Rule 2 says a green screen is not a verification, so each of these was checked
by reading something back from **outside** the app:

| Claim | The artifact |
|---|---|
| The conversion is real | `2 m` → `6.56167979003 ft` read out of the live view hierarchy with `uiautomator dump`, not off a screenshot |
| Copy reaches the system clipboard | the result was pasted **back** into the input with `KEYCODE_PASTE`, and the app then re-converted it to `21.5278208334 ft` — correct for that input |
| Pins persist | the app was force-stopped and its own SQLite store read with `run-as`: `{"category":"length","fromUnit":"m","toUnit":"ft","lastPair":{},"pins":["length:m:ft"]}` |
| The exchange rates are the real ones | on-device `100 USD = 86.5688 EUR` compared against a fresh `open.er-api.com` fetch made independently — exact match |
| Ads actually serve | a Google test banner rendered on screen, after `[ads] consent {"canServeAds":true}` |
| Both themes work | light and dark captured on both platforms; the light theme uses the dark accent and clears AA by the palette test |

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
