/**
 * The converter's whole state: which category and pair are active, what the user typed, the
 * pinned pairs, and the cached exchange-rate table.
 *
 * All of the arithmetic and all of the rules live in `src/logic/`; this store only holds state
 * and sequences the async work. That split is what lets the conversion factors, the free-tier
 * pin cap and the ad cadence be tested without rendering anything.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  convertCurrency,
  currencyUnits,
  isStale,
  ratesAreOutdated,
  type RateTable,
} from '@/logic/currency';
import {
  canAddPin,
  conversionKey,
  countConversion,
  pinKey,
  togglePinIn,
  type ConversionCount,
} from '@/logic/session';
import {
  CATEGORY_IDS,
  DEFAULT_PAIR,
  convert,
  formatResult,
  parseInput,
  unitById,
  unitsIn,
  type CategoryId,
  type Unit,
} from '@/logic/units';
import { loadCachedRates, refreshRates } from '@/services/rates';

export const CONVERTER_CACHE_KEY = 'convertwise.state.v1';

export type RatesStatus = 'idle' | 'loading' | 'ready' | 'error';
export type PinResult = 'pinned' | 'unpinned' | 'limit-reached';

interface ConverterState {
  category: CategoryId;
  fromUnit: string;
  toUnit: string;
  /** Exactly what the user typed, not a parsed number — a half-typed "1." must survive. */
  input: string;
  /** The pair last used in each category, so returning to one resumes where it was left. */
  lastPair: Partial<Record<CategoryId, [string, string]>>;
  pins: string[];
  conversions: ConversionCount;
  rates: RateTable | null;
  ratesStatus: RatesStatus;
  /**
   * Whether the rates on screen are old enough to warn about, decided when the table is set.
   *
   * Not derived at render: `Date.now()` is impure and React's purity rule rejects calling it
   * during a render, and the answer only ever changes when the table does.
   */
  ratesOutdated: boolean;

  unitsForCategory: (id: CategoryId) => Unit[];
  result: () => string;

  setCategory: (id: CategoryId) => void;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
  swap: () => void;
  setInput: (text: string) => void;
  /** Marks the current conversion as one the user actually made. Drives the ad cadence. */
  settle: () => void;

  togglePin: (isPremium: boolean) => PinResult;
  applyPin: (key: string) => void;

  ensureRates: (force?: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

/** Guards against two screens racing the same fetch on mount. */
let inFlight: Promise<void> | null = null;

interface PersistedShape {
  category?: unknown;
  fromUnit?: unknown;
  toUnit?: unknown;
  lastPair?: unknown;
  pins?: unknown;
}

export const useConverterStore = create<ConverterState>((set, get) => ({
  category: 'length',
  fromUnit: DEFAULT_PAIR.length[0],
  toUnit: DEFAULT_PAIR.length[1],
  input: '',
  lastPair: {},
  pins: [],
  conversions: { count: 0, lastKey: null },
  rates: null,
  ratesStatus: 'idle',
  ratesOutdated: false,

  unitsForCategory: (id) => (id === 'currency' ? currencyUnits(get().rates) : unitsIn(id)),

  result: () => {
    const { input, fromUnit, toUnit, category, rates } = get();
    if (input.trim() === '') return '';
    const value = parseInput(input);
    if (!Number.isFinite(value)) return '';
    try {
      const converted =
        category === 'currency'
          ? rates
            ? convertCurrency(value, fromUnit, toUnit, rates)
            : Number.NaN
          : convert(value, fromUnit, toUnit);
      return formatResult(converted);
    } catch {
      // A pair that cannot convert shows nothing. Returning the input would be a wrong answer
      // presented as a right one, which is the failure this whole app exists to avoid.
      return '';
    }
  },

  setCategory: (id) => {
    if (!CATEGORY_IDS.includes(id)) return;
    const { lastPair } = get();
    const [from, to] = lastPair[id] ?? DEFAULT_PAIR[id];
    set({ category: id, fromUnit: from, toUnit: to });
    void get().persist();
  },

  setFrom: (id) => {
    const { category } = get();
    // A unit from another category would convert to a plausible, wrong number.
    if (!get().unitsForCategory(category).some((u) => u.id === id)) return;
    set((s) => ({ fromUnit: id, lastPair: { ...s.lastPair, [category]: [id, s.toUnit] } }));
    void get().persist();
  },

  setTo: (id) => {
    const { category } = get();
    if (!get().unitsForCategory(category).some((u) => u.id === id)) return;
    set((s) => ({ toUnit: id, lastPair: { ...s.lastPair, [category]: [s.fromUnit, id] } }));
    void get().persist();
  },

  swap: () => {
    const { fromUnit, toUnit, category } = get();
    // Carry the result across, so swapping reads as "now go the other way from here" rather
    // than resetting the number the user just typed.
    const carried = get().result();
    set((s) => ({
      fromUnit: toUnit,
      toUnit: fromUnit,
      input: carried === '' ? s.input : carried,
      lastPair: { ...s.lastPair, [category]: [toUnit, fromUnit] },
    }));
    void get().persist();
  },

  setInput: (text) => set({ input: text }),

  settle: () => {
    const { input, fromUnit, toUnit } = get();
    const value = parseInput(input);
    if (input.trim() === '' || !Number.isFinite(value)) return;
    set((s) => ({ conversions: countConversion(s.conversions, conversionKey(value, fromUnit, toUnit)) }));
  },

  togglePin: (isPremium) => {
    const { category, fromUnit, toUnit, pins } = get();
    const key = pinKey(category, fromUnit, toUnit);
    const removing = pins.includes(key);
    if (!removing && !canAddPin(pins, isPremium)) return 'limit-reached';
    set({ pins: togglePinIn(pins, key) });
    void get().persist();
    return removing ? 'unpinned' : 'pinned';
  },

  applyPin: (key) => {
    const [category, from, to] = key.split(':');
    if (!CATEGORY_IDS.includes(category as CategoryId)) return;
    const id = category as CategoryId;
    const known = get().unitsForCategory(id);
    if (!known.some((u) => u.id === from) || !known.some((u) => u.id === to)) return;
    set((s) => ({ category: id, fromUnit: from, toUnit: to, lastPair: { ...s.lastPair, [id]: [from, to] } }));
    void get().persist();
  },

  ensureRates: async (force = false) => {
    if (inFlight) return inFlight;
    const run = async () => {
      const settle = (table: RateTable) =>
        set({ rates: table, ratesStatus: 'ready', ratesOutdated: ratesAreOutdated(table, Date.now()) });

      const cached = get().rates ?? (await loadCachedRates());
      if (cached && !force && !isStale(cached, Date.now())) {
        settle(cached);
        return;
      }
      set({ ratesStatus: 'loading' });
      const fresh = await refreshRates();
      if (fresh) {
        settle(fresh);
        return;
      }
      // The fetch failed. A stale cached table is still a working converter with an honest
      // "rates as of" label; only a genuinely empty cache is an error state.
      if (cached) settle(cached);
      else set({ ratesStatus: 'error' });
    };
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CONVERTER_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedShape;
      const pins = Array.isArray(parsed.pins) ? parsed.pins.filter((p): p is string => typeof p === 'string') : [];
      const lastPair =
        typeof parsed.lastPair === 'object' && parsed.lastPair !== null
          ? (parsed.lastPair as ConverterState['lastPair'])
          : {};

      // A category or unit that no longer exists — an app update that dropped one — must not
      // leave the screen pointing at nothing.
      const category = CATEGORY_IDS.includes(parsed.category as CategoryId)
        ? (parsed.category as CategoryId)
        : 'length';
      const [defaultFrom, defaultTo] = lastPair[category] ?? DEFAULT_PAIR[category];
      const valid = (id: unknown, fallback: string) =>
        typeof id === 'string' && (category === 'currency' || unitById(id)?.category === category)
          ? id
          : fallback;

      set({
        category,
        pins,
        lastPair,
        fromUnit: valid(parsed.fromUnit, defaultFrom),
        toUnit: valid(parsed.toUnit, defaultTo),
      });
    } catch {
      // Corrupt stored state starts clean rather than crashing on launch.
    }
  },

  persist: async () => {
    const { category, fromUnit, toUnit, lastPair, pins } = get();
    try {
      await AsyncStorage.setItem(
        CONVERTER_CACHE_KEY,
        JSON.stringify({ category, fromUnit, toUnit, lastPair, pins }),
      );
    } catch {
      // Losing the last pair costs the user one tap next launch.
    }
  },
}));
