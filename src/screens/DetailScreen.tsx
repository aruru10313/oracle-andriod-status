// ============================================================
// DetailScreen — in-depth server stats view
// Premium 2025/2026 redesign: refined nav bar, consistent
// card styling, premium section headers with accent dots
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../theme';
import { RootStackParamList, ServerStats, HistoricalEntry, Port } from '../types';
import { fetchStats, fetchCheckPort } from '../services/api';
import { formatUptime, formatBytes } from '../services/api';
import { loadHistory, saveStats, appendHistory, loadServers, saveServers } from '../services/storage';
import StatBar from '../components/StatBar';
import CircularProgress from '../components/CircularProgress';

type RouteT = RouteProp<RootStackParamList, 'Detail'>;
type NavT = StackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPARKLINE_W = SCREEN_WIDTH - Spacing.md * 2 - Spacing.md * 2;
const SPARKLINE_H = 80;

const DetailScreen: React.FC = () => {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const { server } = route.params;

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [history, setHistory] = useState<HistoricalEntry[]>([]);
  const [portStatuses, setPortStatuses] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [fetchedStats, hist] = await Promise.all([
        fetchStats(server),
        loadHistory(server.id),
      ]);
      setStats(fetchedStats);
      setHistory(hist);

      await saveStats(server.id, fetchedStats);
      await appendHistory(server.id, {
        timestamp: Date.now(),
        cpuPercent: fetchedStats.cpuPercent,
        memoryPercent: fetchedStats.memoryPercent,
        diskPercent: fetchedStats.diskPercent,
        online: true,
      });

      // Fetch Port statuses if any
      if (server.ports && server.ports.length > 0) {
        const statuses: Record<string, boolean> = {};
        await Promise.all(
          server.ports.map(async (p: Port) => {
            const host = p.host || '127.0.0.1';
            const isOpen = await fetchCheckPort(server, host, p.port, p.protocol);
            statuses[`${p.port}_${p.protocol}`] = isOpen;
          })
        );
        setPortStatuses(statuses);
      }
    } catch (e: any) {
      setError(e.message ?? '알 수 없는 오류');
    }
  }, [server]);

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleDelete = () => {
    Alert.alert('서버 삭제', `"${server.name}" 서버를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const servers = await loadServers();
          await saveServers(servers.filter((s) => s.id !== server.id));
          navigation.goBack();
        },
      },
    ]);
  };

  const isOnline = stats?.online ?? false;

  return (
    <View style={styles.root}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle} numberOfLines={1}>{server.name}</Text>
          {stats && (
            <View style={styles.navStatusRow}>
              <View style={[styles.navDot, { backgroundColor: isOnline ? Colors.online : Colors.offline }]} />
              <Text style={styles.navSub}>
                {isOnline ? '온라인' : '오프라인'}{stats.hostname ? ` · ${stats.hostname}` : ''}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('EditServer', { server })} style={styles.editBtn}>
          <Text style={styles.editBtnText}>편집</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Terminal', { server })}
          style={styles.termBtn}
        >
          <Text style={styles.termBtnText}>SSH</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>삭제</Text>
        </TouchableOpacity>
      </View>

      {/* Accent separator */}
      <View style={styles.navAccentLine} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
            progressBackgroundColor={Colors.surfaceElevated}
          />
        }
      >
        {/* Error banner */}
        {error && (
          <View style={styles.errorBox}>
            <View style={styles.errorIconWrapper}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>연결 오류</Text>
              <Text style={styles.errorMsg}>{error}</Text>
            </View>
            <TouchableOpacity onPress={loadAll} style={styles.retryBtn}>
              <Text style={styles.retryText}>재시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {stats && (
          <>
            {/* System resource rings */}
            <View style={styles.card}>
              <SectionTitle>시스템 자원</SectionTitle>
              <View style={styles.ringsRow}>
                <CircularProgress percent={stats.cpuPercent} size={80} strokeWidth={8} color={Colors.cpuColor} label="CPU" />
                <CircularProgress percent={stats.memoryPercent} size={80} strokeWidth={8} color={Colors.memoryColor} label="Memory" />
                <CircularProgress percent={stats.swapPercent} size={80} strokeWidth={8} color={Colors.memoryColor} label="Swap" />
                <CircularProgress percent={stats.diskPercent} size={80} strokeWidth={8} color={Colors.diskColor} label="Disk" />
              </View>
            </View>

            {/* CPU detail */}
            <View style={styles.card}>
              <SectionTitle>CPU</SectionTitle>
              <StatBar label="사용률" value={stats.cpuPercent} color={Colors.cpuColor} />
              <View style={styles.metaGrid}>
                <MetaItem label="코어 수" value={String(stats.cpuCores)} />
                <MetaItem label="Load (1m)" value={stats.loadAvg1.toFixed(2)} />
                <MetaItem label="Load (5m)" value={stats.loadAvg5.toFixed(2)} />
                <MetaItem label="Load (15m)" value={stats.loadAvg15.toFixed(2)} />
              </View>
            </View>

            {/* Memory */}
            <View style={styles.card}>
              <SectionTitle>메모리</SectionTitle>
              <StatBar
                label="사용률"
                value={stats.memoryPercent}
                color={Colors.memoryColor}
                subLabel={`${(stats.memoryUsedMB / 1024).toFixed(1)} / ${(stats.memoryTotalMB / 1024).toFixed(1)} GB`}
              />
            </View>

            {/* Swap */}
            <View style={styles.card}>
              <SectionTitle>스왑 (Swap)</SectionTitle>
              <StatBar
                label="사용률"
                value={stats.swapPercent}
                color={Colors.memoryColor}
                subLabel={`${(stats.swapUsedMB / 1024).toFixed(1)} / ${(stats.swapTotalMB / 1024).toFixed(1)} GB`}
              />
            </View>

            {/* Disk */}
            <View style={styles.card}>
              <SectionTitle>디스크</SectionTitle>
              <StatBar
                label="사용률"
                value={stats.diskPercent}
                color={Colors.diskColor}
                subLabel={`${stats.diskUsedGB.toFixed(1)} / ${stats.diskTotalGB.toFixed(1)} GB`}
              />
            </View>

            {/* Network */}
            <View style={styles.card}>
              <SectionTitle>네트워크</SectionTitle>
              <View style={styles.metaGrid}>
                <MetaItem label="수신" value={formatBytes(stats.network.bytesIn)} />
                <MetaItem label="송신" value={formatBytes(stats.network.bytesOut)} />
                <MetaItem label="패킷 수신" value={String(stats.network.packetsIn)} />
                <MetaItem label="패킷 송신" value={String(stats.network.packetsOut)} />
              </View>
            </View>

            {/* System Info */}
            <View style={styles.card}>
              <SectionTitle>시스템 정보</SectionTitle>
              <View style={styles.metaGrid}>
                <MetaItem label="운영체제" value={stats.osName || 'Ubuntu'} />
                <MetaItem label="호스트명" value={stats.hostname} />
                <MetaItem label="가동 시간" value={formatUptime(stats.uptimeSeconds)} />
              </View>
            </View>

            {/* Historical sparkline */}
            {history.length > 1 && (
              <View style={styles.card}>
                <SectionTitle>CPU 사용률 히스토리 (최근 {history.length}개)</SectionTitle>
                <Sparkline data={history.map((h) => h.cpuPercent)} color={Colors.cpuColor} />
                <SectionTitle style={{ marginTop: Spacing.md }}>메모리 사용률 히스토리</SectionTitle>
                <Sparkline data={history.map((h) => h.memoryPercent)} color={Colors.memoryColor} />
              </View>
            )}

            {/* Ports */}
            {server.ports && server.ports.length > 0 && (
              <View style={styles.card}>
                <SectionTitle>포트 모니터링</SectionTitle>
                <View style={styles.portsGrid}>
                  {server.ports.map((p, idx) => {
                    const key = `${p.port}_${p.protocol}`;
                    const isOpen = portStatuses[key];
                    return (
                      <View key={idx} style={[styles.portCard, { borderLeftColor: isOpen ? Colors.online : Colors.offline }]}>
                        <View style={styles.portHeader}>
                          <Text style={styles.portName}>{p.name} <Text style={styles.portProto}>{p.protocol.toUpperCase()}</Text></Text>
                          <View style={[styles.portStatusBadge, { backgroundColor: isOpen ? Colors.onlineGlow : Colors.offlineGlow, borderColor: isOpen ? Colors.online : Colors.offline }]}>
                            <Text style={[styles.portStatusText, { color: isOpen ? Colors.online : Colors.offline }]}>
                              {isOpen === undefined ? '확인 중...' : isOpen ? 'OPEN' : 'CLOSED'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.portValue}>{p.port}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Top processes */}
            {stats.processes.length > 0 && (
              <View style={styles.card}>
                <SectionTitle>상위 프로세스</SectionTitle>
                <View style={styles.processHeader}>
                  <Text style={[styles.processCol, styles.processColWide, { color: Colors.textMuted }]}>프로세스</Text>
                  <Text style={[styles.processCol, { color: Colors.textMuted }]}>CPU%</Text>
                  <Text style={[styles.processCol, { color: Colors.textMuted }]}>메모리</Text>
                </View>
                {stats.processes.map((proc, idx) => (
                  <View key={proc.pid} style={[styles.processRow, idx % 2 === 0 && styles.processRowAlt]}>
                    <Text style={[styles.processCol, styles.processColWide]} numberOfLines={1}>
                      {proc.name}
                    </Text>
                    <Text style={[styles.processCol, { color: proc.cpuPercent > 50 ? Colors.warning : Colors.textSecondary }]}>
                      {proc.cpuPercent.toFixed(1)}%
                    </Text>
                    <Text style={[styles.processCol, { color: Colors.textSecondary }]}>
                      {proc.memoryMB.toFixed(0)} MB
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ──── Sub-components ────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <View style={[stStyles.row, style]}>
    <View style={stStyles.dot} />
    <Text style={stStyles.text}>{children}</Text>
  </View>
);

const stStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 6,
  },
  dot: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    opacity: 0.8,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const MetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
);

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = SPARKLINE_W;
  const h = SPARKLINE_H;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(' ');

  return (
    <View style={styles.sparklineContainer}>
      <Svg width={w} height={h}>
        {/* 50% guide line */}
        <Line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={Colors.separator} strokeWidth={1} strokeDasharray="4 4" />
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.sparklineLabels}>
        <Text style={styles.sparklineLabel}>100%</Text>
        <Text style={styles.sparklineLabel}>0%</Text>
      </View>
    </View>
  );
};

// ──── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  navAccentLine: {
    height: 1,
    backgroundColor: Colors.separator,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: Colors.accent,
    fontWeight: FontWeight.bold,
    lineHeight: 24,
    marginTop: -1,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  navStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  editBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  editBtnText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  deleteBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  termBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  termBtnText: {
    color: '#06B6D4',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
  },
  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaItem: {
    minWidth: '40%',
    flex: 1,
  },
  metaLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
  },
  // Sparkline
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  sparklineLabels: {
    justifyContent: 'space-between',
    paddingLeft: 6,
  },
  sparklineLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  // Process list
  processHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    marginBottom: 4,
  },
  processRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 4,
  },
  processRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  processCol: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  processColWide: {
    flex: 2,
    textAlign: 'left',
  },
  // Error box
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.offlineGlow,
    borderWidth: 1,
    borderColor: Colors.offline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    fontSize: 16,
    color: Colors.offline,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },
  errorTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.offline,
    marginBottom: 2,
  },
  errorMsg: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  retryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.xs,
  },
  // Ports
  portsGrid: {
    gap: Spacing.sm,
  },
  portCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  portHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  portName: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: FontSize.md,
  },
  portProto: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 4,
  },
  portStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  portStatusText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  portValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default DetailScreen;
