import AsyncStorage from '@react-native-async-storage/async-storage';

import { RATES_CACHE_KEY, loadCachedRates, refreshRates, saveCachedRates } from '../rates';

const BODY = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1_699_999_000,
  rates: { USD: 1, EUR: 0.8, GBP: 0.75 },
};

const TABLE = {
  base: 'USD',
  rates: { USD: 1, EUR: 0.9 },
  fetchedAt: 1_600_000_000_000,
  ratesAsOf: 1_600_000_000_000,
};

function mockFetch(impl: () => Promise<unknown>) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(impl) as unknown as typeof fetch;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('the cache', () => {
  it('round-trips a table', async () => {
    await saveCachedRates(TABLE);
    expect(await loadCachedRates()).toEqual(TABLE);
  });

  it('is null when nothing has been cached', async () => {
    expect(await loadCachedRates()).toBeNull();
  });

  it('returns null rather than throwing on corrupt cached JSON', async () => {
    await AsyncStorage.setItem(RATES_CACHE_KEY, 'not json');
    expect(await loadCachedRates()).toBeNull();
  });

  it('rejects a cached value of the wrong shape, not just unparseable text', async () => {
    await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ base: 'USD' }));
    expect(await loadCachedRates()).toBeNull();
  });

  it('survives a storage failure rather than crashing the screen', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk full'));
    expect(await loadCachedRates()).toBeNull();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveCachedRates(TABLE)).resolves.toBeUndefined();
  });
});

describe('refreshRates', () => {
  it('fetches, parses and caches a fresh table', async () => {
    mockFetch(async () => ({ ok: true, json: async () => BODY }));
    const table = await refreshRates(1_700_000_000_000);
    expect(table?.rates.EUR).toBe(0.8);
    expect(await loadCachedRates()).toEqual(table);
  });

  it('returns null and leaves the cache untouched when the network fails', async () => {
    await saveCachedRates(TABLE);
    mockFetch(async () => {
      throw new Error('offline');
    });
    expect(await refreshRates(Date.now())).toBeNull();
    expect(await loadCachedRates()).toEqual(TABLE);
  });

  it('returns null on a non-2xx response rather than parsing an error page', async () => {
    mockFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await refreshRates(Date.now())).toBeNull();
  });

  it('returns null when the body is valid JSON but not a rate table', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ result: 'error' }) }));
    expect(await refreshRates(Date.now())).toBeNull();
  });

  it('does not cache a table it refused to parse', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ result: 'error' }) }));
    await refreshRates(Date.now());
    expect(await loadCachedRates()).toBeNull();
  });

  it('survives a body that is not JSON at all', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    expect(await refreshRates(Date.now())).toBeNull();
  });
});
