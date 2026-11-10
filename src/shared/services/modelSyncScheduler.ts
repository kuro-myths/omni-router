/**
 * Model Auto-Sync Scheduler (#488)
 *
 * Automatically refreshes model lists for provider connections that have
 * autoSync enabled in their providerSpecificData, at a configurable
 * interval (default: 6h).
 *
 * Pattern mirrors cloudSyncScheduler.ts for consistency.
 */

import { Agent, buildConnector, fetch as undiciFetch, type Dispatcher } from "undici";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { isConnectionUnavailableToAuxiliaryActivity } from "@/lib/exclusiveLeaseIsolation";
import { getRuntimePorts } from "@/lib/runtime/ports";

export const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
/** Cycle-wide in-flight cap. Heap cost is total catalog JSON, not one upstream. */
export const MODEL_SYNC_CYCLE_CONCURRENCY = 4;
/** First cycle after boot. Past cleanup's 30s so the two jobs do not overlap. */
export const MODEL_SYNC_STARTUP_DELAY_MS = 90_000;
/**
 * Phase offset (not a period change) between this scheduler's recurring tick
 * and cleanup.ts's own 6h scheduler (#13973 — both are started back-to-back
 * in the same boot sequence, so with the same period they collide every 6h
 * for the process lifetime). The recurring `setInterval` is armed only after
 * this delay, so every periodic tick lands at boot + offset + k * interval
 * while the configured interval itself stays exactly as configured.
 */
export const MODEL_SYNC_STAGGER_OFFSET_MS = 45 * 60 * 1000; // 45 minutes
const MODEL_SYNC_SETTING_KEY = "model_sync_last_run";
export {
  MODEL_SYNC_LOCAL_SPAWN_DENIED_HEADER,
  getModelSyncInternalAuthHeaderName,
  buildModelSyncInternalHeaders,
  isModelSyncInternalRequest,
  isModelSyncLocalSpawnDenied,
} from "@/server/authz/modelSyncInternalAuth";

/** Providers whose connections are created with `autoSync: true` (#488). */
const AUTO_SYNC_DEFAULT_PROVIDERS = new Set(["antigravity", "agy"]);

/**
 * Whether a connection takes part in the sync cycle.
 *
 * `autoSync` unset means the connection predates the family default, not that the operator
 * opted out — those connections never refreshed their catalog again, so every model Google
 * shipped after the connection was created stayed invisible. An explicit `false` is still
 * honored.
 */
export function isAutoSyncEnabled(provider: unknown, psd: Record<string, unknown>): boolean {
  if (psd.autoSync === true) return true;
  if (psd.autoSync !== undefined) return false;
  return typeof provider === "string" && AUTO_SYNC_DEFAULT_PROVIDERS.has(provider);
}

/**
 * Fetch all provider connections that have autoSync enabled.
 */
async function getAutoSyncConnections(): Promise<
  Array<{ id: string; provider: string; name?: string }>
> {
  try {
    const { getProviderConnections } = await import("@/lib/db/providers");
    const connections = await getProviderConnections();
    const autoSyncConnections: Array<{ id: string; provider: string; name?: string }> = [];
    for (const conn of connections) {
      if (!conn.isActive && conn.isActive !== undefined) continue;
      if (
        typeof conn.id === "string" &&
        (await isConnectionUnavailableToAuxiliaryActivity(conn.id))
      )
        continue;
      const psd =
        conn.providerSpecificData && typeof conn.providerSpecificData === "object"
          ? (conn.providerSpecificData as Record<string, unknown>)
          : {};
      if (!isAutoSyncEnabled(conn.provider, psd)) continue;
      if (typeof conn.id !== "string" || typeof conn.provider !== "string") continue;
      autoSyncConnections.push({
        id: conn.id,
        provider: conn.provider,
        ...(typeof conn.name === "string" ? { name: conn.name } : {}),
      });
    }
    return autoSyncConnections;
  } catch (err) {
    console.warn("[ModelSync] Failed to load connections:", (err as Error).message);
    return [];
  }
}

/**
 * Sync models for a single connection via the internal sync-models endpoint.
 *
 * Shared by the scheduled auto-sync cycle and the reactive trigger
 * (src/lib/providerModels/reactiveModelSync.ts) that runs a discovery sync
 * after an upstream model-not-found 404.
 */
export async function syncConnectionModels(
  connectionId: string,
  provider: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const res = await fetchModelSyncInternal(
      `${baseUrl}/api/providers/${connectionId}/sync-models`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          ...buildModelSyncInternalHeaders(),
        },
      }
    );
    if (!res.ok) {
      console.warn(
        `[ModelSync] ${provider} (${connectionId.slice(0, 8)}): sync returned ${res.status}`
      );
      return false;
    }
    const data = await res.json();
    const removedSynced = Number(data.modelChanges?.removed) || 0;
    const removedCustom = Number(data.customModelChanges?.removed) || 0;
    const removed =
      removedSynced || removedCustom
        ? ` (removed: ${removedSynced} synced, ${removedCustom} custom)`
        : "";
    console.log(
      `[ModelSync] ${provider} (${connectionId.slice(0, 8)}): ✓ ${data.syncedModels || 0} models${removed}`
    );
    return true;
  } catch (err) {
    console.warn(
      `[ModelSync] ${provider} (${connectionId.slice(0, 8)}): fetch failed —`,
      (err as Error).message
    );
    return false;
  }
}

async function mapWithConcurrencySettled<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), values.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        const value = await mapper(values[index]);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Run one full model-sync cycle across all auto-sync connections.
 */
async function runSyncCycle(apiBaseUrl: string): Promise<void> {
  if (isRunning) {
    console.log("[ModelSync] Skipping cycle — previous run still in progress");
    return;
  }
  isRunning = true;
  const start = Date.now();

  try {
    const connections = await getAutoSyncConnections();

    if (connections.length === 0) {
      console.log("[ModelSync] No connections with autoSync enabled — skipping cycle");
      return;
    }

    console.log(`[ModelSync] Starting model sync cycle — ${connections.length} connection(s)`);

    const results = await mapWithConcurrencySettled(
      connections,
      MODEL_SYNC_CYCLE_CONCURRENCY,
      (conn) => syncConnectionModels(conn.id, conn.name || conn.provider, apiBaseUrl)
    );

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    console.log(
      `[ModelSync] Cycle complete: ${succeeded}/${connections.length} synced in ${Date.now() - start}ms`
    );

    // Record last sync time
    try {
      await updateSettings({ [MODEL_SYNC_SETTING_KEY]: new Date().toISOString() });
    } catch {
      // Non-critical
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Start the model sync scheduler.
 * @param apiBaseUrl — internal base URL to call OmniRoute's own API
 * @param intervalMs — sync interval in milliseconds (default: 6h)
 */
export function startModelSyncScheduler(
  apiBaseUrl = getModelSyncInternalBaseUrl(),
  intervalMs = DEFAULT_INTERVAL_MS
): void {
  if (schedulerTimer || phaseTimer) {
    console.log("[ModelSync] Scheduler already running — skipping start");
    return;
  }

  // Read MODEL_SYNC_INTERVAL_HOURS env override
  const envHours = parseInt(process.env.MODEL_SYNC_INTERVAL_HOURS ?? "", 10);
  const effectiveIntervalMs =
    !isNaN(envHours) && envHours > 0 ? envHours * 60 * 60 * 1000 : intervalMs;
  const trustedApiBaseUrl = resolveModelSyncInternalBaseUrl(apiBaseUrl);

  console.log(
    `[ModelSync] Scheduler started — interval: ${effectiveIntervalMs / 3_600_000}h ` +
      `(phase offset +${MODEL_SYNC_STAGGER_OFFSET_MS / 60_000}m)`
  );

  // Serve traffic first; cleanup's first pass is +30s, so stay past that window.
  const startupDelay = setTimeout(
    () => runSyncCycle(trustedApiBaseUrl),
    MODEL_SYNC_STARTUP_DELAY_MS
  );
  startupDelay.unref?.();

  // Codex-only: revalidate catalog only on first-start or app upgrade (not every boot).
  void import("./codexCatalogRevalidation")
    .then(({ scheduleCodexCatalogRevalidation }) => {
      scheduleCodexCatalogRevalidation({ apiBaseUrl: trustedApiBaseUrl });
    })
    .catch(() => {
      // silent
    });

  // Then run on the regular interval, phase-shifted against cleanup.ts's
  // own 6h scheduler (#13973). The period stays `effectiveIntervalMs`; only
  // the moment the interval is armed moves.
  phaseTimer = setTimeout(() => {
    phaseTimer = null;
    schedulerTimer = setInterval(() => runSyncCycle(trustedApiBaseUrl), effectiveIntervalMs);
    schedulerTimer.unref?.();
  }, MODEL_SYNC_STAGGER_OFFSET_MS);
  phaseTimer.unref?.();
}

/**
 * Stop the model sync scheduler.
 */
export function stopModelSyncScheduler(): void {
  if (phaseTimer) {
    clearTimeout(phaseTimer);
    phaseTimer = null;
    console.log("[ModelSync] Scheduler stopped");
  }
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[ModelSync] Scheduler stopped");
  }
}

/**
 * Get last sync timestamp from settings DB.
 */
export async function getLastModelSyncTime(): Promise<string | null> {
  try {
    const settings = await getSettings();
    return (settings as Record<string, string>)[MODEL_SYNC_SETTING_KEY] ?? null;
  } catch {
    return null;
  }
}
