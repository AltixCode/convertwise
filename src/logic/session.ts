/**
 * Session bookkeeping: what counts as "a conversion the user actually did", and the free-tier
 * pin rules. Pure, so the two decisions that carry money — when an ad is allowed to interrupt,
 * and when the paywall appears — are exhaustively testable.
 */

/** Pins a free user may keep. The upgrade lifts the cap; it does not add a different feature. */
export const FREE_PIN_LIMIT = 3;

export interface ConversionCount {
  count: number;
  /** The last conversion counted, so holding the same result on screen is not counted again. */
  lastKey: string | null;
}

/** Identifies one conversion. Typing a digit changes it; re-rendering the same result does not. */
export function conversionKey(value: number, fromId: string, toId: string): string {
  return `${value}|${fromId}|${toId}`;
}

/**
 * Counts a settled conversion.
 *
 * Every keystroke re-converts, so counting renders would show an interstitial within seconds of
 * launch. Only a conversion *different from the one before it* counts, and an empty key — a
 * cleared input — counts for nothing.
 */
export function countConversion(state: ConversionCount, key: string): ConversionCount {
  if (key === '' || key === state.lastKey) return state;
  return { count: state.count + 1, lastKey: key };
}

/** Identifies a pinned pair. Persisted, so the format must not change. */
export function pinKey(category: string, fromId: string, toId: string): string {
  return `${category}:${fromId}:${toId}`;
}

export function togglePinIn(pins: readonly string[], key: string): string[] {
  return pins.includes(key) ? pins.filter((p) => p !== key) : [...pins, key];
}

/** Removing is always allowed; only adding is capped. */
export function canAddPin(pins: readonly string[], isPremium: boolean): boolean {
  return isPremium || pins.length < FREE_PIN_LIMIT;
}
