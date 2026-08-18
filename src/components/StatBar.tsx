// ============================================================
// StatBar — animated horizontal stat bar
// Premium 2025/2026 redesign: sleek, thin, glassy track
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
      {/* Label row */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          {subLabel && (
            <Text style={styles.subLabel}>{subLabel}  </Text>
          )}
          <Text style={[styles.value, { color: barColor }]}>
            {clampedValue.toFixed(0)}{unit}
          </Text>
        </View>
      </View>

      {/* Track + fill */}
      <View style={styles.trackContainer}>
        {/* Subtle tick marks at 25/50/75 */}
        <View style={[styles.tick, { left: '25%' }]} />
        <View style={[styles.tick, { left: '50%' }]} />
        <View style={[styles.tick, { left: '75%' }]} />
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
    marginVertical: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  subLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  trackContainer: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  // Subtle guide-tick overlays
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    zIndex: 1,
  },
});

export default StatBar;
