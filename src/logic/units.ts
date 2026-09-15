/**
 * The conversion engine. Pure, dependency-free and side-effect-free, so every factor in it is
 * unit-testable and so it runs identically under Jest, Hermes and plain Node.
 *
 * Every unit is stored as an affine map onto its category's base unit:
 *
 *     base = value * factor + offset          fromBase = (base - offset) / factor
 *
 * Multiplicative units simply carry `offset: 0`. Temperature is the only category that needs
 * the offset, and treating it as a special case is exactly how converters end up reporting
 * 0 °C as 0 °F.
 *
 * Factors are the exact international definitions (an inch is 25.4 mm *by definition*, a pound
 * is 0.45359237 kg *by definition*), never a rounded approximation — a converter whose answer
 * is visibly wrong in the fourth digit is a converter nobody keeps.
 */

export type CategoryId =
  | 'length' | 'mass' | 'temperature' | 'volume'
  | 'speed' | 'area' | 'data' | 'time' | 'currency';

export interface Unit {
  /** Stable id. Persisted in the user's pins, so it must never be renamed. */
  id: string;
  category: CategoryId;
  /** Symbol shown in the UI. Deliberately not localized: symbols are international. */
  symbol: string;
  /** Multiplier onto the category's base unit. */
  factor: number;
  /** Additive term onto the category's base unit. Zero for every unit but temperature. */
  offset?: number;
}

export interface Category {
  id: CategoryId;
  /** Feather icon name for the category chip. */
  icon: string;
  units: Unit[];
}

/** Builds a category's units, stamping the category id onto each so lookups carry it. */
function category(id: CategoryId, icon: string, units: Omit<Unit, 'category'>[]): Category {
  return { id, icon, units: units.map((u) => ({ ...u, category: id })) };
}

export const CATEGORIES: Category[] = [
  // Base: metre.
  category('length', 'maximize-2', [
    { id: 'mm', symbol: 'mm', factor: 0.001 },
    { id: 'cm', symbol: 'cm', factor: 0.01 },
    { id: 'm', symbol: 'm', factor: 1 },
    { id: 'km', symbol: 'km', factor: 1000 },
    { id: 'in', symbol: 'in', factor: 0.0254 },
    { id: 'ft', symbol: 'ft', factor: 0.3048 },
    { id: 'yd', symbol: 'yd', factor: 0.9144 },
    { id: 'mi', symbol: 'mi', factor: 1609.344 },
    { id: 'nmi', symbol: 'nmi', factor: 1852 },
  ]),
  // Base: kilogram.
  category('mass', 'package', [
    { id: 'mg', symbol: 'mg', factor: 0.000001 },
    { id: 'g', symbol: 'g', factor: 0.001 },
    { id: 'kg', symbol: 'kg', factor: 1 },
    { id: 't', symbol: 't', factor: 1000 },
    { id: 'oz', symbol: 'oz', factor: 0.028349523125 },
    { id: 'lb', symbol: 'lb', factor: 0.45359237 },
    { id: 'st', symbol: 'st', factor: 6.35029318 },
  ]),
  // Base: degree Celsius. The one category where `offset` is not zero.
  category('temperature', 'thermometer', [
    { id: 'c', symbol: '°C', factor: 1, offset: 0 },
    { id: 'f', symbol: '°F', factor: 5 / 9, offset: (-32 * 5) / 9 },
    { id: 'k', symbol: 'K', factor: 1, offset: -273.15 },
  ]),
  // Base: litre.
  category('volume', 'droplet', [
    { id: 'ml', symbol: 'ml', factor: 0.001 },
    { id: 'l', symbol: 'l', factor: 1 },
    { id: 'm3', symbol: 'm³', factor: 1000 },
    { id: 'tspUs', symbol: 'tsp', factor: 0.00492892159375 },
    { id: 'tbspUs', symbol: 'tbsp', factor: 0.01478676478125 },
    { id: 'flOzUs', symbol: 'fl oz', factor: 0.0295735295625 },
    { id: 'cupUs', symbol: 'cup', factor: 0.2365882365 },
    { id: 'ptUs', symbol: 'pt', factor: 0.473176473 },
    { id: 'qtUs', symbol: 'qt', factor: 0.946352946 },
    { id: 'galUs', symbol: 'gal', factor: 3.785411784 },
    { id: 'flOzUk', symbol: 'fl oz (UK)', factor: 0.0284130625 },
    { id: 'ptUk', symbol: 'pt (UK)', factor: 0.56826125 },
    { id: 'galUk', symbol: 'gal (UK)', factor: 4.54609 },
  ]),
  // Base: metre per second.
  category('speed', 'wind', [
    { id: 'mps', symbol: 'm/s', factor: 1 },
    { id: 'kph', symbol: 'km/h', factor: 1 / 3.6 },
    { id: 'mph', symbol: 'mph', factor: 0.44704 },
    { id: 'fps', symbol: 'ft/s', factor: 0.3048 },
    { id: 'knot', symbol: 'kn', factor: 1852 / 3600 },
  ]),
  // Base: square metre.
  category('area', 'square', [
    { id: 'mm2', symbol: 'mm²', factor: 0.000001 },
    { id: 'cm2', symbol: 'cm²', factor: 0.0001 },
    { id: 'm2', symbol: 'm²', factor: 1 },
    { id: 'ha', symbol: 'ha', factor: 10000 },
    { id: 'km2', symbol: 'km²', factor: 1000000 },
    { id: 'in2', symbol: 'in²', factor: 0.00064516 },
    { id: 'ft2', symbol: 'ft²', factor: 0.09290304 },
    { id: 'yd2', symbol: 'yd²', factor: 0.83612736 },
    { id: 'acre', symbol: 'ac', factor: 4046.8564224 },
    { id: 'mi2', symbol: 'mi²', factor: 2589988.110336 },
  ]),
  // Base: byte. Decimal (kB) and binary (KiB) prefixes both, because a storage vendor and an
  // operating system disagree about the same disk and users come here to settle it.
  category('data', 'hard-drive', [
    { id: 'bit', symbol: 'bit', factor: 0.125 },
    { id: 'b', symbol: 'B', factor: 1 },
    { id: 'kb', symbol: 'kB', factor: 1e3 },
    { id: 'mb', symbol: 'MB', factor: 1e6 },
    { id: 'gb', symbol: 'GB', factor: 1e9 },
    { id: 'tb', symbol: 'TB', factor: 1e12 },
    { id: 'kib', symbol: 'KiB', factor: 1024 },
    { id: 'mib', symbol: 'MiB', factor: 1024 ** 2 },
    { id: 'gib', symbol: 'GiB', factor: 1024 ** 3 },
    { id: 'tib', symbol: 'TiB', factor: 1024 ** 4 },
  ]),
  // Base: second. A month is the mean Gregorian month and a year the mean Gregorian year;
  // there is no single correct answer and this is the one every other converter uses.
  category('time', 'clock', [
    { id: 'ms', symbol: 'ms', factor: 0.001 },
    { id: 's', symbol: 's', factor: 1 },
    { id: 'min', symbol: 'min', factor: 60 },
    { id: 'h', symbol: 'h', factor: 3600 },
    { id: 'd', symbol: 'd', factor: 86400 },
    { id: 'wk', symbol: 'wk', factor: 604800 },
    { id: 'mo', symbol: 'mo', factor: 2629746 },
    { id: 'yr', symbol: 'yr', factor: 31556952 },
  ]),
  // Units are injected at runtime from the cached exchange rates; there is nothing static to
  // put here, and a bundled rate would be a wrong rate the moment it shipped.
  category('currency', 'dollar-sign', []),
];

export const CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

const BY_ID = new Map<string, Unit>(
  CATEGORIES.flatMap((c) => c.units).map((u) => [u.id, u]),
);

export function unitById(id: string): Unit | undefined {
  return BY_ID.get(id);
}

export function unitsIn(id: CategoryId): Unit[] {
  return CATEGORIES.find((c) => c.id === id)?.units ?? [];
}

/** The unit a category opens on, and the one it converts into by default. */
export const DEFAULT_PAIR: Record<CategoryId, [string, string]> = {
  length: ['m', 'ft'],
  mass: ['kg', 'lb'],
  temperature: ['c', 'f'],
  volume: ['l', 'galUs'],
  speed: ['kph', 'mph'],
  area: ['m2', 'ft2'],
  data: ['gb', 'gib'],
  time: ['h', 'min'],
  currency: ['USD', 'EUR'],
};

/**
 * Converts between two units of the same category.
 *
 * Throws rather than guessing: a cross-category conversion has no right answer, and returning
 * the input unchanged (the tempting fallback) produces a number that looks correct and is not.
 */
export function convert(value: number, fromId: string, toId: string): number {
  if (fromId === toId) return value;
  const from = BY_ID.get(fromId);
  const to = BY_ID.get(toId);
  if (!from) throw new Error(`Unknown unit: ${fromId}`);
  if (!to) throw new Error(`Unknown unit: ${toId}`);
  if (from.category !== to.category) {
    throw new Error(`Cannot convert ${fromId} to ${toId}: different categories`);
  }
  const base = value * from.factor + (from.offset ?? 0);
  return (base - (to.offset ?? 0)) / to.factor;
}

/**
 * Reads what the user typed. Everything a number pad can produce has to map to something, and
 * a partially typed number ("", "-", "12.") must read as a usable value rather than NaN, or
 * the result field flickers empty between keystrokes.
 */
export function parseInput(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.' || normalized === '-' || normalized === '-.') {
    return 0;
  }
  return Number(normalized);
}

/** Significant digits kept before the result stops being readable. */
const SIGNIFICANT_DIGITS = 12;

/**
 * Renders a result without floating-point noise.
 *
 * `1 ft` in metres is 0.30480000000000003 in IEEE754, and printing that is the single most
 * visible way a converter looks broken. Rounding to twelve significant digits removes the
 * artefact while staying far more precise than any real use of this app.
 */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';

  const magnitude = Math.abs(value);
  if (magnitude >= 1e21 || magnitude < 1e-9) {
    return value.toExponential(6).replace(/\.?0+e/, 'e');
  }

  // toPrecision, then Number() to drop the trailing zeros it pads with.
  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}
