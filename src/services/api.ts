// ============================================================
// API Service - communicates with Oracle server monitoring agent
// ============================================================

import { Server, ServerStats } from '../types';

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Creates a fetch promise that rejects after a given timeout
 */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

/**
 * Builds the standard request headers for a server
 */
function buildHeaders(server: Server): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': server.apiKey,
    Accept: 'application/json',
  };
}

function getBaseUrl(server: Server): string {
  let url = server.url.replace(/\/+$/, '');
  if (url.endsWith('/api/stats')) url = url.slice(0, -10);
  if (url.endsWith('/api/ping')) url = url.slice(0, -9);
  return url;
}

/**
 * Pings the server to check if it is alive.
 * Expects GET /api/ping → { status: "ok" }
 */
export async function fetchPing(server: Server): Promise<boolean> {
  try {
    const url = `${getBaseUrl(server)}/api/ping`;
    const response = await fetchWithTimeout(url, { headers: buildHeaders(server) }, REQUEST_TIMEOUT_MS);
    return response.ok;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[API] Ping timeout for server: ${server.name}`);
    } else {
      console.warn(`[API] Ping failed for server: ${server.name}`, error.message);
    }
    return false;
  }
}

/**
 * Fetches full stats from the monitoring agent.
 * Expects GET /api/stats → ServerStats JSON
 *
 * The agent script (bash/python running on the Ubuntu server)
 * should return JSON matching the ServerStats type.
 */
export async function fetchStats(server: Server): Promise<ServerStats> {
  const url = `${getBaseUrl(server)}/api/stats`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      { headers: buildHeaders(server) },
      REQUEST_TIMEOUT_MS
    );
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Connection timed out (${REQUEST_TIMEOUT_MS / 1000}s) — server may be offline`);
    }
    throw new Error(`Network error: ${error.message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Authentication failed — check your API key');
  }

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Server returned invalid JSON — is the agent running?');
  }

  // Normalise the response into our ServerStats type
  const stats: ServerStats = {
    serverId: server.id,
    timestamp: Date.now(),
    online: true,

    cpuPercent: Number(data.cpu?.percent ?? data.cpu_percent ?? data.cpuPercent ?? 0),
    loadAvg1: Number(data.load_average?.load_1m ?? data.load_avg_1 ?? 0),
    loadAvg5: Number(data.load_average?.load_5m ?? data.load_avg_5 ?? 0),
    loadAvg15: Number(data.load_average?.load_15m ?? data.load_avg_15 ?? 0),
    cpuCores: Number(data.cpu?.cores ?? data.cpu_cores ?? 1),

    memoryTotalMB: Number((data.memory?.total_bytes ?? data.memory_total_mb ?? 0) / (1024*1024)),
    memoryUsedMB: Number((data.memory?.used_bytes ?? data.memory_used_mb ?? 0) / (1024*1024)),
    memoryPercent: Number(data.memory?.percent ?? data.memory_percent ?? 0),

    swapTotalMB: Number((data.swap?.total ?? data.swap_total ?? 0) / (1024*1024)),
    swapUsedMB: Number((data.swap?.used ?? data.swap_used ?? 0) / (1024*1024)),
    swapPercent: Number(data.swap?.percent ?? data.swap_percent ?? 0),

    diskTotalGB: Number(data.disk?.total_gb ?? data.disk_total_gb ?? 0),
    diskUsedGB: Number(data.disk?.used_gb ?? data.disk_used_gb ?? 0),
    diskPercent: Number(data.disk?.percent ?? data.disk_percent ?? 0),

    network: {
      bytesIn: Number(data.network?.bytes_recv ?? data.network?.bytes_in ?? 0),
      bytesOut: Number(data.network?.bytes_sent ?? data.network?.bytes_out ?? 0),
      packetsIn: Number(data.network?.packets_recv ?? data.network?.packets_in ?? 0),
      packetsOut: Number(data.network?.packets_sent ?? data.network?.packets_out ?? 0),
    },

    uptimeSeconds: Number(data.uptime?.uptime_seconds ?? data.uptime_seconds ?? 0),
    osName: String(data.os ?? data.os_name ?? 'Ubuntu'),
    hostname: String(data.server_name ?? data.hostname ?? server.name),

    processes: Array.isArray(data.processes?.top)
      ? data.processes.top.map((p: any) => ({
          pid: Number(p.pid ?? 0),
          name: String(p.name ?? 'unknown'),
          cpuPercent: Number(p.cpu_percent ?? p.cpuPercent ?? 0),
          memoryMB: Number(p.memory_percent ?? p.memoryMB ?? 0),
        }))
      : [],
  };

  return stats;
}

/**
 * Checks if a specific port is open on the server via the agent
 */
export async function fetchCheckPort(
  server: Server,
  host: string,
  port: number,
  protocol: string
): Promise<boolean> {
  try {
    const url = `${getBaseUrl(server)}/api/check_port?host=${host}&port=${port}&protocol=${protocol}`;
    const response = await fetchWithTimeout(url, { headers: buildHeaders(server) }, 5000);
    if (!response.ok) return false;
    const data = await response.json();
    return data.is_open === true;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable uptime string from seconds
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * Formats bytes to a human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
