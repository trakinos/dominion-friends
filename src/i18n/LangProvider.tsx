import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translator } from './index';
import type { Translator } from './index';
import type { Lang } from './types';

const LANG_KEY = 'dmf-lang';

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'en' || v === 'pt' ? v : 'pt';
  } catch {
    return 'pt';
  }
}

function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage unavailable: the choice just won't persist.
  }
}

interface LangContextValue {
  lang: Lang;
  setLang(l: Lang): void;
  tr: Translator;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);
  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      tr: translator(lang),
      setLang: (l) => {
        saveLang(l);
        setLangState(l);
      },
    }),
    [lang],
  );
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = value.tr.t('appName');
  }, [lang, value]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const v = useContext(LangContext);
  if (!v) throw new Error('useLang must be used inside <LangProvider>');
  return v;
}
