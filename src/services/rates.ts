/**
 * Fetching and caching the exchange-rate table. The only part of Convertwise that touches the
 * network at all; everything else works with the radio off.
 *
 * The provider is ExchangeRate-API's open endpoint, which needs no key — which is the reason it
 * was chosen over the alternatives. A key would have to live either in the bundle, where it is
 * public and abusable, or behind a server this app deliberately does not have.
 *
 * Every failure path returns null and leaves whatever was cached alone. A day-old rate with an
 * honest "as of" label is a usable converter; a cleared cache is a blank screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseRateResponse, type RateTable } from '@/logic/currency';

export const RATES_CACHE_KEY = 'convertwise.rates.v1';

const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

/** Long enough for a slow connection, short enough that the screen is not stuck waiting. */
const TIMEOUT_MS = 10_000;

function isRateTable(value: unknown): value is RateTable {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Partial<RateTable>;
  return (
    typeof t.base === 'string' &&
    typeof t.fetchedAt === 'number' &&
    typeof t.ratesAsOf === 'number' &&
    typeof t.rates === 'object' &&
    t.rates !== null &&
    Object.keys(t.rates).length > 0
  );
}

export async function loadCachedRates(): Promise<RateTable | null> {
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Shape-check as well as parse: a cache written by an older version, or half-written by a
    // crash, is unparseable-in-practice even though `JSON.parse` accepts it.
    return isRateTable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCachedRates(table: RateTable): Promise<void> {
  try {
    await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(table));
  } catch {
    // A failed write costs one extra fetch next launch and nothing else.
  }
}

/**
 * Fetches a fresh table and caches it. Returns null on any failure — offline, a provider
 * outage, an HTML error page, a malformed body — without disturbing the cache.
 */
export async function refreshRates(now: number = Date.now()): Promise<RateTable | null> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    const response = await fetch(ENDPOINT, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const table = parseRateResponse(body, now);
    if (!table) return null;
    await saveCachedRates(table);
    return table;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
