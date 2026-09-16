import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { CategoryBar, categoryLabel } from '@/components/CategoryBar';
import { UnitField } from '@/components/UnitField';
import { Button, Text } from '@/components/ui';
import { getDeviceLanguage, t } from '@/i18n';
import { unitName } from '@/i18n/units';
import { formatRatesAsOf } from '@/logic/currency';
import { shouldShowInterstitial } from '@/monetization/adPolicy';
import { shouldShowAds } from '@/monetization/entitlements';
import { showInterstitial } from '@/monetization/interstitial';
import { useConverterStore } from '@/store/useConverterStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';
import { useTabletColumn } from '@/theme/useTabletColumn';
import type { CategoryId } from '@/logic/units';

/**
 * How long the input must be quiet before the conversion counts as one the user made.
 * Every keystroke re-converts; counting keystrokes would show an interstitial within seconds.
 */
const SETTLE_MS = 900;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();
  const tabletColumn = useTabletColumn();

  const category = useConverterStore((s) => s.category);
  const fromUnit = useConverterStore((s) => s.fromUnit);
  const toUnit = useConverterStore((s) => s.toUnit);
  const input = useConverterStore((s) => s.input);
  const pins = useConverterStore((s) => s.pins);
  const rates = useConverterStore((s) => s.rates);
  const ratesStatus = useConverterStore((s) => s.ratesStatus);
  const ratesOutdated = useConverterStore((s) => s.ratesOutdated);

  const setInput = useConverterStore((s) => s.setInput);
  const setCategory = useConverterStore((s) => s.setCategory);
  const swap = useConverterStore((s) => s.swap);
  const settle = useConverterStore((s) => s.settle);
  const togglePin = useConverterStore((s) => s.togglePin);
  const applyPin = useConverterStore((s) => s.applyPin);
  const hydrate = useConverterStore((s) => s.hydrate);
  const ensureRates = useConverterStore((s) => s.ensureRates);
  const unitsForCategory = useConverterStore((s) => s.unitsForCategory);

  const isPremium = usePremiumStore((s) => s.isPremium);
  const isReady = usePremiumStore((s) => s.isReady);

  const [copied, setCopied] = useState(false);
  const lastInterstitialAt = useRef(0);

  const result = useConverterStore((s) => s.result)();
  const units = unitsForCategory(category);
  const symbolFor = useCallback(
    (id: string) => units.find((u) => u.id === id)?.symbol ?? id,
    [units],
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Rates are fetched only when the user actually opens the currency tab. Everything else in
  // the app is offline, and fetching on launch would spend data the user never asked to spend.
  useEffect(() => {
    if (category === 'currency') void ensureRates();
  }, [category, ensureRates]);

  useEffect(() => {
    if (input.trim() === '') return;
    const timer = setTimeout(settle, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [input, fromUnit, toUnit, settle]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  /**
   * The interstitial runs when the user starts a *new* conversion task, never over a result.
   *
   * A live converter has no "done" moment to sit behind — the answer is the screen. Covering it
   * would hide the very thing the user came for, so the ad goes at the front of the next task
   * instead, which is the same shape NetPulse uses for the same reason.
   */
  const handleCategory = (next: CategoryId) => {
    if (next === category) return;
    const { conversions } = useConverterStore.getState();
    if (
      shouldShowAds({ isPremium, isReady }) &&
      shouldShowInterstitial({
        gamesPlayed: conversions.count,
        lastInterstitialAt: lastInterstitialAt.current,
        now: Date.now(),
        adsRemoved: isPremium,
      }) &&
      showInterstitial()
    ) {
      lastInterstitialAt.current = Date.now();
    }
    setCategory(next);
  };

  const handleCopy = async () => {
    if (result === '') return;
    await Clipboard.setStringAsync(result);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  const pinKeyHere = `${category}:${fromUnit}:${toUnit}`;
  const isPinned = pins.includes(pinKeyHere);

  const handlePin = () => {
    const outcome = togglePin(isPremium);
    if (outcome === 'limit-reached') {
      Alert.alert(t('pinLimitTitle'), t('pinLimitBody'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('removeAdsCta'), onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pinRows = useMemo(
    () =>
      pins.map((key) => {
        const [cat, from, to] = key.split(':');
        return { key, cat: cat as CategoryId, from, to };
      }),
    [pins],
  );

  const currencyUnavailable = category === 'currency' && ratesStatus === 'error';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + spacing.base, paddingBottom: spacing.xl ,
          ...tabletColumn,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.titleRow, { paddingHorizontal: spacing.base, marginBottom: spacing.base }]}>
          <Text variant="title" style={styles.grow}>
            {t('appName')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settingsTitle')}
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={styles.iconSlot}
          >
            <Feather name="settings" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <CategoryBar active={category} onSelect={handleCategory} />

        <View style={{ padding: spacing.base, gap: spacing.md }}>
          {currencyUnavailable ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.base,
                gap: spacing.md,
              }}
            >
              <Text variant="body" tone="muted">
                {t('ratesUnavailable')}
              </Text>
              <Button label={t('ratesRetry')} variant="secondary" onPress={() => void ensureRates(true)} />
            </View>
          ) : (
            <>
              <UnitField
                label={t('fromLabel')}
                unitId={fromUnit}
                symbol={symbolFor(fromUnit)}
                value={input}
                onChangeValue={setInput}
                onPressUnit={() => router.push({ pathname: '/units', params: { side: 'from' } })}
                unitButtonLabel={`${t('fromLabel')}: ${unitName(fromUnit) || symbolFor(fromUnit)}`}
              />

              <View style={[styles.swapRow, { gap: spacing.md }]}>
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('swapUnits')}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    swap();
                  }}
                  android_ripple={{ color: withAlpha(colors.accent, 0.2), borderless: true, radius: 24 }}
                  style={({ pressed }) => [
                    styles.swapButton,
                    {
                      borderRadius: radius.full,
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="repeat" size={18} color={colors.accent} />
                </Pressable>
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
              </View>

              <UnitField
                label={t('toLabel')}
                unitId={toUnit}
                symbol={symbolFor(toUnit)}
                value={result}
                onPressUnit={() => router.push({ pathname: '/units', params: { side: 'to' } })}
                unitButtonLabel={`${t('toLabel')}: ${unitName(toUnit) || symbolFor(toUnit)}`}
              />

              <View style={[styles.actions, { gap: spacing.sm }]}>
                <Button
                  label={copied ? t('copiedTitle') : t('copyResult')}
                  icon={copied ? 'check' : 'copy'}
                  variant="secondary"
                  size="sm"
                  disabled={result === ''}
                  onPress={() => void handleCopy()}
                />
                <Button
                  label={isPinned ? t('pinRemove') : t('pinAdd')}
                  icon={isPinned ? 'star' : 'plus'}
                  variant="ghost"
                  size="sm"
                  onPress={handlePin}
                />
              </View>

              {category === 'currency' && rates ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" tone="faint">
                    {ratesStatus === 'loading'
                      ? t('ratesLoading')
                      : t('ratesAsOf', { when: formatRatesAsOf(rates, getDeviceLanguage()) })}
                  </Text>
                  {ratesOutdated ? (
                    <Text variant="caption" tone="danger">
                      {t('ratesOutdated')}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          {pinRows.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Text variant="micro" tone="faint">
                {t('pinnedHeading').toUpperCase()}
              </Text>
              {pinRows.map((pin) => (
                <Pressable
                  key={pin.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel(pin.cat)}: ${pin.from} → ${pin.to}`}
                  onPress={() => applyPin(pin.key)}
                  android_ripple={{ color: withAlpha(colors.accent, 0.14) }}
                  style={({ pressed }) => [
                    styles.pinRow,
                    {
                      minHeight: MIN_TOUCH_TARGET,
                      paddingHorizontal: spacing.base,
                      gap: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="star" size={14} color={colors.accent} />
                  <Text variant="callout" numberOfLines={1} style={styles.grow}>
                    {pin.from} → {pin.to}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {categoryLabel(pin.cat)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  iconSlot: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  swapRow: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  swapButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pinRow: { flexDirection: 'row', alignItems: 'center' },
});
