import { getRequestConfig } from "next-intl/server";
import idMessages from "./messages/id.json";
import { DEFAULT_LOCALE } from "./config";

/**
 * OmniRoute deployment locale is intentionally Indonesian-only.
 * Import one catalog statically so the server bundle does not include every
 * upstream translation catalog through a variable dynamic import.
 */
export function parseLocaleMessages(source: unknown): Record<string, unknown> {
  return (typeof source === "string" ? JSON.parse(source) : source) as Record<string, unknown>;
}

export function normalizeComplianceEventTypes(
  messages: Record<string, unknown>
): Record<string, unknown> {
  const compliance = messages.compliance;
  if (!compliance || typeof compliance !== "object" || Array.isArray(compliance)) return messages;
  const eventTypes = (compliance as Record<string, unknown>).eventTypes;
  if (!eventTypes || typeof eventTypes !== "object" || Array.isArray(eventTypes)) return messages;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(eventTypes as Record<string, unknown>)) {
    if (!key.includes(".")) {
      normalized[key] = value;
      continue;
    }
    const parts = key.split(".");
    let target = normalized;
    for (const part of parts.slice(0, -1)) {
      target[part] ??= {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = value;
  }
  return {
    ...messages,
    compliance: { ...(compliance as Record<string, unknown>), eventTypes: normalized },
  };
}

const messages = normalizeComplianceEventTypes(parseLocaleMessages(idMessages));

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages,
}));
