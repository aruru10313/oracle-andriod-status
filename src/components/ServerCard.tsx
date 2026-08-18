// ============================================================
// ServerCard — server status card for HomeScreen
// Premium 2025/2026 redesign: glassy, full-width, sleek bars
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Server, ServerStats } from '../types';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '../theme';
import { formatUptime } from '../services/api';

interface Props {
  server: Server;
  stats: ServerStats | null;
  onPress: () => void;
  isLoading?: boolean;
}

const ServerCard: React.FC<Props> = ({ server, stats, onPress, isLoading = false }) => {
  // Pulse animation for the online status glow ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const online = stats?.online ?? false;

  useEffect(() => {
    if (online) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.8, duration: 1100, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [online]);

  const statusColor = online ? Colors.online : Colors.offline;
  const statusGlow = online ? Colors.onlineGlow : Colors.offlineGlow;
  const statusText = online ? 'ONLINE' : 'OFFLINE';

  const lastChecked = stats
    ? new Date(stats.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Accent top-edge line */}
      <View style={styles.accentLine} />

      {/* Header row */}
      <View style={styles.header}>
        {/* Server name + URL */}
        <View style={styles.serverNameCol}>
          <Text style={styles.serverName} numberOfLines={1}>{server.name}</Text>
          <Text style={styles.serverUrl} numberOfLines={1}>{server.url}</Text>
        </View>

        {/* Status badge top-right */}
        <View style={[styles.statusBadge, { backgroundColor: statusGlow, borderColor: statusColor }]}>
          {/* Pulsing dot inside badge */}
          <View style={styles.dotWrapper}>
            <Animated.View
              style={[
                styles.dotPulse,
                { backgroundColor: statusGlow, transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>

      {/* Stats body */}
      {stats && online ? (
        <>
          {/* Horizontal metric bars */}
          <View style={styles.barsSection}>
            <MetricBar
              label="CPU"
              value={stats.cpuPercent}
              color={Colors.cpuColor}
            />
            <MetricBar
              label="Memory"
              value={stats.memoryPercent}
              color={Colors.memoryColor}
            />
            <MetricBar
              label="Disk"
              value={stats.diskPercent}
              color={Colors.diskColor}
            />
          </View>

          {/* Separator */}
          <View style={styles.separator} />

          {/* Bottom chips row */}
          <View style={styles.chipsRow}>
            <InfoChip label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
            <InfoChip label="Load" value={stats.loadAvg1.toFixed(2)} />
            <InfoChip label="Cores" value={String(stats.cpuCores)} />
          </View>
        </>
      ) : stats && !online ? (
        <View style={styles.offlineBox}>
          <View style={styles.offlineIconWrapper}>
            <Text style={styles.offlineIcon}>!</Text>
          </View>
          <Text style={styles.offlineMsg}>서버에 연결할 수 없습니다</Text>
          <Text style={styles.offlineHint}>Pull to refresh or check the server</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineMsg}>연결 중...</Text>
        </View>
      ) : (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineMsg}>데이터 없음 — 새로고침 해주세요</Text>
        </View>
      )}

      {/* Footer timestamp */}
      {lastChecked && (
        <Text style={styles.lastChecked}>Updated {lastChecked}</Text>
      )}
    </TouchableOpacity>
  );
};

// ── Inline metric bar sub-component ──────────────────────────

const MetricBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animWidth, {
      toValue: clamped,
      useNativeDriver: false,
      tension: 55,
      friction: 9,
    }).start();
  }, [clamped]);

  const widthPct = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const barColor = clamped >= 90 ? Colors.offline : clamped >= 70 ? Colors.warning : color;

  return (
    <View style={mStyles.row}>
      <Text style={mStyles.label}>{label}</Text>
      <View style={mStyles.track}>
        <Animated.View style={[mStyles.fill, { width: widthPct, backgroundColor: barColor }]} />
      </View>
      <Text style={[mStyles.pct, { color: barColor }]}>{clamped.toFixed(0)}%</Text>
    </View>
  );
};

const mStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  label: {
    width: 54,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginHorizontal: Spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  pct: {
    width: 36,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
});

// ── Info chip ─────────────────────────────────────────────────

const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.chip}>
    <Text style={styles.chipValue}>{value}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.card,
  },
  // Subtle cyan accent line at top of card
  accentLine: {
    height: 2,
    backgroundColor: Colors.accent,
    opacity: 0.5,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  serverNameCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serverName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  serverUrl: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    position: 'absolute',
  },
  dotPulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
  },
  statusText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  // Metric bars section
  barsSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: Spacing.md,
  },
  // Bottom chips
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
  },
  chipValue: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  chipLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Offline state
  offlineBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  offlineIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.offlineGlow,
    borderWidth: 1,
    borderColor: Colors.offline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  offlineIcon: {
    fontSize: 18,
    color: Colors.offline,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  offlineMsg: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  offlineHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  // Footer
  lastChecked: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'right',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
});

export default ServerCard;
