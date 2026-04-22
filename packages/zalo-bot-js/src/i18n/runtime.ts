import { messages, type MessageKey, type SupportedLanguage } from "./messages";

function resolveLanguage(): SupportedLanguage {
  const lang = process.env.ZALO_BOT_LANG?.trim().toLowerCase();
  return lang === "en" ? "en" : "vi";
}

export function getLanguage(): SupportedLanguage {
  return resolveLanguage();
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number | undefined>,
  lang: SupportedLanguage = resolveLanguage(),
): string {
  const template = messages[lang][key];

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? "" : String(value);
  });
}
