import { FREE_PIN_LIMIT, canAddPin, conversionKey, countConversion, pinKey, togglePinIn } from '../session';

describe('conversionKey', () => {
  it('is stable for the same conversion', () => {
    expect(conversionKey(2, 'm', 'ft')).toBe(conversionKey(2, 'm', 'ft'));
  });

  it('differs when the value differs', () => {
    expect(conversionKey(2, 'm', 'ft')).not.toBe(conversionKey(3, 'm', 'ft'));
  });

  it('differs when the direction is reversed', () => {
    expect(conversionKey(2, 'm', 'ft')).not.toBe(conversionKey(2, 'ft', 'm'));
  });
});

describe('countConversion', () => {
  const start = { count: 0, lastKey: null };

  it('counts a first conversion', () => {
    expect(countConversion(start, 'a')).toEqual({ count: 1, lastKey: 'a' });
  });

  it('does not count the same conversion twice in a row', () => {
    const once = countConversion(start, 'a');
    expect(countConversion(once, 'a')).toEqual(once);
  });

  it('counts again once the conversion changes', () => {
    const a = countConversion(start, 'a');
    expect(countConversion(a, 'b')).toEqual({ count: 2, lastKey: 'b' });
  });

  it('counts a return to an earlier conversion, because the user did the work again', () => {
    const b = countConversion(countConversion(start, 'a'), 'b');
    expect(countConversion(b, 'a')).toEqual({ count: 3, lastKey: 'a' });
  });

  it('ignores an empty key, so a cleared input is not a conversion', () => {
    expect(countConversion(start, '')).toEqual(start);
  });
});

describe('pins', () => {
  const pins = [pinKey('length', 'm', 'ft'), pinKey('mass', 'kg', 'lb')];

  it('builds a key that survives a round trip through storage', () => {
    expect(pinKey('length', 'm', 'ft')).toBe('length:m:ft');
  });

  it('adds a pin that is not there', () => {
    expect(togglePinIn(pins, pinKey('time', 'h', 'min'))).toHaveLength(3);
  });

  it('removes a pin that is', () => {
    expect(togglePinIn(pins, pinKey('length', 'm', 'ft'))).toEqual([pinKey('mass', 'kg', 'lb')]);
  });

  it('keeps the order of the pins it did not touch', () => {
    const next = togglePinIn(pins, pinKey('time', 'h', 'min'));
    expect(next.slice(0, 2)).toEqual(pins);
  });

  it('lets a free user add up to the limit', () => {
    const atLimit = Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `c${i}:a:b`);
    expect(canAddPin(atLimit.slice(0, -1), false)).toBe(true);
    expect(canAddPin(atLimit, false)).toBe(false);
  });

  it('never blocks a premium user', () => {
    const many = Array.from({ length: FREE_PIN_LIMIT + 20 }, (_, i) => `c${i}:a:b`);
    expect(canAddPin(many, true)).toBe(true);
  });

  it('always allows removing an existing pin, even at the limit', () => {
    const atLimit = Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `c${i}:a:b`);
    expect(togglePinIn(atLimit, 'c0:a:b')).toHaveLength(FREE_PIN_LIMIT - 1);
  });
});
