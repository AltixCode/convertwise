import AsyncStorage from '@react-native-async-storage/async-storage';

import { FREE_PIN_LIMIT, pinKey } from '@/logic/session';
import { CONVERTER_CACHE_KEY, useConverterStore } from '../useConverterStore';

const BODY = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1_699_999_000,
  rates: { USD: 1, EUR: 0.8, GBP: 0.75 },
};

function mockFetch(impl: () => Promise<unknown>) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(impl) as unknown as typeof fetch;
}

const initial = useConverterStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useConverterStore.setState(initial, true);
  mockFetch(async () => ({ ok: true, json: async () => BODY }));
});

describe('defaults', () => {
  it('opens on length, metres to feet, with an empty input', () => {
    const s = useConverterStore.getState();
    expect(s.category).toBe('length');
    expect([s.fromUnit, s.toUnit]).toEqual(['m', 'ft']);
    expect(s.input).toBe('');
  });

  it('shows nothing rather than zero before the user types', () => {
    expect(useConverterStore.getState().result()).toBe('');
  });
});

describe('converting', () => {
  it('converts as the input changes', () => {
    useConverterStore.getState().setInput('2');
    expect(useConverterStore.getState().result()).toBe('6.56167979003');
  });

  it('accepts a comma decimal separator', () => {
    useConverterStore.getState().setInput('1,5');
    expect(Number(useConverterStore.getState().result())).toBeCloseTo(4.92125984, 6);
  });

  it('returns an empty result for text that is not a number', () => {
    useConverterStore.getState().setInput('abc');
    expect(useConverterStore.getState().result()).toBe('');
  });

  it('swaps the two units and the value with them', () => {
    const s = useConverterStore.getState();
    s.setInput('2');
    const before = s.result();
    useConverterStore.getState().swap();
    const after = useConverterStore.getState();
    expect([after.fromUnit, after.toUnit]).toEqual(['ft', 'm']);
    expect(after.input).toBe(before);
  });

  it('does not swap into an unusable state when there is no result yet', () => {
    useConverterStore.getState().swap();
    const s = useConverterStore.getState();
    expect([s.fromUnit, s.toUnit]).toEqual(['ft', 'm']);
    expect(s.input).toBe('');
  });
});

describe('categories', () => {
  it('moves to the category default pair', () => {
    useConverterStore.getState().setCategory('temperature');
    const s = useConverterStore.getState();
    expect([s.fromUnit, s.toUnit]).toEqual(['c', 'f']);
  });

  it('remembers the pair the user last used in a category', () => {
    useConverterStore.getState().setFrom('km');
    useConverterStore.getState().setCategory('mass');
    useConverterStore.getState().setCategory('length');
    expect(useConverterStore.getState().fromUnit).toBe('km');
  });

  it('refuses a unit from another category rather than producing a wrong number', () => {
    useConverterStore.getState().setFrom('kg');
    expect(useConverterStore.getState().fromUnit).toBe('m');
  });

  it('keeps the typed value when the category changes, because the number is usually reused', () => {
    useConverterStore.getState().setInput('12');
    useConverterStore.getState().setCategory('mass');
    expect(useConverterStore.getState().input).toBe('12');
  });
});

describe('counting conversions for the ad cadence', () => {
  it('counts one settled conversion per distinct value', () => {
    const s = useConverterStore.getState();
    s.setInput('1');
    s.settle();
    useConverterStore.getState().setInput('2');
    useConverterStore.getState().settle();
    expect(useConverterStore.getState().conversions.count).toBe(2);
  });

  it('does not count the same conversion twice', () => {
    useConverterStore.getState().setInput('1');
    useConverterStore.getState().settle();
    useConverterStore.getState().settle();
    expect(useConverterStore.getState().conversions.count).toBe(1);
  });

  it('does not count an empty or unparseable input', () => {
    useConverterStore.getState().settle();
    useConverterStore.getState().setInput('abc');
    useConverterStore.getState().settle();
    expect(useConverterStore.getState().conversions.count).toBe(0);
  });
});

describe('pins', () => {
  it('pins the current pair', () => {
    useConverterStore.getState().togglePin(false);
    expect(useConverterStore.getState().pins).toEqual([pinKey('length', 'm', 'ft')]);
  });

  it('unpins it again', () => {
    useConverterStore.getState().togglePin(false);
    useConverterStore.getState().togglePin(false);
    expect(useConverterStore.getState().pins).toEqual([]);
  });

  it('refuses a free user past the limit and reports it, so the UI can offer the upgrade', () => {
    const filled = Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `length:m:x${i}`);
    useConverterStore.setState({ pins: filled });
    expect(useConverterStore.getState().togglePin(false)).toBe('limit-reached');
    expect(useConverterStore.getState().pins).toEqual(filled);
  });

  it('lets a premium user past the limit', () => {
    const filled = Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `length:m:x${i}`);
    useConverterStore.setState({ pins: filled });
    expect(useConverterStore.getState().togglePin(true)).toBe('pinned');
    expect(useConverterStore.getState().pins).toHaveLength(FREE_PIN_LIMIT + 1);
  });

  it('always allows unpinning at the limit', () => {
    const filled = Array.from({ length: FREE_PIN_LIMIT - 1 }, (_, i) => `length:m:x${i}`);
    useConverterStore.setState({ pins: [...filled, pinKey('length', 'm', 'ft')] });
    expect(useConverterStore.getState().togglePin(false)).toBe('unpinned');
  });

  it('applies a pin, moving to its category and pair', () => {
    useConverterStore.getState().applyPin(pinKey('mass', 'kg', 'lb'));
    const s = useConverterStore.getState();
    expect([s.category, s.fromUnit, s.toUnit]).toEqual(['mass', 'kg', 'lb']);
  });

  it('ignores a malformed pin rather than moving to a broken state', () => {
    useConverterStore.getState().applyPin('garbage');
    expect(useConverterStore.getState().category).toBe('length');
  });
});

describe('persistence', () => {
  it('writes pins and the last pair, and reads them back', async () => {
    useConverterStore.getState().setCategory('mass');
    useConverterStore.getState().togglePin(false);
    await useConverterStore.getState().persist();

    useConverterStore.setState(initial, true);
    await useConverterStore.getState().hydrate();

    const s = useConverterStore.getState();
    expect(s.pins).toEqual([pinKey('mass', 'kg', 'lb')]);
    expect(s.category).toBe('mass');
  });

  it('starts clean when nothing is stored', async () => {
    await useConverterStore.getState().hydrate();
    expect(useConverterStore.getState().pins).toEqual([]);
  });

  it('starts clean rather than throwing on corrupt stored state', async () => {
    await AsyncStorage.setItem(CONVERTER_CACHE_KEY, '{{{');
    await useConverterStore.getState().hydrate();
    expect(useConverterStore.getState().pins).toEqual([]);
    expect(useConverterStore.getState().category).toBe('length');
  });

  it('ignores a stored category that no longer exists', async () => {
    await AsyncStorage.setItem(CONVERTER_CACHE_KEY, JSON.stringify({ category: 'gone', pins: [] }));
    await useConverterStore.getState().hydrate();
    expect(useConverterStore.getState().category).toBe('length');
  });
});

describe('currency', () => {
  it('loads rates and exposes them as units', async () => {
    await useConverterStore.getState().ensureRates();
    const s = useConverterStore.getState();
    expect(s.ratesStatus).toBe('ready');
    expect(s.unitsForCategory('currency').map((u) => u.id)).toEqual(['EUR', 'GBP', 'USD']);
  });

  it('converts between currencies once rates are loaded', async () => {
    await useConverterStore.getState().ensureRates();
    useConverterStore.getState().setCategory('currency');
    useConverterStore.getState().setInput('100');
    expect(Number(useConverterStore.getState().result())).toBeCloseTo(80, 9);
  });

  it('reports an error and shows no result when rates cannot be fetched', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });
    await useConverterStore.getState().ensureRates();
    useConverterStore.getState().setCategory('currency');
    useConverterStore.getState().setInput('100');
    const s = useConverterStore.getState();
    expect(s.ratesStatus).toBe('error');
    expect(s.result()).toBe('');
  });

  it('keeps working offline from the cache, and says the rates are stale', async () => {
    await useConverterStore.getState().ensureRates();
    useConverterStore.setState(initial, true);
    mockFetch(async () => {
      throw new Error('offline');
    });
    await useConverterStore.getState().ensureRates();
    const s = useConverterStore.getState();
    expect(s.ratesStatus).toBe('ready');
    expect(s.rates?.rates.EUR).toBe(0.8);
  });

  it('does not refetch while a fetch is already in flight', async () => {
    const spy = jest.fn(async () => ({ ok: true, json: async () => BODY }));
    (globalThis as { fetch?: unknown }).fetch = spy as unknown as typeof fetch;
    await Promise.all([
      useConverterStore.getState().ensureRates(),
      useConverterStore.getState().ensureRates(),
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not refetch a table that is still fresh', async () => {
    await useConverterStore.getState().ensureRates();
    const spy = jest.fn(async () => ({ ok: true, json: async () => BODY }));
    (globalThis as { fetch?: unknown }).fetch = spy as unknown as typeof fetch;
    await useConverterStore.getState().ensureRates();
    expect(spy).not.toHaveBeenCalled();
  });

  it('refetches when asked to force a refresh', async () => {
    await useConverterStore.getState().ensureRates();
    const spy = jest.fn(async () => ({ ok: true, json: async () => BODY }));
    (globalThis as { fetch?: unknown }).fetch = spy as unknown as typeof fetch;
    await useConverterStore.getState().ensureRates(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not flag rates the provider set today as outdated', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ ...BODY, time_last_update_unix: Math.floor(Date.now() / 1000) }),
    }));
    await useConverterStore.getState().ensureRates();
    expect(useConverterStore.getState().ratesOutdated).toBe(false);
  });

  it('flags rates the provider set days ago, decided when the table is set', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ ...BODY, time_last_update_unix: Math.floor(Date.now() / 1000) - 5 * 86_400 }),
    }));
    await useConverterStore.getState().ensureRates();
    const s = useConverterStore.getState();
    expect(s.ratesStatus).toBe('ready');
    expect(s.ratesOutdated).toBe(true);
  });

  it('does not flag anything outdated when there are no rates at all', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });
    await useConverterStore.getState().ensureRates();
    expect(useConverterStore.getState().ratesOutdated).toBe(false);
  });
});
