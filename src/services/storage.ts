// ============================================================
// AsyncStorage service — persistence layer for the app
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Server, ServerStats, AppSettings, HistoricalEntry } from '../types';

// ──────────────────────────── Keys ────────────────────────────
const KEYS = {
  servers: 'servers_v1',
  statsPrefix: 'stats_v1_',
  historyPrefix: 'history_v1_',
  settings: 'settings_v1',
  serverStatus: 'server_status_v1',
} as const;

const MAX_HISTORY_ENTRIES = 20;

// ─────────────────────────── Servers ──────────────────────────

export async function saveServers(servers: Server[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.servers, JSON.stringify(servers));
}

export async function loadServers(): Promise<Server[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.servers);
    if (!raw) return [];
    return JSON.parse(raw) as Server[];
  } catch (e) {
    console.error('[Storage] loadServers failed', e);
    return [];
  }
}

// ──────────────────────────── Stats ───────────────────────────

/**
 * Cache the most recent stats for a server (used for widget + quick display)
 */
export async function saveStats(serverId: string, stats: ServerStats): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.statsPrefix + serverId, JSON.stringify(stats));
  } catch (e) {
    console.error('[Storage] saveStats failed', e);
  }
}

export async function loadStats(serverId: string): Promise<ServerStats | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.statsPrefix + serverId);
    if (!raw) return null;
    return JSON.parse(raw) as ServerStats;
  } catch {
    return null;
  }
}

/**
 * Load cached stats for ALL servers at once
 */
export async function loadAllStats(serverIds: string[]): Promise<Record<string, ServerStats>> {
  const keys = serverIds.map((id) => KEYS.statsPrefix + id);
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, ServerStats> = {};
    for (const [key, value] of pairs) {
      if (value) {
        const id = key.replace(KEYS.statsPrefix, '');
        result[id] = JSON.parse(value) as ServerStats;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ─────────────────────────── History ──────────────────────────

/**
 * Append a new historical entry (max 20 kept per server)
 */
export async function appendHistory(serverId: string, entry: HistoricalEntry): Promise<void> {
  try {
    const existing = await loadHistory(serverId);
    const updated = [...existing, entry].slice(-MAX_HISTORY_ENTRIES);
    await AsyncStorage.setItem(KEYS.historyPrefix + serverId, JSON.stringify(updated));
  } catch (e) {
    console.error('[Storage] appendHistory failed', e);
  }
}

export async function loadHistory(serverId: string): Promise<HistoricalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.historyPrefix + serverId);
    if (!raw) return [];
    return JSON.parse(raw) as HistoricalEntry[];
  } catch {
    return [];
  }
}

// ─────────────────────────── Settings ─────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  pollingIntervalMinutes: 5,
  cpuAlertThreshold: 90,
  memoryAlertThreshold: 90,
  diskAlertThreshold: 85,
  notificationsEnabled: true,
  alertOnDown: true,
  alertOnRecovery: true,
};

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ──────────────────────── Server status cache ──────────────────

/**
 * Persist the last known online/offline state per server.
 * Used by background task to detect state CHANGES.
 */
export async function saveServerStatuses(
  statuses: Record<string, boolean>
): Promise<void> {
  await AsyncStorage.setItem(KEYS.serverStatus, JSON.stringify(statuses));
}

export async function loadServerStatuses(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.serverStatus);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

// ─────────────────────────── Helpers ──────────────────────────

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}
