// TerminalScreen.tsx - SSH Terminal via WebSocket proxy
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView, Alert, ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList, Server, SshConfig } from '../types';

// ── Color tokens (inline since theme may change) ────────────────
const C = {
  bg: '#0D0F14',
  surface: '#141720',
  surfaceEl: '#1C2030',
  border: 'rgba(255,255,255,0.07)',
  accent: '#06B6D4',
  online: '#10B981',
  offline: '#EF4444',
  warning: '#F59E0B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  termBg: '#070A0E',
};

type RouteT = RouteProp<RootStackParamList, 'Terminal'>;
type NavT = StackNavigationProp<RootStackParamList>;

type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface OutputLine {
  id: number;
  text: string;
}

function getWsUrl(server: Server): string {
  let base = server.url.replace(/\/+$/, '');
  // Remove known API paths
  base = base.replace(/\/api\/stats$/, '').replace(/\/api\/ping$/, '');
  // Replace http(s) with ws(s)
  base = base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  return `${base}/ws/terminal`;
}

const SSH_CONFIG_PREFIX = 'ssh_config_';

async function loadSshConfig(serverId: string): Promise<SshConfig> {
  try {
    const raw = await AsyncStorage.getItem(`${SSH_CONFIG_PREFIX}${serverId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { sshHost: '', sshPort: 22, sshUser: 'ubuntu', sshKeyContent: '' };
}

async function saveSshConfig(serverId: string, config: SshConfig): Promise<void> {
  await AsyncStorage.setItem(`${SSH_CONFIG_PREFIX}${serverId}`, JSON.stringify(config));
}

const TerminalScreen: React.FC = () => {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const { server } = route.params;

  const [sshConfig, setSshConfig] = useState<SshConfig>({
    sshHost: '', sshPort: 22, sshUser: 'ubuntu', sshKeyContent: '',
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [input, setInput] = useState('');
  const [lineId, setLineId] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);

  const appendOutput = useCallback((text: string) => {
    idRef.current += 1;
    setOutput(prev => [...prev, { id: idRef.current, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, []);

  // Load persisted SSH config on mount
  useEffect(() => {
    loadSshConfig(server.id).then(cfg => {
      setSshConfig(cfg);
    });
    return () => {
      wsRef.current?.close();
    };
  }, [server.id]);

  const connect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    await saveSshConfig(server.id, sshConfig);
    setPanelOpen(false);
    setWsStatus('connecting');
    appendOutput(`\x1b[33m► Connecting to ${getWsUrl(server)}...\x1b[0m`);

    const ws = new WebSocket(getWsUrl(server));
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connecting');
      appendOutput('\x1b[36m► WebSocket open. Authenticating SSH...\x1b[0m');
      ws.send(JSON.stringify({
        type: 'auth',
        api_key: server.apiKey,
        ssh_host: sshConfig.sshHost || server.url.replace(/^https?:\/\//, '').split(':')[0].split('/')[0],
        ssh_port: sshConfig.sshPort,
        ssh_user: sshConfig.sshUser,
        ssh_key: sshConfig.sshKeyContent,
      }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') {
          appendOutput(msg.data);
        } else if (msg.type === 'connected') {
          setWsStatus('connected');
          appendOutput(`\x1b[32m✓ ${msg.message}\x1b[0m`);
        } else if (msg.type === 'error') {
          appendOutput(`\x1b[31m✗ Error: ${msg.message}\x1b[0m`);
          if (wsStatus === 'connecting') setWsStatus('error');
        } else if (msg.type === 'closed') {
          setWsStatus('disconnected');
          appendOutput(`\x1b[33m● Session ended: ${msg.message}\x1b[0m`);
        }
      } catch {
        appendOutput(e.data);
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
      appendOutput('\x1b[31m✗ WebSocket connection error\x1b[0m');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };
  }, [server, sshConfig, appendOutput]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
    appendOutput('\x1b[33m● Disconnected\x1b[0m');
  }, [appendOutput]);

  const sendInput = useCallback(() => {
    if (!input || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'input', data: input + '\n' }));
    setInput('');
  }, [input]);

  const sendCtrlC = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x03' }));
  }, []);

  const clearOutput = useCallback(() => setOutput([]), []);

  const pickKeyFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setSshConfig(prev => ({ ...prev, sshKeyContent: content }));
      Alert.alert('성공', `키 파일 로드 완료:\n${result.assets[0].name}`);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '파일을 읽을 수 없습니다.');
    }
  }, []);

  const statusColors: Record<WsStatus, string> = {
    disconnected: C.textMuted,
    connecting: C.warning,
    connected: C.online,
    error: C.offline,
  };
  const statusLabels: Record<WsStatus, string> = {
    disconnected: '연결 끊김',
    connecting: '연결 중...',
    connected: '연결됨',
    error: '오류',
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{server.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[wsStatus] }]} />
            <Text style={[styles.statusLabel, { color: statusColors[wsStatus] }]}>
              {statusLabels[wsStatus]}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setPanelOpen(p => !p)} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>⚙</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearOutput} style={[styles.headerBtn, { marginLeft: 4 }]}>
          <Text style={styles.headerBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* SSH Config Panel */}
      {panelOpen && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>SSH 연결 설정</Text>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 3 }]}>
              <Text style={styles.label}>호스트</Text>
              <TextInput
                style={styles.input}
                value={sshConfig.sshHost}
                onChangeText={v => setSshConfig(p => ({ ...p, sshHost: v }))}
                placeholder="158.180.92.51"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>포트</Text>
              <TextInput
                style={styles.input}
                value={String(sshConfig.sshPort)}
                onChangeText={v => setSshConfig(p => ({ ...p, sshPort: parseInt(v, 10) || 22 }))}
                keyboardType="numeric"
                placeholderTextColor={C.textMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>사용자명</Text>
            <TextInput
              style={styles.input}
              value={sshConfig.sshUser}
              onChangeText={v => setSshConfig(p => ({ ...p, sshUser: v }))}
              placeholder="ubuntu"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.keyHeader}>
              <Text style={styles.label}>SSH 개인키</Text>
              <TouchableOpacity onPress={pickKeyFile} style={styles.fileBtn}>
                <Text style={styles.fileBtnText}>📁 파일 선택</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.keyInput]}
              value={sshConfig.sshKeyContent}
              onChangeText={v => setSshConfig(p => ({ ...p, sshKeyContent: v }))}
              placeholder="-----BEGIN RSA PRIVATE KEY----- ..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.panelActions}>
            <TouchableOpacity
              style={[styles.connectBtn, wsStatus === 'connected' && styles.connectBtnActive]}
              onPress={wsStatus === 'connected' ? disconnect : connect}
            >
              {wsStatus === 'connecting' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.connectBtnText}>
                  {wsStatus === 'connected' ? '연결 끊기' : '연결'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Terminal Output */}
      <ScrollView
        ref={scrollRef}
        style={styles.termScroll}
        contentContainerStyle={styles.termContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {output.length === 0 ? (
          <Text style={styles.termPlaceholder}>
            {'// SSH 연결 설정 후 연결 버튼을 눌러주세요\n// 위 ⚙ 버튼으로 설정 패널 열기'}
          </Text>
        ) : (
          output.map(line => (
            <Text key={line.id} style={styles.termText} selectable>
              {line.text}
            </Text>
          ))
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={sendCtrlC} style={styles.ctrlBtn}>
          <Text style={styles.ctrlBtnText}>^C</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.termInput}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendInput}
          placeholder="명령어 입력..."
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          editable={wsStatus === 'connected'}
        />
        <TouchableOpacity
          onPress={sendInput}
          style={[styles.sendBtn, wsStatus !== 'connected' && styles.sendBtnDisabled]}
          disabled={wsStatus !== 'connected'}
        >
          <Text style={styles.sendBtnText}>↵</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 8,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: C.accent },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  headerBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: C.surfaceEl,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnText: { fontSize: 16 },
  panel: {
    backgroundColor: C.surface, padding: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  panelTitle: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', marginBottom: 8 },
  field: { marginBottom: 10 },
  label: { fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: C.surfaceEl, borderRadius: 8,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
    color: C.textPrimary, fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  keyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fileBtn: {
    backgroundColor: C.surfaceEl, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  fileBtnText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  keyInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 8 },
  panelActions: { marginTop: 4 },
  connectBtn: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  connectBtnActive: { backgroundColor: '#DC2626' },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  termScroll: { flex: 1, backgroundColor: C.termBg },
  termContent: { padding: 12, paddingBottom: 24 },
  termText: {
    fontSize: 12.5, lineHeight: 20,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  termPlaceholder: {
    fontSize: 12, color: C.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 22, paddingTop: 20,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, padding: 8,
    borderTopWidth: 1, borderTopColor: C.border, gap: 6,
  },
  ctrlBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: C.surfaceEl, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  ctrlBtnText: { fontSize: 11, color: C.offline, fontWeight: '700', fontFamily: 'monospace' },
  termInput: {
    flex: 1, backgroundColor: C.surfaceEl,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
    color: C.textPrimary, fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    height: 38,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.surfaceEl, opacity: 0.5 },
  sendBtnText: { fontSize: 18, color: '#fff', fontWeight: '700' },
});

export default TerminalScreen;
