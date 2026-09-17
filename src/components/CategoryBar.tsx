import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/ui';
import { t, type TranslationKey } from '@/i18n';
import { CATEGORIES, type CategoryId } from '@/logic/units';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

/** Category id -> its label key. Explicit, so a new category fails to compile without a label. */
const LABEL_KEY: Record<CategoryId, TranslationKey> = {
  length: 'catLength',
  mass: 'catMass',
  temperature: 'catTemperature',
  volume: 'catVolume',
  speed: 'catSpeed',
  area: 'catArea',
  data: 'catData',
  time: 'catTime',
  currency: 'catCurrency',
};

export function categoryLabel(id: CategoryId): string {
  return t(LABEL_KEY[id]);
}

interface Props {
  active: CategoryId;
  onSelect: (id: CategoryId) => void;
}

/**
 * The horizontal category chips.
 *
 * Nine categories do not fit on any phone, so this scrolls — and scrolls the active chip back
 * into view when the category changes from somewhere else (a pin tap), which is the case that
 * otherwise leaves the user looking at a selection they cannot see.
 */
export function CategoryBar({ active, onSelect }: Props) {
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  // On a tablet the chips very nearly fit the content column, so the scroll
  // view clipped one mid-word at the right edge -- "Da..." for Data -- with
  // visible room around it. A row that is one chip short of fitting does not
  // read as scrollable, it reads as broken. Given the width, wrap instead.
  const isTablet = width >= 700;
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<CategoryId, number>>>({});

  const measure = useCallback((id: CategoryId, x: number) => {
    offsets.current[id] = x;
  }, []);

  React.useEffect(() => {
    const x = offsets.current[active];
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [active]);

  const chips = (
    <>
      {CATEGORIES.map((category) => {
        const selected = category.id === active;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={categoryLabel(category.id)}
            onLayout={(e) => measure(category.id, e.nativeEvent.layout.x)}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(category.id);
            }}
            android_ripple={{ color: withAlpha(colors.accent, 0.14) }}
            style={({ pressed }) => [
              styles.chip,
              {
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: spacing.base,
                gap: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather
              name={category.icon as keyof typeof Feather.glyphMap}
              size={15}
              color={selected ? colors.onAccent : colors.textMuted}
            />
            <Text variant="callout" color={selected ? colors.onAccent : colors.text}>
              {categoryLabel(category.id)}
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  if (isTablet) {
    return (
      <View
        style={[
          styles.row,
          styles.wrap,
          { paddingHorizontal: spacing.base, gap: spacing.sm },
        ]}
      >
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: spacing.base, gap: spacing.sm }]}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  // Wrapping needs an explicit row direction; a View defaults to column.
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
