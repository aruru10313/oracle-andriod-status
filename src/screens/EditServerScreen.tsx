// ============================================================
// EditServerScreen — Add or edit a server configuration
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../theme';
import { RootStackParamList, Server, Port } from '../types';
import { loadServers, saveServers, generateId } from '../services/storage';
import { fetchPing } from '../services/api';

type RouteT = RouteProp<RootStackParamList, 'EditServer'>;
type NavT = StackNavigationProp<RootStackParamList>;

import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const EditServerScreen: React.FC = () => {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();

  const existingServer = route.params?.server;
  const isEditing = Boolean(existingServer);

  const [name, setName] = useState(existingServer?.name ?? '');
  const [url, setUrl] = useState(existingServer?.url ?? 'https://');
  const [apiKey, setApiKey] = useState(existingServer?.apiKey ?? '');
  const [ports, setPorts] = useState<Port[]>(existingServer?.ports ?? []);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const addPort = () => {
    setPorts([...ports, { name: '', port: 80, protocol: 'tcp' }]);
  };

  const updatePort = (idx: number, key: keyof Port, val: any) => {
    const newPorts = [...ports];
    newPorts[idx] = { ...newPorts[idx], [key]: val };
    setPorts(newPorts);
  };

  const removePort = (idx: number) => {
    const newPorts = [...ports];
    newPorts.splice(idx, 1);
    setPorts(newPorts);
  };

  const validate = (): string | null => {
    if (!name.trim()) return '서버 이름을 입력해주세요';
    if (!url.trim() || url === 'https://') return '서버 URL을 입력해주세요';
    try {
      new URL(url);
    } catch {
      return '올바른 URL을 입력해주세요 (예: https://my-server.com)';
    }
    if (!apiKey.trim()) return 'API 키를 입력해주세요';
    return null;
  };

  const handleTest = async () => {
    const err = validate();
    if (err) {
      Toast.show({ type: 'error', text1: '입력 오류', text2: err });
      return;
    }
    setTesting(true);
    try {
      const tempServer: Server = {
        id: 'test',
        name,
        url: url.trim(),
        apiKey: apiKey.trim(),
        enabled: true,
        createdAt: Date.now(),
      };
      const ok = await fetchPing(tempServer);
      if (ok) {
        Toast.show({ type: 'success', text1: '연결 성공!', text2: '서버가 응답했습니다. 저장해도 됩니다.' });
      } else {
        Toast.show({ type: 'error', text1: '연결 실패', text2: '서버가 응답하지 않습니다. URL과 API 키를 확인하세요.' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '오류', text2: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Toast.show({ type: 'error', text1: '입력 오류', text2: err });
      return;
    }
    setSaving(true);
    try {
      const servers = await loadServers();

      if (isEditing && existingServer) {
        const updated = servers.map((s) =>
          s.id === existingServer.id
            ? { ...s, name: name.trim(), url: url.trim(), apiKey: apiKey.trim(), ports }
            : s
        );
        await saveServers(updated);
        Toast.show({ type: 'success', text1: '저장 완료', text2: '서버 정보가 업데이트되었습니다.' });
      } else {
        const newServer: Server = {
          id: generateId(),
          name: name.trim(),
          url: url.trim(),
          apiKey: apiKey.trim(),
          enabled: true,
          createdAt: Date.now(),
          ports,
        };
        await saveServers([...servers, newServer]);
        Toast.show({ type: 'success', text1: '추가 완료', text2: '새로운 서버가 추가되었습니다.' });
      }

      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: '저장 오류', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isEditing ? '서버 편집' : '서버 추가'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}><Feather name="info" size={16} /> 서버 에이전트 안내</Text>
          <Text style={styles.infoText}>
            Ubuntu 서버에 모니터링 에이전트를 설치해야 합니다.{'\n'}
            에이전트는 <Text style={styles.infoCode}>/api/ping</Text>과{' '}
            <Text style={styles.infoCode}>/api/stats</Text> 엔드포인트를 제공해야 합니다.{'\n\n'}
            README.md를 참고하세요.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <FormField
            label="서버 이름"
            placeholder="예: Oracle VM 1"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
          <FormField
            label="서버 URL"
            placeholder="https://your-server.com"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <FormField
            label="API 키"
            placeholder="비밀 API 키를 입력하세요"
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            secureTextEntry
          />
        </View>

        {/* Ports Card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
            <Text style={styles.infoTitle}><Feather name="globe" size={16} /> 포트 모니터링</Text>
            <TouchableOpacity onPress={addPort}>
              <Text style={{ color: Colors.accent, fontWeight: 'bold' }}>+ 추가</Text>
            </TouchableOpacity>
          </View>
          {ports.map((p, idx) => (
            <View key={idx} style={styles.portRow}>
              <View style={{ flex: 2 }}>
                <TextInput
                  style={ffStyles.input}
                  placeholder="이름 (예: RDP)"
                  placeholderTextColor={Colors.textMuted}
                  value={p.name}
                  onChangeText={(t) => updatePort(idx, 'name', t)}
                  selectionColor={Colors.accent}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: Spacing.xs }}>
                <TextInput
                  style={ffStyles.input}
                  placeholder="포트"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={String(p.port)}
                  onChangeText={(t) => updatePort(idx, 'port', parseInt(t) || 0)}
                  selectionColor={Colors.accent}
                />
              </View>
              <TouchableOpacity style={styles.portProtoBtn} onPress={() => updatePort(idx, 'protocol', p.protocol === 'tcp' ? 'udp' : 'tcp')}>
                <Text style={styles.portProtoText}>{p.protocol.toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.portDelBtn} onPress={() => removePort(idx)}>
                <Feather name="x" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          {ports.length === 0 && (
            <Text style={styles.infoText}>등록된 포트가 없습니다.</Text>
          )}
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.testBtn, testing && styles.btnDisabled]}
          onPress={handleTest}
          disabled={testing}
        >
          <Text style={styles.testBtnText}>
            {testing ? '연결 테스트 중...' : '연결 테스트'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? '저장 중...' : isEditing ? '변경사항 저장' : '서버 추가'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const FormField: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address';
  secureTextEntry?: boolean;
}> = ({ label, placeholder, value, onChangeText, autoCapitalize, keyboardType, secureTextEntry }) => (
  <View style={ffStyles.wrapper}>
    <Text style={ffStyles.label}>{label}</Text>
    <TextInput
      style={ffStyles.input}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      keyboardType={keyboardType ?? 'default'}
      secureTextEntry={secureTextEntry}
      autoCorrect={false}
      selectionColor={Colors.accent}
    />
  </View>
);

const ffStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'android' ? Spacing.sm : Spacing.md,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  backBtn: { padding: Spacing.xs },
  backIcon: { fontSize: 24, color: Colors.accent },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  content: { padding: Spacing.md },
  infoCard: {
    backgroundColor: 'rgba(79,142,247,0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  infoCode: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  testBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  testBtnText: {
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadow.fab,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  portProtoBtn: {
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
    marginRight: Spacing.xs,
  },
  portProtoText: {
    color: Colors.accent,
    fontWeight: 'bold',
    fontSize: FontSize.xs,
  },
  portDelBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  portDelText: {
    color: Colors.danger,
    fontWeight: 'bold',
  },
});

export default EditServerScreen;
