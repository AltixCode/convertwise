import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { unitName } from '@/i18n/units';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

interface Props {
  label: string;
  unitId: string;
  symbol: string;
  /** The editable side passes a value and a handler; the result side passes neither. */
  value: string;
  onChangeValue?: (text: string) => void;
  onPressUnit: () => void;
  /** Accessibility label for the unit button, already localized. */
  unitButtonLabel: string;
  autoFocus?: boolean;
}

/**
 * One half of the converter: a big number and the unit it is in.
 *
 * The read-only side is a `Text`, not a disabled `TextInput` — a disabled input is announced as
 * a text field the user cannot edit, which is confusing, and it cannot be selected or read at
 * the same size. The number is the answer; it gets the largest type in the app.
 */
export function UnitField({
  label,
  unitId,
  symbol,
  value,
  onChangeValue,
  onPressUnit,
  unitButtonLabel,
  autoFocus = false,
}: Props) {
  const { colors, spacing, radius } = useTheme();
  const name = unitName(unitId);
  const editable = typeof onChangeValue === 'function';

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: spacing.base,
        gap: spacing.sm,
      }}
    >
      <Text variant="micro" tone="faint">
        {label.toUpperCase()}
      </Text>

      <View style={[styles.row, { gap: spacing.base }]}>
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            // `decimal-pad` rather than `numeric`: no scientific-notation keys the parser would
            // have to reject, and the comma/period the locale actually uses.
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus={autoFocus}
            selectTextOnFocus
            placeholder={t('enterValue')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={label}
            maxFontSizeMultiplier={1.4}
            style={[styles.value, { color: colors.text }]}
          />
        ) : (
          <Text
            variant="numeric"
            // Selectable so the answer can be copied by long-press as well as by the button.
            selectable
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.value}
          >
            {value === '' ? '—' : value}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unitButtonLabel}
          onPress={onPressUnit}
          android_ripple={{ color: withAlpha(colors.text, 0.12) }}
          style={({ pressed }) => [
            styles.unitButton,
            {
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: spacing.md,
              gap: spacing.xs,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text variant="bodyStrong">{symbol}</Text>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {name ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1, padding: 0 },
  unitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
