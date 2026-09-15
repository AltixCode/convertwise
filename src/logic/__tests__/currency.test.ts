import {
  RATE_MAX_AGE_MS,
  convertCurrency,
  currencyUnits,
  isStale,
  parseRateResponse,
  RATES_OUTDATED_AFTER_MS,
  formatRatesAsOf,
  ratesAreOutdated,
} from '../currency';

const TABLE = {
  base: 'USD',
  rates: { USD: 1, EUR: 0.8, GBP: 0.75, JPY: 150 },
  fetchedAt: 1_700_000_000_000,
  ratesAsOf: 1_699_999_000_000,
};

describe('convertCurrency', () => {
  it('converts through the base currency', () => {
    expect(convertCurrency(100, 'USD', 'EUR', TABLE)).toBeCloseTo(80, 9);
  });

  it('converts between two non-base currencies', () => {
    // 100 EUR -> 125 USD -> 93.75 GBP
    expect(convertCurrency(100, 'EUR', 'GBP', TABLE)).toBeCloseTo(93.75, 9);
  });

  it('is its own inverse', () => {
    expect(convertCurrency(convertCurrency(42, 'JPY', 'GBP', TABLE), 'GBP', 'JPY', TABLE))
      .toBeCloseTo(42, 6);
  });

  it('returns the input unchanged for the same currency', () => {
    expect(convertCurrency(42, 'EUR', 'EUR', TABLE)).toBe(42);
  });

  it('throws on a currency the table does not carry, rather than returning the input', () => {
    expect(() => convertCurrency(1, 'USD', 'XYZ', TABLE)).toThrow(/unknown currency/i);
  });

  it('throws on a zero rate rather than returning Infinity', () => {
    const broken = { ...TABLE, rates: { ...TABLE.rates, BAD: 0 } };
    expect(() => convertCurrency(1, 'BAD', 'USD', broken)).toThrow(/unusable rate/i);
  });
});

describe('isStale', () => {
  it('is fresh immediately after a fetch', () => {
    expect(isStale(TABLE, TABLE.fetchedAt)).toBe(false);
  });

  it('is fresh one millisecond before the cutoff', () => {
    expect(isStale(TABLE, TABLE.fetchedAt + RATE_MAX_AGE_MS - 1)).toBe(false);
  });

  it('is stale exactly at the cutoff', () => {
    expect(isStale(TABLE, TABLE.fetchedAt + RATE_MAX_AGE_MS)).toBe(true);
  });

  it('treats a missing table as stale', () => {
    expect(isStale(null, Date.now())).toBe(true);
  });

  it('treats a clock that has gone backwards as stale rather than fresh forever', () => {
    expect(isStale(TABLE, TABLE.fetchedAt - 60_000)).toBe(true);
  });
});

describe('currencyUnits', () => {
  it('emits one unit per rate, in the currency category', () => {
    const units = currencyUnits(TABLE);
    expect(units).toHaveLength(4);
    expect(units.every((u) => u.category === 'currency')).toBe(true);
  });

  it('uses the ISO code as both id and symbol, because codes are not translated', () => {
    const eur = currencyUnits(TABLE).find((u) => u.id === 'EUR');
    expect(eur?.symbol).toBe('EUR');
  });

  it('sorts alphabetically so the picker is predictable', () => {
    expect(currencyUnits(TABLE).map((u) => u.id)).toEqual(['EUR', 'GBP', 'JPY', 'USD']);
  });

  it('is empty for a missing table rather than throwing', () => {
    expect(currencyUnits(null)).toEqual([]);
  });
});

describe('parseRateResponse', () => {
  const ok = {
    result: 'success',
    base_code: 'USD',
    time_last_update_unix: 1_699_999_000,
    rates: { USD: 1, EUR: 0.8 },
  };

  it('reads a successful response', () => {
    const table = parseRateResponse(ok, 1_700_000_000_000);
    expect(table?.rates.EUR).toBe(0.8);
    expect(table?.base).toBe('USD');
    expect(table?.fetchedAt).toBe(1_700_000_000_000);
  });

  it('carries the provider timestamp, not the fetch time, as "rates as of"', () => {
    expect(parseRateResponse(ok, 1_700_000_000_000)?.ratesAsOf).toBe(1_699_999_000_000);
  });

  it('rejects a response whose result is not success', () => {
    expect(parseRateResponse({ ...ok, result: 'error' }, 1)).toBeNull();
  });

  it('rejects a response with no rates rather than caching an empty table', () => {
    expect(parseRateResponse({ ...ok, rates: {} }, 1)).toBeNull();
  });

  it('rejects a malformed body instead of throwing', () => {
    expect(parseRateResponse(null, 1)).toBeNull();
    expect(parseRateResponse('nope', 1)).toBeNull();
    expect(parseRateResponse({ rates: { EUR: 'x' } }, 1)).toBeNull();
  });

  it('drops a non-finite or negative rate rather than keeping a poisoned entry', () => {
    const table = parseRateResponse(
      { ...ok, rates: { USD: 1, EUR: 0.8, BAD: -1, WORSE: Number.POSITIVE_INFINITY } },
      1,
    );
    expect(Object.keys(table?.rates ?? {}).sort()).toEqual(['EUR', 'USD']);
  });

  it('falls back to the fetch time when the provider sends no timestamp', () => {
    const { time_last_update_unix: _omitted, ...noTime } = ok;
    expect(parseRateResponse(noTime, 1_700_000_000_000)?.ratesAsOf).toBe(1_700_000_000_000);
  });
});

describe('ratesAreOutdated', () => {
  it('is false for rates fetched moments ago', () => {
    expect(ratesAreOutdated(TABLE, TABLE.ratesAsOf + 1000)).toBe(false);
  });

  it('is false one millisecond before the threshold', () => {
    expect(ratesAreOutdated(TABLE, TABLE.ratesAsOf + RATES_OUTDATED_AFTER_MS - 1)).toBe(false);
  });

  it('is true at the threshold', () => {
    expect(ratesAreOutdated(TABLE, TABLE.ratesAsOf + RATES_OUTDATED_AFTER_MS)).toBe(true);
  });

  it('is false without a table, so an app with no rates yet does not warn about them', () => {
    expect(ratesAreOutdated(null, Date.now())).toBe(false);
  });

  it('does not warn when the device clock is behind the provider', () => {
    expect(ratesAreOutdated(TABLE, TABLE.ratesAsOf - 86_400_000)).toBe(false);
  });
});

describe('formatRatesAsOf', () => {
  it('formats the provider moment, not the fetch moment', () => {
    const asOf = formatRatesAsOf(TABLE, 'en-GB');
    expect(asOf).toBe(
      new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        .format(new Date(TABLE.ratesAsOf)),
    );
  });

  it('differs between locales, which is the whole point of using Intl', () => {
    expect(formatRatesAsOf(TABLE, 'en-US')).not.toBe(formatRatesAsOf(TABLE, 'ja-JP'));
  });

  it('is an empty string without a table, so the UI shows no label at all', () => {
    expect(formatRatesAsOf(null, 'en')).toBe('');
  });

  it('still returns something true for a locale tag Intl rejects', () => {
    expect(formatRatesAsOf(TABLE, 'not a locale')).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
