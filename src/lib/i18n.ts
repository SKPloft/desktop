import I18n from "@razein97/tauri-plugin-i18n";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useStore } from "@/state/store";

type TranslationParams = Record<string, string | number>;

let initPromise: Promise<void> | null = null;
let didAttachLocaleListener = false;

function applyDocumentLocale(locale: string) {
  document.documentElement.lang = locale;
}

export function t(key: string, params?: TranslationParams): string {
  let text = I18n.getInstance().translate(key);

  if (import.meta.env.DEV && text === key && key.includes(".")) {
    console.debug(`[i18n] Missing translation: "${key}"`);
  }

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${paramKey}}}`, String(value));
    }
  }

  return text;
}

export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const i18n = I18n.getInstance();
    await i18n.load();

    const currentLocale = await I18n.getLocale().catch(() => useStore.getState().locale);
    useStore.getState().setLocale(currentLocale);
    applyDocumentLocale(currentLocale);

    if (!didAttachLocaleListener) {
      didAttachLocaleListener = true;
      await listen<string>("i18n:locale_changed", (event) => {
        useStore.getState().setLocale(event.payload);
        applyDocumentLocale(event.payload);
      });
    }

    const savedLocale = useStore.getState().locale;
    if (savedLocale && savedLocale !== currentLocale) {
      await I18n.setLocale(savedLocale);
      applyDocumentLocale(savedLocale);
    }
  })();

  return initPromise;
}

export function useTranslation() {
  const locale = useStore((state) => state.locale);
  const setStoredLocale = useStore((state) => state.setLocale);
  const [availableLocales, setAvailableLocales] = useState<string[]>(["en"]);

  useEffect(() => {
    I18n.getAvailableLocales()
      .then((locales) => {
        setAvailableLocales(locales.length > 0 ? locales : ["en"]);
      })
      .catch(() => {
        setAvailableLocales(["en"]);
      });
  }, []);

  const changeLocale = async (newLocale: string) => {
    await I18n.setLocale(newLocale);
    setStoredLocale(newLocale);
    applyDocumentLocale(newLocale);
  };

  return {
    t,
    locale,
    setLocale: changeLocale,
    availableLocales,
  };
}

export { I18n };
