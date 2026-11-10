import { randomUUID } from "node:crypto";
import { timingSafeCompare } from "@/shared/utils/timingSafeCompare";

const MODEL_SYNC_INTERNAL_AUTH_HEADER = "x-model-sync-internal-auth";
export const MODEL_SYNC_LOCAL_SPAWN_DENIED_HEADER = "x-model-sync-local-spawn-denied";

const globalState = globalThis as typeof globalThis & {
  __omnirouteModelSyncInternalAuthToken?: string;
};

let internalAuthToken: string | null = null;

function getInternalAuthToken(): string {
  if (!internalAuthToken) {
    internalAuthToken = globalState.__omnirouteModelSyncInternalAuthToken || randomUUID();
    globalState.__omnirouteModelSyncInternalAuthToken = internalAuthToken;
  }
  return internalAuthToken;
}

export function getModelSyncInternalAuthHeaderName(): string {
  return MODEL_SYNC_INTERNAL_AUTH_HEADER;
}

export function buildModelSyncInternalHeaders(
  options: { denyLocalSpawn?: boolean } = {}
): Record<string, string> {
  return {
    [MODEL_SYNC_INTERNAL_AUTH_HEADER]: getInternalAuthToken(),
    ...(options.denyLocalSpawn ? { [MODEL_SYNC_LOCAL_SPAWN_DENIED_HEADER]: "1" } : {}),
  };
}

export function isModelSyncInternalRequest(request: { headers: Headers }): boolean {
  if (!internalAuthToken && globalState.__omnirouteModelSyncInternalAuthToken) {
    internalAuthToken = globalState.__omnirouteModelSyncInternalAuthToken;
  }
  const headerToken = request.headers.get(MODEL_SYNC_INTERNAL_AUTH_HEADER);
  return Boolean(
    headerToken && internalAuthToken && timingSafeCompare(headerToken, internalAuthToken)
  );
}

export function isModelSyncLocalSpawnDenied(request: { headers: Headers }): boolean {
  return (
    isModelSyncInternalRequest(request) &&
    request.headers.get(MODEL_SYNC_LOCAL_SPAWN_DENIED_HEADER) === "1"
  );
}
