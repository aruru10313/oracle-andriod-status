// ============================================================
// SettingsScreen — server management + app settings
// Premium 2025/2026 redesign: iOS-style grouped rows,
// better section headers, refined action buttons
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
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Toast from 'react-native-toast-message';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../theme';
import { RootStackParamList, Server, AppSettings } from '../types';
import { loadServers, saveServers, loadSettings, saveSettings } from '../services/storage';
import { fetchPing } from '../services/api';
import { registerBackgroundFetch } from '../tasks/backgroundFetch';

type NavT = StackNavigationProp<RootStackParamList>;

const INTERVALS = [1, 5, 10, 15, 30];

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

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
      if (ok) {
        Toast.show({ type: 'success', text1: '연결 성공', text2: `${server.name} 서버 응답이 정상입니다.` });
      } else {
        Toast.show({ type: 'error', text1: '연결 실패', text2: `${server.name}에 연결할 수 없습니다. URL을 확인하세요.` });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '연결 오류', text2: e.message });
    } finally {
      setTestingServer(null);
    }
  };

  // 백업 및 복원 기능
  const exportSettings = async () => {
    try {
      const data = JSON.stringify({ servers, settings }, null, 2);
      const fileUri = `${FileSystem.documentDirectory}oracle_monitor_backup.json`;
      await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { dialogTitle: '설정 백업 저장', mimeType: 'application/json' });
      } else {
        Toast.show({ type: 'error', text1: '공유 불가', text2: '기기에서 공유 기능을 지원하지 않습니다.' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '백업 실패', text2: '백업 파일을 생성하는 도중 오류가 발생했습니다.' });
    }
  };

  const importSettings = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(fileContent);
      
      if (parsed.servers && parsed.settings) {
        setServers(parsed.servers);
        setSettings(parsed.settings);
        await saveServers(parsed.servers);
        await saveSettings(parsed.settings);
        Toast.show({ type: 'success', text1: '복원 완료', text2: '서버 목록과 설정이 완벽하게 복원되었습니다!' });
      } else {
        Toast.show({ type: 'error', text1: '복원 실패', text2: '잘못된 백업 파일 형식입니다.' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '복원 실패', text2: '백업 파일을 읽는 도중 오류가 발생했습니다.' });
    }
  };

  return (
    <View style={styles.root}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>설정</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('EditServer', {})}
        >
          <Feather name="plus" size={14} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>서버 추가</Text>
        </TouchableOpacity>
      </View>
      {/* Accent separator */}
      <View style={styles.navAccentLine} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Servers ── */}
        <SectionHeader icon="server">서버 목록</SectionHeader>

        {servers.length === 0 ? (
          <View style={styles.emptyServers}>
            <Feather name="server" size={28} color={Colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>서버가 없습니다. 서버를 추가해 주세요.</Text>
          </View>
        ) : (
          <View style={styles.groupCard}>
            {servers.map((server, idx) => (
              <View key={server.id}>
                <View style={styles.serverRow}>
                  {/* Online indicator dot */}
                  <View style={[styles.serverDot, { backgroundColor: server.enabled ? Colors.online : Colors.textMuted }]} />
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
                    <TouchableOpacity onPress={() => deleteServer(server)} style={styles.deleteBtn}>
                      <Feather name="trash-2" size={14} color={Colors.danger} />
                    </TouchableOpacity>

                    {/* Enable toggle */}
                    <Switch
                      value={server.enabled}
                      onValueChange={() => toggleServer(server)}
                      trackColor={{ false: Colors.surfaceElevated, true: Colors.accentDark }}
                      thumbColor={server.enabled ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                </View>
                {/* Divider between server rows (not last) */}
                {idx < servers.length - 1 && <View style={styles.rowDivider} />}
              </View>
            ))}
          </View>
        )}

        {/* ── Polling ── */}
        <SectionHeader icon="clock">폴링 설정</SectionHeader>
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
        <SectionHeader icon="bell">알림 설정</SectionHeader>
        <View style={styles.groupCard}>
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
        <SectionHeader icon="alert-triangle">경고 임계값</SectionHeader>
        <View style={styles.groupCard}>
          <ThresholdRow
            label="CPU 경고 (%)"
            value={settings.cpuAlertThreshold}
            color={Colors.cpuColor}
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
            color={Colors.memoryColor}
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
            color={Colors.diskColor}
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

        {/* ── Backup & Restore ── */}
        <SectionHeader icon="database">데이터 백업 및 복원</SectionHeader>
        <View style={styles.card}>
          <Text style={styles.backupDesc}>
            앱을 삭제하거나 업데이트하기 전에 설정을 백업해두면 다시 설치했을 때 그대로 복원할 수 있습니다.
          </Text>
          <View style={styles.backupRow}>
            <TouchableOpacity style={styles.backupBtn} onPress={exportSettings}>
              <Feather name="upload" size={14} color={Colors.textPrimary} />
              <Text style={styles.backupBtnText}>백업 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restoreBtn} onPress={importSettings}>
              <Feather name="download" size={14} color="#fff" />
              <Text style={styles.restoreBtnText}>설정 불러오기</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ──── Sub components ────────────────────────────────────────

const SectionHeader: React.FC<{ children: React.ReactNode; icon?: string }> = ({ children, icon }) => (
  <View style={styles.sectionHeaderRow}>
    {icon && <Feather name={icon as any} size={11} color={Colors.accent} style={{ opacity: 0.8 }} />}
    <Text style={styles.sectionHeader}>{children}</Text>
  </View>
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
  color?: string;
  onDecrease: () => void;
  onIncrease: () => void;
}> = ({ label, value, color, onDecrease, onIncrease }) => (
  <View style={styles.thresholdRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepBtn} onPress={onDecrease}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.stepValue, color ? { color } : {}]}>{value}%</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={onIncrease}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ──── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Nav
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  navAccentLine: {
    height: 1,
    backgroundColor: Colors.separator,
  },
  navTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadow.fab,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  content: {
    padding: Spacing.md,
  },
  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  // Grouped iOS-style card (no internal padding — rows have their own)
  groupCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...Shadow.card,
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
  // Empty servers
  emptyServers: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  // Server row (inside groupCard)
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  serverInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serverName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    letterSpacing: 0.1,
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
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.offlineGlow,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: FontWeight.semibold,
  },
  // Polling
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
  // Toggle row (inside groupCard — has its own horizontal padding)
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  // Threshold row
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
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
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
  // Divider between rows in groupCard
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: Spacing.md,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: Spacing.md,
  },
  // Backup
  backupDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 19,
  },
  backupRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  backupBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accentDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  restoreBtnText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
});

export default SettingsScreen;
