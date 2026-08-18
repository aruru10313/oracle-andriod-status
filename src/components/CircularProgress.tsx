// ============================================================
// CircularProgress — SVG-based circular progress ring
// Updated for premium 2025/2026 dark theme
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors, FontSize, FontWeight } from '../theme';

interface Props {
  percent: number;          // 0–100
  size?: number;            // outer diameter, default 80
  strokeWidth?: number;     // ring thickness, default 8
  color?: string;           // ring fill color
  label?: string;           // small label below value (e.g. "CPU")
  showValue?: boolean;      // show percentage text, default true
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircularProgress: React.FC<Props> = ({
  percent,
  size = 80,
  strokeWidth = 8,
  color = Colors.accent,
  label,
  showValue = true,
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [clampedPercent]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const center = size / 2;

  // Pick text color based on value
  const getValueColor = (v: number) => {
    if (v >= 90) return Colors.offline;
    if (v >= 70) return Colors.warning;
    return Colors.textPrimary;
  };

  return (
    <View style={[styles.container, { width: size, height: size + (label ? 20 : 0) }]}>
      <Svg width={size} height={size}>
        {/* Track (background ring) — slightly visible */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress ring */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center text */}
      {showValue && (
        <View style={[styles.valueContainer, { width: size, height: size }]}>
          <Text style={[styles.valueText, { color: getValueColor(clampedPercent), fontSize: size < 70 ? FontSize.sm : FontSize.md }]}>
            {clampedPercent.toFixed(0)}%
          </Text>
        </View>
      )}

      {/* Label below */}
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  valueContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

export default CircularProgress;
