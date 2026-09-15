import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

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
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<CategoryId, number>>>({});

  const measure = useCallback((id: CategoryId, x: number) => {
    offsets.current[id] = x;
  }, []);

  React.useEffect(() => {
    const x = offsets.current[active];
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: spacing.base, gap: spacing.sm }]}
    >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
