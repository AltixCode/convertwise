import {
  CATEGORIES,
  CATEGORY_IDS,
  convert,
  formatResult,
  parseInput,
  unitsIn,
  unitById,
} from '../units';

describe('the unit tables themselves', () => {
  it('gives every category at least two units, or it cannot convert anything', () => {
    for (const id of CATEGORY_IDS) {
      if (id === 'currency') continue; // populated at runtime from live rates
      expect(unitsIn(id).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has no duplicate unit id anywhere, which would silently shadow a conversion', () => {
    const ids = CATEGORIES.flatMap((c) => c.units.map((u) => u.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every static category exactly one base unit', () => {
    for (const category of CATEGORIES) {
      if (category.id === 'currency') continue; // populated at runtime from live rates
      const bases = category.units.filter((u) => u.factor === 1 && (u.offset ?? 0) === 0);
      expect(bases).toHaveLength(1);
    }
  });

  it('never carries a zero factor, which would divide by zero on the way back', () => {
    for (const category of CATEGORIES) {
      for (const unit of category.units) expect(unit.factor).not.toBe(0);
    }
  });
});

describe('convert — linear units', () => {
  it.each([
    ['m', 'cm', 1, 100],
    ['km', 'm', 2.5, 2500],
    ['mi', 'km', 1, 1.609344],
    ['ft', 'in', 1, 12],
    ['kg', 'g', 1, 1000],
    ['lb', 'kg', 1, 0.45359237],
    ['l', 'ml', 1, 1000],
    ['galUs', 'l', 1, 3.785411784],
    ['h', 'min', 1, 60],
    ['d', 'h', 1, 24],
    ['gib', 'mib', 1, 1024],
    ['gb', 'mb', 1, 1000],
    ['kph', 'mps', 3.6, 1],
    ['ha', 'm2', 1, 10000],
  ])('%s -> %s', (from, to, input, expected) => {
    expect(convert(input, from, to)).toBeCloseTo(expected, 9);
  });

  it('is its own inverse', () => {
    expect(convert(convert(37.5, 'mi', 'km'), 'km', 'mi')).toBeCloseTo(37.5, 9);
  });

  it('returns the input unchanged when both units are the same', () => {
    expect(convert(12.34, 'kg', 'kg')).toBe(12.34);
  });

  it('carries the sign through', () => {
    expect(convert(-5, 'm', 'cm')).toBeCloseTo(-500, 9);
  });

  it('converts zero to zero for a purely multiplicative unit', () => {
    expect(convert(0, 'mi', 'km')).toBe(0);
  });
});

describe('convert — temperature, where the offset matters', () => {
  it.each([
    ['c', 'f', 0, 32],
    ['c', 'f', 100, 212],
    ['c', 'f', -40, -40],
    ['f', 'c', 98.6, 37],
    ['c', 'k', 0, 273.15],
    ['k', 'c', 0, -273.15],
    ['f', 'k', 32, 273.15],
  ])('%s -> %s', (from, to, input, expected) => {
    expect(convert(input, from, to)).toBeCloseTo(expected, 9);
  });

  it('does not treat zero as a fixed point', () => {
    expect(convert(0, 'c', 'f')).not.toBe(0);
  });
});

describe('convert — refusals', () => {
  it('throws across categories rather than returning a plausible wrong number', () => {
    expect(() => convert(1, 'm', 'kg')).toThrow(/different categories/i);
  });

  it('throws on an unknown unit rather than silently returning the input', () => {
    expect(() => convert(1, 'm', 'furlong')).toThrow(/unknown unit/i);
  });

  it('propagates a non-finite input instead of inventing a number', () => {
    expect(Number.isNaN(convert(Number.NaN, 'm', 'cm'))).toBe(true);
  });
});

describe('unitById', () => {
  it('finds a unit and reports its category', () => {
    expect(unitById('mi')?.category).toBe('length');
  });

  it('returns undefined for a unit that does not exist', () => {
    expect(unitById('nope')).toBeUndefined();
  });
});

describe('parseInput', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['', 0],
    ['.', 0],
    ['-', 0],
    ['-3', -3],
    ['0012', 12],
  ])('parses %p as %p', (text, expected) => {
    expect(parseInput(text)).toBe(expected);
  });

  it('accepts a comma decimal separator, which most of Europe types', () => {
    expect(parseInput('12,5')).toBe(12.5);
  });

  it('is NaN for text that is not a number at all', () => {
    expect(Number.isNaN(parseInput('abc'))).toBe(true);
  });
});

describe('formatResult', () => {
  it('does not print floating-point noise', () => {
    // 0.1 + 0.2 territory: 1 ft in m is 0.30480000000000003 in IEEE754.
    expect(formatResult(convert(1, 'ft', 'm'))).toBe('0.3048');
  });

  it('keeps whole numbers whole', () => {
    expect(formatResult(100)).toBe('100');
  });

  it('strips the trailing zeros toPrecision pads with', () => {
    expect(formatResult(0.1 + 0.2)).toBe('0.3');
    expect(formatResult(2.5)).toBe('2.5');
  });

  it('keeps a digit that is real rather than noise', () => {
    // Eleven significant digits: a genuinely distinct number, not an IEEE754 artefact.
    expect(formatResult(2.5000000001)).toBe('2.5000000001');
  });

  it('falls back to exponent notation for a number too large to read', () => {
    expect(formatResult(1.23e21)).toMatch(/e\+?21/i);
  });

  it('keeps enough significant digits for a very small result', () => {
    expect(Number(formatResult(0.000001234))).toBeCloseTo(0.000001234, 12);
  });

  it('returns an empty string for a non-finite value rather than "NaN"', () => {
    expect(formatResult(Number.NaN)).toBe('');
    expect(formatResult(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('prints zero as zero', () => {
    expect(formatResult(0)).toBe('0');
  });

  it('never returns "-0"', () => {
    expect(formatResult(-0)).toBe('0');
  });
});
