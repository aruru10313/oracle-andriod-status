// ============================================================
// SettingsScreen — server management + app settings
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../theme';
import { RootStackParamList, Server, AppSettings } from '../types';
import { loadServers, saveServers, loadSettings, saveSettings } from '../services/storage';
import { fetchPing } from '../services/api';
import { registerBackgroundFetch } from '../tasks/backgroundFetch';

type NavT = StackNavigationProp<RootStackParamList>;

const INTERVALS = [1, 5, 10, 15, 30];

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavT>();

  const [servers, setServers] = useState<Server[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    pollingIntervalMinutes: 5,
    cpuAlertThreshold: 90,
    memoryAlertThreshold: 90,
    diskAlertThreshold: 85,
    notificationsEnabled: true,
    alertOnDown: true,
    alertOnRecovery: true,
  });
  const [testingServer, setTestingServer] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [svs, sett] = await Promise.all([loadServers(), loadSettings()]);
        setServers(svs);
        setSettings(sett);
      };
      load();
    }, [])
  );

  const persistSettings = async (updated: AppSettings) => {
    setSettings(updated);
    await saveSettings(updated);
    // Re-register background fetch with new interval
    await registerBackgroundFetch(updated.pollingIntervalMinutes);
  };

  const toggleServer = async (server: Server) => {
    const updated = servers.map((s) =>
      s.id === server.id ? { ...s, enabled: !s.enabled } : s
    );
    setServers(updated);
    await saveServers(updated);
  };

  const deleteServer = async (server: Server) => {
    Alert.alert('서버 삭제', `"${server.name}" 서버를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const updated = servers.filter((s) => s.id !== server.id);
          setServers(updated);
          await saveServers(updated);
        },
      },
    ]);
  };

  const testConnection = async (server: Server) => {
    setTestingServer(server.id);
    try {
      const ok = await fetchPing(server);
      Alert.alert(
        ok ? '✅ 연결 성공' : '❌ 연결 실패',
        ok
          ? `${server.name}에 성공적으로 연결되었습니다`
          : `${server.name}에 연결할 수 없습니다.\nURL과 API 키를 확인하세요.`
      );
    } catch (e: any) {
      Alert.alert('❌ 오류', e.message);
    } finally {
      setTestingServer(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>설정</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('EditServer', {})}
        >
          <Text style={styles.addBtnText}>+ 서버 추가</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Servers ── */}
        <SectionHeader>서버 목록</SectionHeader>

        {servers.length === 0 ? (
          <View style={styles.emptyServers}>
            <Text style={styles.emptyText}>서버가 없습니다. 서버를 추가해 주세요.</Text>
          </View>
        ) : (
          servers.map((server) => (
            <View key={server.id} style={styles.serverRow}>
              <View style={styles.serverInfo}>
                <Text style={styles.serverName} numberOfLines={1}>{server.name}</Text>
                <Text style={styles.serverUrl} numberOfLines={1}>{server.url}</Text>
              </View>

              <View style={styles.serverActions}>
                {/* Test connection */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => testConnection(server)}
                  disabled={testingServer === server.id}
                >
                  <Text style={styles.actionBtnText}>
                    {testingServer === server.id ? '…' : '테스트'}
                  </Text>
                </TouchableOpacity>

                {/* Edit */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('EditServer', { server })}
                >
                  <Text style={styles.actionBtnText}>편집</Text>
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity onPress={() => deleteServer(server)}>
                  <Text style={styles.deleteText}>삭제</Text>
                </TouchableOpacity>

                {/* Enable toggle */}
                <Switch
                  value={server.enabled}
                  onValueChange={() => toggleServer(server)}
                  trackColor={{ false: Colors.surfaceElevated, true: Colors.onlineGlow }}
                  thumbColor={server.enabled ? Colors.online : Colors.textMuted}
                />
              </View>
            </View>
          ))
        )}

        {/* ── Polling ── */}
        <SectionHeader>폴링 설정</SectionHeader>
        <View style={styles.card}>
          <Text style={styles.settingLabel}>폴링 주기</Text>
          <View style={styles.intervalRow}>
            {INTERVALS.map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.intervalChip,
                  settings.pollingIntervalMinutes === min && styles.intervalChipActive,
                ]}
                onPress={() => persistSettings({ ...settings, pollingIntervalMinutes: min })}
              >
                <Text
                  style={[
                    styles.intervalChipText,
                    settings.pollingIntervalMinutes === min && styles.intervalChipTextActive,
                  ]}
                >
                  {min}분
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Notifications ── */}
        <SectionHeader>알림 설정</SectionHeader>
        <View style={styles.card}>
          <ToggleRow
            label="알림 활성화"
            value={settings.notificationsEnabled}
            onToggle={(v) => persistSettings({ ...settings, notificationsEnabled: v })}
          />
          <Divider />
          <ToggleRow
            label="서버 다운 알림"
            value={settings.alertOnDown}
            onToggle={(v) => persistSettings({ ...settings, alertOnDown: v })}
            disabled={!settings.notificationsEnabled}
          />
          <Divider />
          <ToggleRow
            label="서버 복구 알림"
            value={settings.alertOnRecovery}
            onToggle={(v) => persistSettings({ ...settings, alertOnRecovery: v })}
            disabled={!settings.notificationsEnabled}
          />
        </View>

        {/* ── Thresholds ── */}
        <SectionHeader>경고 임계값</SectionHeader>
        <View style={styles.card}>
          <ThresholdRow
            label="CPU 경고 (%)"
            value={settings.cpuAlertThreshold}
            onDecrease={() =>
              persistSettings({
                ...settings,
                cpuAlertThreshold: Math.max(10, settings.cpuAlertThreshold - 5),
              })
            }
            onIncrease={() =>
              persistSettings({
                ...settings,
                cpuAlertThreshold: Math.min(100, settings.cpuAlertThreshold + 5),
              })
            }
          />
          <Divider />
          <ThresholdRow
            label="메모리 경고 (%)"
            value={settings.memoryAlertThreshold}
            onDecrease={() =>
              persistSettings({
                ...settings,
                memoryAlertThreshold: Math.max(10, settings.memoryAlertThreshold - 5),
              })
            }
            onIncrease={() =>
              persistSettings({
                ...settings,
                memoryAlertThreshold: Math.min(100, settings.memoryAlertThreshold + 5),
              })
            }
          />
          <Divider />
          <ThresholdRow
            label="디스크 경고 (%)"
            value={settings.diskAlertThreshold}
            onDecrease={() =>
              persistSettings({
                ...settings,
                diskAlertThreshold: Math.max(10, settings.diskAlertThreshold - 5),
              })
            }
            onIncrease={() =>
              persistSettings({
                ...settings,
                diskAlertThreshold: Math.min(100, settings.diskAlertThreshold + 5),
              })
            }
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ──── Sub components ────

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionHeader}>{children}</Text>
);

const Divider = () => <View style={styles.divider} />;

const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, value, onToggle, disabled }) => (
  <View style={styles.toggleRow}>
    <Text style={[styles.toggleLabel, disabled && { color: Colors.textMuted }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: Colors.surfaceElevated, true: Colors.accentDark }}
      thumbColor={value ? Colors.accent : Colors.textMuted}
    />
  </View>
);

const ThresholdRow: React.FC<{
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}> = ({ label, value, onDecrease, onIncrease }) => (
  <View style={styles.thresholdRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepBtn} onPress={onDecrease}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}%</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={onIncrease}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  navTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  content: {
    padding: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    ...Shadow.card,
    marginBottom: Spacing.sm,
  },
  emptyServers: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  serverRow: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  serverInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serverName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  serverUrl: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  serverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  deleteText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: FontWeight.semibold,
  },
  settingLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: FontWeight.medium,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  intervalChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceElevated,
  },
  intervalChipActive: {
    backgroundColor: Colors.accentDark,
    borderColor: Colors.accent,
  },
  intervalChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  intervalChipTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: FontSize.lg,
    color: Colors.accent,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  stepValue: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    minWidth: 48,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.sm,
  },
});

export default SettingsScreen;
