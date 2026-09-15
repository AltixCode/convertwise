import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Feather from '@expo/vector-icons/Feather';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { unitName } from '@/i18n/units';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';
import { useConverterStore } from '@/store/useConverterStore';

/**
 * The unit picker.
 *
 * A full screen rather than a native picker wheel: currency has 160+ entries, and a wheel is
 * unusable past about a dozen. Search matches the symbol *and* the localized name, so a German
 * user finds "Meile" and an English one finds "mi" — matching only one of the two is how a
 * translated app becomes unsearchable in its own language.
 */
export default function UnitPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();
  const params = useLocalSearchParams<{ side?: string }>();
  const side = params.side === 'to' ? 'to' : 'from';

  const category = useConverterStore((s) => s.category);
  const fromUnit = useConverterStore((s) => s.fromUnit);
  const toUnit = useConverterStore((s) => s.toUnit);
  const unitsForCategory = useConverterStore((s) => s.unitsForCategory);
  const setFrom = useConverterStore((s) => s.setFrom);
  const setTo = useConverterStore((s) => s.setTo);

  const [query, setQuery] = useState('');
  const selected = side === 'from' ? fromUnit : toUnit;
  const units = unitsForCategory(category);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return units;
    return units.filter(
      (u) =>
        u.symbol.toLocaleLowerCase().includes(needle) ||
        u.id.toLocaleLowerCase().includes(needle) ||
        unitName(u.id).toLocaleLowerCase().includes(needle),
    );
  }, [units, query]);

  const choose = (id: string) => {
    void Haptics.selectionAsync();
    if (side === 'from') setFrom(id);
    else setTo(id);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={[styles.header, { padding: spacing.base, gap: spacing.md }]}>
        <Text variant="heading" style={styles.grow}>
          {t('chooseUnit')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={() => router.back()}
          hitSlop={8}
          style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.md }}>
        <View
          style={[
            styles.search,
            {
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
              minHeight: MIN_TOUCH_TARGET,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchUnits')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('searchUnits')}
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.xl }}
        ListEmptyComponent={
          <Text variant="body" tone="muted" style={{ paddingVertical: spacing.xl }}>
            {t('noUnitsFound')}
          </Text>
        }
        renderItem={({ item }) => {
          const isSelected = item.id === selected;
          const name = unitName(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={name ? `${item.symbol}, ${name}` : item.symbol}
              onPress={() => choose(item.id)}
              android_ripple={{ color: withAlpha(colors.accent, 0.14) }}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: MIN_TOUCH_TARGET + 8,
                  paddingHorizontal: spacing.base,
                  gap: spacing.base,
                  borderRadius: radius.md,
                  backgroundColor: isSelected ? withAlpha(colors.accent, 0.14) : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text variant="bodyStrong" style={styles.symbol} numberOfLines={1}>
                {item.symbol}
              </Text>
              <Text variant="body" tone="muted" style={styles.grow} numberOfLines={1}>
                {name}
              </Text>
              {isSelected ? <Feather name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  symbol: { minWidth: 72 },
});
