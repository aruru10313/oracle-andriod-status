// ============================================================
// Background Fetch Task — polls servers every 5 minutes
// ============================================================

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { fetchPing, fetchStats } from '../services/api';
import {
  loadServers,
  loadSettings,
  loadServerStatuses,
  saveServerStatuses,
  saveStats,
  appendHistory,
} from '../services/storage';
import {
  sendDownAlert,
  sendRecoveryAlert,
  sendHighUsageAlert,
} from '../services/notifications';
import { HistoricalEntry } from '../types';

export const BACKGROUND_FETCH_TASK = 'oracle-monitor-bg-fetch';

// ─────────────────── Task definition ──────────────────────────

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[BG] Background fetch started at', new Date().toISOString());

  try {
    const [servers, settings, previousStatuses] = await Promise.all([
      loadServers(),
      loadSettings(),
      loadServerStatuses(),
    ]);

    const enabledServers = servers.filter((s) => s.enabled);
    if (enabledServers.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const newStatuses: Record<string, boolean> = { ...previousStatuses };

    await Promise.all(
      enabledServers.map(async (server) => {
        try {
          const isOnline = await fetchPing(server);
          const wasOnline = previousStatuses[server.id];

          // Detect status change
          if (settings.notificationsEnabled) {
            if (wasOnline === true && !isOnline && settings.alertOnDown) {
              await sendDownAlert(server.name);
            } else if (wasOnline === false && isOnline && settings.alertOnRecovery) {
              await sendRecoveryAlert(server.name);
            }
          }

          newStatuses[server.id] = isOnline;

          if (isOnline) {
            // Try to fetch full stats for caching and history
            try {
              const stats = await fetchStats(server);
              await saveStats(server.id, stats);

              // Append to local history
              const histEntry: HistoricalEntry = {
                timestamp: Date.now(),
                cpuPercent: stats.cpuPercent,
                memoryPercent: stats.memoryPercent,
                diskPercent: stats.diskPercent,
                online: true,
              };
              await appendHistory(server.id, histEntry);

              // Check thresholds
              if (settings.notificationsEnabled) {
                if (stats.cpuPercent >= settings.cpuAlertThreshold) {
                  await sendHighUsageAlert(server.name, 'CPU', stats.cpuPercent);
                }
                if (stats.memoryPercent >= settings.memoryAlertThreshold) {
                  await sendHighUsageAlert(server.name, 'Memory', stats.memoryPercent);
                }
                if (stats.diskPercent >= settings.diskAlertThreshold) {
                  await sendHighUsageAlert(server.name, 'Disk', stats.diskPercent);
                }
              }
            } catch (statsErr) {
              console.warn(`[BG] fetchStats failed for ${server.name}:`, statsErr);
            }
          } else {
            // Save an offline history entry
            const histEntry: HistoricalEntry = {
              timestamp: Date.now(),
              cpuPercent: 0,
              memoryPercent: 0,
              diskPercent: 0,
              online: false,
            };
            await appendHistory(server.id, histEntry);
          }
        } catch (serverErr) {
          console.warn(`[BG] Error processing ${server.name}:`, serverErr);
        }
      })
    );

    await saveServerStatuses(newStatuses);
    console.log('[BG] Background fetch completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[BG] Background fetch failed:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─────────────── Registration helpers ─────────────────────────

/**
 * Registers the background fetch task with the given polling interval.
 * Safe to call multiple times — will update existing registration.
 */
export async function registerBackgroundFetch(intervalMinutes: number = 5): Promise<void> {
  const minimumInterval = Math.max(1, intervalMinutes) * 60; // seconds

  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval,
      stopOnTerminate: false,  // continue after app is killed
      startOnBoot: true,       // resume after device reboot
    });
    console.log(`[BG] Registered background fetch (interval: ${intervalMinutes}m)`);
  } catch (e: any) {
    // Already registered — update interval
    if (e.message?.includes('already registered')) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[BG] Re-registered background fetch task');
    } else {
      console.error('[BG] Failed to register background fetch:', e);
    }
  }
}

/**
 * Unregisters the background fetch task
 */
export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch {
    // ignore if not registered
  }
}

/**
 * Returns the current status of the background task
 */
export async function getBackgroundFetchStatus(): Promise<string> {
  const status = await BackgroundFetch.getStatusAsync();
  switch (status) {
    case BackgroundFetch.BackgroundFetchStatus.Available:
      return 'available';
    case BackgroundFetch.BackgroundFetchStatus.Denied:
      return 'denied';
    case BackgroundFetch.BackgroundFetchStatus.Restricted:
      return 'restricted';
    default:
      return 'unknown';
  }
}
