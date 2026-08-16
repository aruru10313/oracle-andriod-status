// ============================================================
// ServerCard — swipeable server status card for HomeScreen
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
import CircularProgress from './CircularProgress';
import { formatUptime } from '../services/api';

interface Props {
  server: Server;
  stats: ServerStats | null;
  onPress: () => void;
  isLoading?: boolean;
}

const ServerCard: React.FC<Props> = ({ server, stats, onPress, isLoading = false }) => {
  // Pulse animation for status dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const online = stats?.online ?? false;

  useEffect(() => {
    if (online) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
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
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.serverNameRow}>
          {/* Pulsing status dot */}
          <View style={styles.dotWrapper}>
            <Animated.View
              style={[
                styles.dotPulse,
                { backgroundColor: statusGlow, transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
          </View>

          <View>
            <Text style={styles.serverName} numberOfLines={1}>{server.name}</Text>
            <Text style={styles.serverUrl} numberOfLines={1}>{server.url}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusGlow, borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>

      {/* Stats row */}
      {stats && online ? (
        <>
          <View style={styles.metricsRow}>
            <CircularProgress
              percent={stats.cpuPercent}
              size={72}
              strokeWidth={7}
              color={Colors.cpuColor}
              label="CPU"
            />
            <CircularProgress
              percent={stats.memoryPercent}
              size={72}
              strokeWidth={7}
              color={Colors.memoryColor}
              label="RAM"
            />
            <CircularProgress
              percent={stats.diskPercent}
              size={72}
              strokeWidth={7}
              color={Colors.diskColor}
              label="Disk"
            />
          </View>

          {/* Bottom info row */}
          <View style={styles.infoRow}>
            <InfoChip label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
            <InfoChip label="Load" value={stats.loadAvg1.toFixed(2)} />
            <InfoChip label="Cores" value={String(stats.cpuCores)} />
          </View>
        </>
      ) : stats && !online ? (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineEmoji}>⚠️</Text>
          <Text style={styles.offlineMsg}>서버에 연결할 수 없습니다</Text>
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

      {/* Footer */}
      {lastChecked && (
        <Text style={styles.lastChecked}>마지막 업데이트: {lastChecked}</Text>
      )}
    </TouchableOpacity>
  );
};

const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.chip}>
    <Text style={styles.chipLabel}>{label}</Text>
    <Text style={styles.chipValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  serverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  dotWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
  },
  dotPulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  serverName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  serverUrl: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  chip: {
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipValue: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  offlineBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  offlineEmoji: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  offlineMsg: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  lastChecked: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
});

export default ServerCard;
