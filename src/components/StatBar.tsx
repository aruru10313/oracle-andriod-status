// ============================================================
// StatBar — animated horizontal stat bar
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../theme';

interface Props {
  label: string;
  value: number;       // 0–100 (percent)
  color?: string;
  unit?: string;       // e.g. "%" or "GB"
  subLabel?: string;   // e.g. "3.2 / 16 GB"
}

const StatBar: React.FC<Props> = ({
  label,
  value,
  color = Colors.accent,
  unit = '%',
  subLabel,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: clampedValue,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  }, [clampedValue]);

  const barColor = (() => {
    if (clampedValue >= 90) return Colors.offline;
    if (clampedValue >= 70) return Colors.warning;
    return color;
  })();

  const widthPercent = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: barColor }]}>
          {clampedValue.toFixed(0)}{unit}
        </Text>
      </View>

      {subLabel && (
        <Text style={styles.subLabel}>{subLabel}</Text>
      )}

      <View style={styles.trackContainer}>
        <Animated.View
          style={[
            styles.bar,
            {
              width: widthPercent,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  subLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  trackContainer: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
});

export default StatBar;
