// ============================================================
// TypeScript interfaces for Oracle Monitor App
// ============================================================

export interface Port {
  name: string;
  port: number;
  protocol: string; // 'tcp' | 'udp'
  host?: string;
}

export interface Server {
  id: string;
  name: string;
  url: string;         // e.g. https://my-server.com
  apiKey: string;
  enabled: boolean;
  createdAt: number;
  ports?: Port[];
}

export interface NetworkStats {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryMB: number;
}

export interface ServerStats {
  serverId: string;
  timestamp: number;
  online: boolean;

  // CPU
  cpuPercent: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  cpuCores: number;

  // Memory
  memoryTotalMB: number;
  memoryUsedMB: number;
  memoryPercent: number;

  // Swap
  swapTotalMB: number;
  swapUsedMB: number;
  swapPercent: number;

  // Disk
  diskTotalGB: number;
  diskUsedGB: number;
  diskPercent: number;

  // Network
  network: NetworkStats;

  // System
  uptimeSeconds: number;
  osName: string;
  hostname: string;

  // Top processes
  processes: ProcessInfo[];
}

export interface HistoricalEntry {
  timestamp: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  online: boolean;
}

export interface AppSettings {
  pollingIntervalMinutes: number;      // default 5
  cpuAlertThreshold: number;           // default 90 (%)
  memoryAlertThreshold: number;        // default 90 (%)
  diskAlertThreshold: number;          // default 85 (%)
  notificationsEnabled: boolean;
  alertOnDown: boolean;
  alertOnRecovery: boolean;
}

export interface ServerStatus {
  serverId: string;
  online: boolean;
  lastChecked: number;
}

// Navigation param lists
export type RootStackParamList = {
  Main: undefined;
  Detail: { server: Server };
  EditServer: { server?: Server };
};

export type BottomTabParamList = {
  Home: undefined;
  Settings: undefined;
};
