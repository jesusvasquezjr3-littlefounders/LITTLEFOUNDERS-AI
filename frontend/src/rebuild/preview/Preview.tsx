import { SelectField } from '../design/fields';
import { IconButton } from '../design/controls';
import { RebuildRoot } from '../design/root';
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
  return <RebuildRoot theme={theme} ageBand={ageBand} locale={locale}>
    {entry ? entry.render(context) : renderPreviewFallback(context)}
    <aside className="lf-preview-settings" aria-label={t.preview}>
      <SelectField label={t.language} value={locale} onChange={(event) => setLocale(event.target.value as Locale)} options={Object.keys(translations).map((value) => ({ value, label: value, role: 'data' }))} />
      <IconButton glyph={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? t.light : t.dark} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <SelectField label={t.age} value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)} options={[{ value: '6-9', label: '6–9', role: 'data' }, { value: '10-12', label: '10–12', role: 'data' }, { value: '13-17', label: '13–17', role: 'data' }, { value: 'adult', label: t.adult }]} />
    </aside>
  </RebuildRoot>;
}
