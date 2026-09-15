import { fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import React from 'react';

import Home from '../index';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { FREE_PIN_LIMIT } from '@/logic/session';
import * as interstitial from '@/monetization/interstitial';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { useConverterStore } from '@/store/useConverterStore';
import { usePremiumStore } from '@/store/usePremiumStore';

const RATES_BODY = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: Math.floor(Date.now() / 1000),
  rates: { USD: 1, EUR: 0.8, GBP: 0.75 },
};

const converterInitial = useConverterStore.getState();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useConverterStore.setState(converterInitial, true);
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => RATES_BODY,
  })) as unknown as typeof fetch;
});

// No `jest.restoreAllMocks()` here. It restores every spy in the process, not
// only this file's — including ones the renderer itself relies on.

describe('Home', () => {
  it('renders the app name and routes to settings', async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    expect(getByText(t('appName'))).toBeTruthy();
    await fireEvent.press(getByLabelText(t('settingsTitle')));
    expect(testRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('converts what the user types, live', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('fromLabel')), '2');
    await waitFor(() => expect(getByText('6.56167979003')).toBeTruthy());
  });

  it('shows an em dash rather than a zero before anything is typed', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText('—')).toBeTruthy();
  });

  it('swaps the two units', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('swapUnits')));
    const s = useConverterStore.getState();
    expect([s.fromUnit, s.toUnit]).toEqual(['ft', 'm']);
  });

  it('opens the unit picker for each side', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`${t('fromLabel')}: Metre`));
    expect(testRouter.push).toHaveBeenCalledWith({ pathname: '/units', params: { side: 'from' } });
    await fireEvent.press(getByLabelText(`${t('toLabel')}: Foot`));
    expect(testRouter.push).toHaveBeenCalledWith({ pathname: '/units', params: { side: 'to' } });
  });

  it('switches category', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catTemperature')));
    expect(useConverterStore.getState().category).toBe('temperature');
  });

  it('copies the result and says so', async () => {
    const spy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('fromLabel')), '1');
    await fireEvent.press(getByText(t('copyResult')));
    expect(spy).toHaveBeenCalledWith('3.28083989501');
    await waitFor(() => expect(getByText(t('copiedTitle'))).toBeTruthy());
  });

  it('does not copy an empty result', async () => {
    const spy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('copyResult')));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('pins', () => {
  it('pins the current pair and lists it', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('pinAdd')));
    await waitFor(() => expect(getByText(t('pinnedHeading').toUpperCase())).toBeTruthy());
    expect(useConverterStore.getState().pins).toEqual(['length:m:ft']);
  });

  it('offers the upgrade instead of a fourth pin on the free tier', async () => {
    useConverterStore.setState({
      pins: Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `length:m:x${i}`),
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('pinAdd')));
    expect(alert).toHaveBeenCalledWith(t('pinLimitTitle'), t('pinLimitBody'), expect.any(Array));
    expect(useConverterStore.getState().pins).toHaveLength(FREE_PIN_LIMIT);
  });

  it('lets a premium user past the limit with no interruption', async () => {
    usePremiumStore.setState({ isPremium: true });
    useConverterStore.setState({
      pins: Array.from({ length: FREE_PIN_LIMIT }, (_, i) => `length:m:x${i}`),
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('pinAdd')));
    expect(alert).not.toHaveBeenCalled();
    expect(useConverterStore.getState().pins).toHaveLength(FREE_PIN_LIMIT + 1);
  });

  it('applies a pin when its row is tapped', async () => {
    useConverterStore.setState({ pins: ['mass:kg:lb'] });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`${t('catMass')}: kg → lb`));
    const s = useConverterStore.getState();
    expect([s.category, s.fromUnit, s.toUnit]).toEqual(['mass', 'kg', 'lb']);
  });
});

describe('currency', () => {
  it('fetches rates only once the currency tab is opened', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText(t('catCurrency')));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  it('shows the "rates as of" line once they load', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catCurrency')));
    await waitFor(() =>
      expect(getByText(new RegExp(t('ratesAsOf', { when: '.*' })))).toBeTruthy(),
    );
  });

  it('offers a retry instead of a broken converter when rates cannot be fetched', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catCurrency')));
    await waitFor(() => expect(getByText(t('ratesUnavailable'))).toBeTruthy());
    expect(getByText(t('ratesRetry'))).toBeTruthy();
  });
});

describe('ads', () => {
  it('shows a banner to a free user', async () => {
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).not.toBeNull();
  });

  it('shows no banner to a premium user — the whole point of the upgrade', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).toBeNull();
  });

  it('does not interrupt a user who has barely started', async () => {
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catMass')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('runs an interstitial at the start of the next task, never over a result', async () => {
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    useConverterStore.setState({ conversions: { count: 3, lastKey: 'x' } });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catMass')));
    expect(spy).toHaveBeenCalled();
    // The new category is shown regardless of whether an ad filled.
    expect(useConverterStore.getState().category).toBe('mass');
  });

  it('never interrupts a premium user', async () => {
    usePremiumStore.setState({ isPremium: true });
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    useConverterStore.setState({ conversions: { count: 9, lastKey: 'x' } });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catMass')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not interrupt again immediately after an ad', async () => {
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    useConverterStore.setState({ conversions: { count: 3, lastKey: 'x' } });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('catMass')));
    useConverterStore.setState({ conversions: { count: 6, lastKey: 'y' } });
    await fireEvent.press(getByLabelText(t('catTime')));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
