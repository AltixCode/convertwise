import { SUPPORTED_LANGUAGES } from '../index';
import { UNIT_NAMES, unitName } from '../units';
import { CATEGORIES } from '@/logic/units';

const STATIC_UNIT_IDS = CATEGORIES.filter((c) => c.id !== 'currency').flatMap((c) =>
  c.units.map((u) => u.id),
);

describe('unit name coverage', () => {
  it('covers every supported language', () => {
    expect(Object.keys(UNIT_NAMES).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it.each(SUPPORTED_LANGUAGES)('%s names every unit', (language) => {
    const missing = STATIC_UNIT_IDS.filter((id) => !UNIT_NAMES[language][id]?.trim());
    expect(missing).toEqual([]);
  });

  it.each(SUPPORTED_LANGUAGES)('%s names no unit that does not exist', (language) => {
    const extra = Object.keys(UNIT_NAMES[language]).filter((id) => !STATIC_UNIT_IDS.includes(id));
    expect(extra).toEqual([]);
  });

  it('actually translates — no language is a copy of English', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      if (language === 'en') continue;
      const identical = STATIC_UNIT_IDS.filter((id) => UNIT_NAMES[language][id] === UNIT_NAMES.en[id]);
      // Some names genuinely are the same word (Acre, Kelvin, Bit, Stone). A language where
      // *most* names match English is an untranslated block, and that is the defect.
      expect(identical.length).toBeLessThan(STATIC_UNIT_IDS.length / 2);
    }
  });
});

describe('unitName', () => {
  it('returns the name for the requested language', () => {
    expect(unitName('km', 'de')).toBe('Kilometer');
    expect(unitName('km', 'ja')).toBe('キロメートル');
  });

  it('falls back to English for an unknown language rather than showing the id', () => {
    expect(unitName('km', 'xx' as never)).toBe('Kilometre');
  });

  it('returns an empty string for a unit with no name, so the UI shows the symbol alone', () => {
    expect(unitName('USD')).toBe('');
  });
});
