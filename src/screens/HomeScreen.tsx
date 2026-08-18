// ============================================================
// HomeScreen — main dashboard with server cards
// Premium 2025/2026 redesign: clean header, gradient accent,
// better empty state, styled refresh control
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../theme';
import { RootStackParamList } from '../types';
import { Server, ServerStats } from '../types';
import { loadServers, loadAllStats, loadSettings } from '../services/storage';
import { fetchStats, fetchPing } from '../services/api';
import { saveStats, appendHistory, saveServerStatuses, loadServerStatuses } from '../services/storage';
import { sendDownAlert, sendRecoveryAlert } from '../services/notifications';
import ServerCard from '../components/ServerCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = StackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [servers, setServers] = useState<Server[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ServerStats>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Flatlist ref for imperative scrolling
  const flatListRef = useRef<FlatList>(null);

  // Indicator dot animation
  const dotAnim = useRef(new Animated.Value(0)).current;

  // ──────────────────── Load & Refresh ───────────────────────

  const loadData = useCallback(async () => {
    const loadedServers = await loadServers();
    const enabledServers = loadedServers.filter((s) => s.enabled);
    setServers(enabledServers);

    const cachedStats = await loadAllStats(enabledServers.map((s) => s.id));
    setStatsMap(cachedStats);
    setLoading(false);
  }, []);

  const pollServers = useCallback(async (serversToCheck: Server[]) => {
    if (serversToCheck.length === 0) return;

    const settings = await loadSettings();
    const previousStatuses = await loadServerStatuses();
    const newStatuses: Record<string, boolean> = { ...previousStatuses };
    const updates: Record<string, ServerStats> = {};

    await Promise.all(
      serversToCheck.map(async (server) => {
        try {
          const online = await fetchPing(server);
          const wasOnline = previousStatuses[server.id];

          if (settings.notificationsEnabled) {
            if (wasOnline === true && !online && settings.alertOnDown) {
              await sendDownAlert(server.name);
            } else if (wasOnline === false && online && settings.alertOnRecovery) {
              await sendRecoveryAlert(server.name);
            }
          }

          newStatuses[server.id] = online;

          if (online) {
            const stats = await fetchStats(server);
            await saveStats(server.id, stats);
            await appendHistory(server.id, {
              timestamp: Date.now(),
              cpuPercent: stats.cpuPercent,
              memoryPercent: stats.memoryPercent,
              diskPercent: stats.diskPercent,
              online: true,
            });
            updates[server.id] = stats;
          } else {
            // Create an offline stats entry
            const offlineStats: ServerStats = {
              serverId: server.id,
              timestamp: Date.now(),
              online: false,
              cpuPercent: 0,
              loadAvg1: 0,
              loadAvg5: 0,
              loadAvg15: 0,
              cpuCores: 0,
              memoryTotalMB: 0,
              memoryUsedMB: 0,
              memoryPercent: 0,
              diskTotalGB: 0,
              diskUsedGB: 0,
              diskPercent: 0,
              network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
              uptimeSeconds: 0,
              osName: '',
              hostname: server.name,
              processes: [],
            };
            updates[server.id] = offlineStats;
          }
        } catch (err) {
          console.warn('[Home] Poll error for', server.name, err);
        }
      })
    );

    await saveServerStatuses(newStatuses);
    setStatsMap((prev) => ({ ...prev, ...updates }));
    setLastUpdated(new Date());
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pollServers(servers);
    setRefreshing(false);
  }, [servers, pollServers]);

  // Focus effect — reload when navigating back from Settings / Detail
  useFocusEffect(
    useCallback(() => {
      loadData().then(() => {
        // Don't auto-poll on focus to avoid hammering API unnecessarily
      });
    }, [loadData])
  );

  // Initial poll after servers are loaded
  useEffect(() => {
    if (!loading && servers.length > 0) {
      pollServers(servers);
    }
  }, [loading]);

  // ──────────────────── Scroll indicator ─────────────────────

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  // ─────────────────────── Render ────────────────────────────

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // Count online/offline servers
  const onlineCount = Object.values(statsMap).filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>오라클 모니터</Text>
          {formattedTime && (
            <Text style={styles.headerSub}>업데이트: {formattedTime}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => (navigation as any).navigate('Main', { screen: 'Settings' })}
        >
          <Feather name="settings" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Gradient accent line under header */}
      <View style={styles.headerAccentLine} />

      {/* Server count badges */}
      {servers.length > 0 && (
        <View style={styles.countRow}>
          <View style={[styles.countBadge, { backgroundColor: Colors.onlineGlow, borderColor: Colors.online }]}>
            <View style={styles.countDot} />
            <Text style={[styles.countText, { color: Colors.online }]}>{onlineCount} 온라인</Text>
          </View>
          {offlineCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: Colors.offlineGlow, borderColor: Colors.offline }]}>
              <View style={[styles.countDot, { backgroundColor: Colors.offline }]} />
              <Text style={[styles.countText, { color: Colors.offline }]}>{offlineCount} 오프라인</Text>
            </View>
          )}
        </View>
      )}

      {/* Server cards list */}
      {servers.length === 0 ? (
        <EmptyState onAdd={() => navigation.navigate('EditServer', {})} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={servers}
          keyExtractor={(item) => item.id}
          horizontal={false}
          pagingEnabled={servers.length > 1}
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
              progressBackgroundColor={Colors.surfaceElevated}
            />
          }
          renderItem={({ item }) => (
            <ServerCard
              server={item}
              stats={statsMap[item.id] ?? null}
              isLoading={loading}
              onPress={() => navigation.navigate('Detail', { server: item })}
            />
          )}
        />
      )}

      {/* Page indicator dots for multiple servers */}
      {servers.length > 1 && (
        <View style={styles.dotsRow}>
          {servers.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex
                  ? { backgroundColor: Colors.accent, width: 20 }
                  : { backgroundColor: Colors.textMuted, width: 6 },
              ]}
            />
          ))}
        </View>
      )}

      {/* FAB — Add server */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('EditServer', {})}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

// ── Empty State ───────────────────────────────────────────────

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <View style={styles.emptyContainer}>
    {/* Glassy icon container */}
    <View style={styles.emptyIconWrapper}>
      <Feather name="server" size={36} color={Colors.accent} />
    </View>
    <Text style={styles.emptyTitle}>서버가 없습니다</Text>
    <Text style={styles.emptyDesc}>
      Oracle Cloud Ubuntu 서버를 추가하여{'\n'}모니터링을 시작하세요
    </Text>
    <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
      <Feather name="plus" size={16} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.emptyBtnText}>서버 추가하기</Text>
    </TouchableOpacity>
  </View>
);

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'android' ? Spacing.md + 24 : Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  // Gradient accent bar below header
  headerAccentLine: {
    height: 1,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.separator,
    marginBottom: Spacing.sm,
    // Simulate gradient with a centered brighter spot via border trick
    borderRadius: 1,
  },
  // ── Count badges
  countRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.online,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  // ── List
  listContent: {
    paddingBottom: 100,
    paddingTop: Spacing.xs,
  },
  // ── Page dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  // ── FAB
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.fab,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 30,
  },
  // ── Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    ...Shadow.fab,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});

export default HomeScreen;
