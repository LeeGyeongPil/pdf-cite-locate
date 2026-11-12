import en from "../messages.en.json" with { type: "json" };
import ko from "../messages.ko.json" with { type: "json" };

export type Lang = "en" | "ko";
export type MessageKey = keyof typeof en;

/** localStorage key that stores the language chosen in the menu. */
export const STORAGE_KEY = "pdf-cite-locate.lang";

export const messages: Record<Lang, Record<MessageKey, string>> = { en, ko };

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ko";
}

/** Browser language -> UI language: Korean for ko*, English otherwise. */
export function languageFromNavigator(navigatorLanguage: string | undefined): Lang {
  return navigatorLanguage?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * Order: `?lang=ko|en` in the address (used for screenshots) > the stored menu choice >
 * navigator.language. The navigator language is only used when nothing was chosen yet.
 */
export function resolveLang(input: { search?: string; stored?: string | null; navigatorLanguage?: string }): Lang {
  const fromQuery = new URLSearchParams(input.search ?? "").get("lang");
  if (isLang(fromQuery)) return fromQuery;
  if (isLang(input.stored)) return input.stored;
  return languageFromNavigator(input.navigatorLanguage);
}

/** Replaces `{name}` placeholders. */
export function translate(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return (messages[lang][key] ?? key).replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
