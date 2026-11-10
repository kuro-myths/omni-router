export const LOCALES = ["id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

export const LANGUAGES = [
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
] as const;

export const RTL_LOCALES: readonly Locale[] = [];
export const LOCALE_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  id: ["in"],
});
export const LOCALE_COOKIE = "NEXT_LOCALE";
