/**
 * Exchange-rate maths and the shape of a cached rate table. Pure: fetching and caching live in
 * `src/services/rates.ts`, so every rule here is testable without a network or a device.
 *
 * Rates come from one provider keyed on a single base currency (USD). Converting between two
 * non-base currencies therefore goes through the base, which is exactly one extra division and
 * introduces no error worth worrying about at the precision anybody spends money at.
 */
import type { Unit } from './units';

export interface RateTable {
  /** The currency every rate in `rates` is quoted against. */
  base: string;
  /** ISO 4217 code -> units of that currency per one unit of `base`. */
  rates: Record<string, number>;
  /** When this device fetched the table. Drives staleness. */
  fetchedAt: number;
  /** When the provider says the rates themselves were set. Drives the "rates as of" label. */
  ratesAsOf: number;
}

/**
 * How long a cached table is used before a refresh is attempted. The provider updates once a
 * day, so refreshing more often spends the user's battery and data on an identical answer.
 * A stale table is still used when the refresh fails — a day-old rate beats no converter.
 */
export const RATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function convertCurrency(
  value: number,
  fromCode: string,
  toCode: string,
  table: RateTable,
): number {
  if (fromCode === toCode) return value;
  const from = table.rates[fromCode];
  const to = table.rates[toCode];
  if (from === undefined) throw new Error(`Unknown currency: ${fromCode}`);
  if (to === undefined) throw new Error(`Unknown currency: ${toCode}`);
  if (!Number.isFinite(from) || from <= 0) throw new Error(`Unusable rate for ${fromCode}`);
  if (!Number.isFinite(to) || to <= 0) throw new Error(`Unusable rate for ${toCode}`);
  return (value / from) * to;
}

/**
 * True when the table should be refreshed. A `now` earlier than `fetchedAt` — a device whose
 * clock moved backwards, or a timezone change — counts as stale rather than fresh forever.
 */
export function isStale(table: RateTable | null, now: number): boolean {
  if (!table) return true;
  const age = now - table.fetchedAt;
  return age < 0 || age >= RATE_MAX_AGE_MS;
}

/** Presents the cached rates as units the converter screen can treat like any other. */
export function currencyUnits(table: RateTable | null): Unit[] {
  if (!table) return [];
  return Object.keys(table.rates)
    .sort()
    .map((code) => ({ id: code, category: 'currency' as const, symbol: code, factor: 1 }));
}

interface RateResponseShape {
  result?: unknown;
  base_code?: unknown;
  time_last_update_unix?: unknown;
  rates?: unknown;
}

/**
 * Validates a provider response into a table, or returns null.
 *
 * Deliberately strict. A half-parsed table cached to disk is worse than no table: it survives
 * restarts, and every conversion it powers is quietly wrong.
 */
export function parseRateResponse(body: unknown, fetchedAt: number): RateTable | null {
  if (typeof body !== 'object' || body === null) return null;
  const { result, base_code: baseCode, time_last_update_unix: asOf, rates } = body as RateResponseShape;
  if (result !== 'success') return null;
  if (typeof baseCode !== 'string' || baseCode.length !== 3) return null;
  if (typeof rates !== 'object' || rates === null) return null;

  const clean: Record<string, number> = {};
  for (const [code, rate] of Object.entries(rates as Record<string, unknown>)) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    clean[code] = rate;
  }
  if (Object.keys(clean).length === 0) return null;

  return {
    base: baseCode,
    rates: clean,
    fetchedAt,
    // The provider sends seconds; a missing or nonsensical value falls back to the fetch time
    // so the label is never blank and never a date in 1970.
    ratesAsOf: typeof asOf === 'number' && Number.isFinite(asOf) && asOf > 0 ? asOf * 1000 : fetchedAt,
  };
}

/**
 * How old rates have to be before the screen warns about them. The provider updates daily, so
 * two days means at least one update was genuinely missed — not merely that it is the evening.
 */
export const RATES_OUTDATED_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * True when the rates on screen are old enough that the user should be told.
 *
 * Separate from `isStale`, which decides when to *try* a refresh. A table can be stale (worth
 * refreshing) without being outdated (worth warning about), and conflating the two either
 * nags on every launch or never warns at all.
 */
export function ratesAreOutdated(table: RateTable | null, now: number): boolean {
  if (!table) return false;
  return now - table.ratesAsOf >= RATES_OUTDATED_AFTER_MS;
}

/**
 * The provider's "rates as of" moment, formatted for the active language.
 *
 * `Intl.DateTimeFormat` rather than a hand-rolled format: date order, month names, the 12/24
 * hour choice and the separators all differ per locale, and every one of them is already
 * correct in the platform's CLDR data.
 */
export function formatRatesAsOf(table: RateTable | null, language: string): string {
  if (!table) return '';
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(table.ratesAsOf));
  } catch {
    // A runtime without full Intl still shows something true rather than nothing.
    return new Date(table.ratesAsOf).toISOString().slice(0, 16).replace('T', ' ');
  }
}
