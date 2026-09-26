import { useEffect, useState } from 'react';
import { rebuildCopy } from '../../i18n/rebuild';
import type { AgeBand, Locale } from '../design/copyBudget';
import type { LearnerRegister } from '../design/learnerRegisterPolicy.generated';
import { renderPreviewFallback } from './registry/core';
import { PREVIEW_SCREENS } from './registry';
import type { PreviewContext } from './registry/types';

/*
 * The development-only preview entry (`rebuild.html`). It composes the
 * per-lane registries in `./registry/` (core, site, learn, mentor, family,
 * profile, staff): a lane adds its screens to its own registry file, never
 * here. `?screen=` picks the screen; `?locale=`, `?theme=`, `?age=` and
 * `?register=` set the environment.
 */

export { PREVIEW_MENTOR_STAGE } from './registry/learn';

const translations = rebuildCopy;
const params = new URLSearchParams(location.search);
const initialLocale = params.get('locale');

export function Preview() {
  const [locale, setLocale] = useState<Locale>(initialLocale === 'es-MX' || initialLocale === 'pt-BR' ? initialLocale : 'en-US');
  const [theme, setTheme] = useState<'light' | 'dark'>(params.get('theme') === 'dark' ? 'dark' : 'light');
  const [screen, setScreen] = useState(params.get('screen') ?? 'home');
  // S05.3f (B.23): the learner register a register-aware screen reads in.
  const register: LearnerRegister = (['young', 'transition', 'teen', 'adult'] as const).find((value) => value === params.get('register')) ?? 'young';
  const [ageBand, setAgeBand] = useState<AgeBand>(['6-9', '10-12', '13-17', 'adult'].includes(params.get('age') ?? '') ? params.get('age') as AgeBand : '6-9');
  const t = translations[locale];
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const go = (next: string) => {
    setScreen(next);
    window.scrollTo(0, 0);
  };
  const context: PreviewContext = { locale, theme, ageBand, register, params, t, go, screen };
  const entry = PREVIEW_SCREENS[screen];
  if (entry?.frame === 'standalone') return <>{entry.render(context)}</>;
  return <div className="lf-rebuild" data-theme={theme} data-age-band={ageBand} lang={locale}>
    {entry ? entry.render(context) : renderPreviewFallback(context)}
    <aside className="lf-preview-settings" aria-label={t.preview}>
      <label data-copy-role="body">{t.language}
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
          {Object.keys(translations).map((value) => <option key={value} value={value} data-copy-role="data">{value}</option>)}
        </select>
      </label>
      <label data-copy-role="body">{t.theme}
        <select value={theme} onChange={(event) => setTheme(event.target.value === 'dark' ? 'dark' : 'light')}>
          <option value="light" data-copy-role="option">{t.light}</option>
          <option value="dark" data-copy-role="option">{t.dark}</option>
        </select>
      </label>
      <label data-copy-role="body">{t.age}
        <select value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)}>
          <option value="6-9" data-copy-role="data">6–9</option>
          <option value="10-12" data-copy-role="data">10–12</option>
          <option value="13-17" data-copy-role="data">13–17</option>
          <option value="adult" data-copy-role="option">{t.adult}</option>
        </select>
      </label>
    </aside>
  </div>;
}
