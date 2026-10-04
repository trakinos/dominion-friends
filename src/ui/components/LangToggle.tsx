import { useLang } from '../../i18n/LangProvider';
import type { Lang } from '../../i18n';

const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'pt', label: 'PT' },
  { lang: 'en', label: 'EN' },
];

export function LangToggle() {
  const { lang, setLang, tr } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label={tr.t('language')}>
      {LANGS.map((l) => (
        <button
          key={l.lang}
          type="button"
          className={lang === l.lang ? 'primary' : ''}
          aria-pressed={lang === l.lang}
          onClick={() => setLang(l.lang)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
