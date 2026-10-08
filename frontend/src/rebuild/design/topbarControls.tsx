import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CircleFlag, LOCALE_FLAG } from './CircleFlag';
import type { Locale } from './copyBudget';
import { Glyph } from './glyphs';
import './siteTopbar.css';

/*
 * The two round display controls shared by every surface: a theme toggle and a
 * language menu, both 40 px circles (a 48 px target through the hit area). The
 * language menu shows flags only; each language's own name appears on hover
 * and keyboard focus. Presentation only: the caller supplies state and actions.
 */

export const LANGUAGES: readonly { value: Locale; label: string }[] = [
  { value: 'es-MX', label: 'Español' },
  { value: 'en-US', label: 'English' },
  { value: 'pt-BR', label: 'Português' },
];

export function ThemeToggle({ dark, labelLight, labelDark, onToggle }: { dark: boolean; labelLight: string; labelDark: string; onToggle: () => void }) {
  const label = dark ? labelLight : labelDark;
  return <button type="button" className="lf-topbar-round lf-theme-toggle" data-dark={dark} aria-label={label} title={label} onClick={onToggle}>
    <span className="lf-theme-toggle-icon lf-theme-toggle-sun"><Glyph name="sun" /></span>
    <span className="lf-theme-toggle-icon lf-theme-toggle-moon"><Glyph name="moon" /></span>
  </button>;
}

export function LanguageMenu({ locale, label, onChange }: { locale: Locale; label: string; onChange: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = LANGUAGES.find((language) => language.value === locale) ?? LANGUAGES[0]!;

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step) { event.preventDefault(); list[(index + step + list.length) % list.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); list[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); list[list.length - 1]?.focus(); }
  };
  const choose = (value: Locale) => { onChange(value); setOpen(false); trigger.current?.focus(); };

  return <div className="lf-language-menu" ref={root}>
    <button ref={trigger} type="button" className="lf-topbar-round lf-language-trigger" aria-label={`${label}: ${current.label}`} title={current.label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen(!open)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } }}>
      <CircleFlag code={LOCALE_FLAG[current.value]!} />
    </button>
    {open ? <div id={listId} className="lf-language-list" role="menu" aria-label={label} onKeyDown={move}>
      {LANGUAGES.map((language) => <button key={language.value} type="button" role="menuitemradio" aria-checked={language.value === locale}
        className="lf-topbar-round lf-language-option" aria-label={language.label} data-name={language.label} lang={language.value}
        onClick={() => choose(language.value)}>
        <CircleFlag code={LOCALE_FLAG[language.value]!} />
      </button>)}
    </div> : null}
  </div>;
}

/** Theme, then language: the order everywhere they appear. */
export function TopbarControls({ locale, dark, copy, onLocale, onToggleTheme }: {
  locale: Locale; dark: boolean; copy: { language: string; themeLight: string; themeDark: string };
  onLocale: (locale: Locale) => void; onToggleTheme: () => void;
}) {
  return <div className="lf-shell-preferences lf-topbar-controls" data-shell-preferences>
    <ThemeToggle dark={dark} labelLight={copy.themeLight} labelDark={copy.themeDark} onToggle={onToggleTheme} />
    <LanguageMenu locale={locale} label={copy.language} onChange={onLocale} />
  </div>;
}
