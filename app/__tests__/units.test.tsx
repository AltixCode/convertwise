import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import UnitPicker from '../units';
import { setRouteParams, testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { useConverterStore } from '@/store/useConverterStore';

const initial = useConverterStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useConverterStore.setState(initial, true);
  setRouteParams({ side: 'from' });
});

describe('UnitPicker', () => {
  it('lists every unit in the active category', async () => {
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    expect(getByLabelText('m, Metre')).toBeTruthy();
    expect(getByLabelText('nmi, Nautical mile')).toBeTruthy();
  });

  it('lists no unit from another category', async () => {
    const { queryByLabelText } = await renderWithProviders(<UnitPicker />);
    expect(queryByLabelText('kg, Kilogram')).toBeNull();
  });

  it('picks the unit for the requested side and closes', async () => {
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.press(getByLabelText('km, Kilometre'));
    expect(useConverterStore.getState().fromUnit).toBe('km');
    expect(testRouter.back).toHaveBeenCalled();
  });

  it('picks for the "to" side when asked to', async () => {
    setRouteParams({ side: 'to' });
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.press(getByLabelText('km, Kilometre'));
    const s = useConverterStore.getState();
    expect([s.fromUnit, s.toUnit]).toEqual(['m', 'km']);
  });

  it('defaults to the "from" side for a missing or nonsense param', async () => {
    setRouteParams({ side: 'sideways' });
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.press(getByLabelText('km, Kilometre'));
    expect(useConverterStore.getState().fromUnit).toBe('km');
  });

  it('searches by symbol', async () => {
    const { getByLabelText, queryByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.changeText(getByLabelText(t('searchUnits')), 'km');
    await waitFor(() => expect(queryByLabelText('m, Metre')).toBeNull());
    expect(getByLabelText('km, Kilometre')).toBeTruthy();
  });

  it('searches by the localized name, not only the symbol', async () => {
    const { getByLabelText, queryByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.changeText(getByLabelText(t('searchUnits')), 'nautical');
    await waitFor(() => expect(queryByLabelText('m, Metre')).toBeNull());
    expect(getByLabelText('nmi, Nautical mile')).toBeTruthy();
  });

  it('ignores case', async () => {
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.changeText(getByLabelText(t('searchUnits')), 'YARD');
    await waitFor(() => expect(getByLabelText('yd, Yard')).toBeTruthy());
  });

  it('says so when nothing matches, rather than showing an empty screen', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.changeText(getByLabelText(t('searchUnits')), 'zzzz');
    await waitFor(() => expect(getByText(t('noUnitsFound'))).toBeTruthy());
  });

  it('marks the current unit as selected for a screen reader', async () => {
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    expect(getByLabelText('m, Metre').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('km, Kilometre').props.accessibilityState.selected).toBe(false);
  });

  it('closes without changing anything', async () => {
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    await fireEvent.press(getByLabelText(t('close')));
    expect(testRouter.back).toHaveBeenCalled();
    expect(useConverterStore.getState().fromUnit).toBe('m');
  });

  it('lists currencies once rates are loaded', async () => {
    useConverterStore.setState({
      category: 'currency',
      fromUnit: 'USD',
      toUnit: 'EUR',
      rates: { base: 'USD', rates: { USD: 1, EUR: 0.8 }, fetchedAt: 1, ratesAsOf: 1 },
    });
    const { getByLabelText } = await renderWithProviders(<UnitPicker />);
    expect(getByLabelText('EUR')).toBeTruthy();
  });
});
