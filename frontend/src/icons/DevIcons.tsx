import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { ICON_NAMES, type IconName } from '@/icons/rest';
import { useTheme } from '@/theme/useTheme';

/*
 * Every icon of the application, for looking at them together: `/dev/icons`, only in the dev server (App.tsx does
 * not mount it in a production build). A tool, not a product screen, so its labels are not in the locale files.
 *
 * "Alive" runs every icon's `idle` loop. Move the pointer over an icon, or reach it with the keyboard, to see its
 * `hover`; press it to see its `select` (a pressed icon stays alive).
 * Change an icon in tools/icons/definitions.mjs, run `npm run icons`, and this page updates by itself.
 */
const SIZES = [20, 24, 32, 48, 96];

const SURFACES: { name: string; className: string }[] = [
  { name: 'The page', className: 'bg-[var(--background)] text-[color:var(--v-text)]' },
  { name: 'A panel', className: 'bg-[var(--v-beige)] text-[color:var(--v-text)]' },
  { name: 'The sidebar (always dark)', className: 'bg-[var(--v-structure)] text-white' },
];

function Sample({ name, size, alive }: { name: IconName; size: number; alive: boolean }) {
  const [isActive, setIsActive] = useState(false);

  return <button type="button" data-sample={`${name}-${size}`} aria-pressed={isActive} aria-label={`${name} at ${size} px`} className="grid size-[124px] place-items-center rounded-[28px] border-2 border-current/15 aria-pressed:border-current"
    onClick={() => setIsActive((value) => !value)}>
    <AppIcon name={name} size={size} active={isActive} alive={alive} />
  </button>;
}

export default function DevIcons() {
  const { isDark, setChoice } = useTheme();
  const [size, setSize] = useState(48);
  const [isAlive, setIsAlive] = useState(true);

  return <div className="grid gap-6 p-6">
    <header className="flex flex-wrap items-center gap-3">
      <h1 className="m-0 me-4 text-[22px] font-extrabold">Icons ({ICON_NAMES.length})</h1>
      {SIZES.map((value) => <button key={value} type="button" aria-pressed={size === value} className="min-h-10 rounded-full border-2 px-4 font-bold aria-pressed:bg-[var(--v-ink)] aria-pressed:text-[color:var(--v-on-ink)]" onClick={() => setSize(value)}>{value} px</button>)}
      <button type="button" aria-pressed={isAlive} className="min-h-10 rounded-full border-2 px-4 font-bold aria-pressed:bg-[var(--v-ink)] aria-pressed:text-[color:var(--v-on-ink)]" onClick={() => setIsAlive((value) => !value)}>Alive</button>
      <button type="button" className="min-h-10 rounded-full border-2 px-4 font-bold" onClick={() => setChoice(isDark ? 'light' : 'dark')}>{isDark ? 'Light' : 'Dark'}</button>
    </header>

    {SURFACES.map((surface) => <section key={surface.name} className={`grid gap-3 rounded-[36px] p-5 ${surface.className}`}>
      <h2 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.1em] opacity-70">{surface.name}</h2>
      <div className="flex flex-wrap gap-3">{ICON_NAMES.map((name) => <div key={name} className="grid justify-items-center gap-1"><Sample name={name} size={size} alive={isAlive} /><span className="text-[13px] font-bold">{name}</span></div>)}</div>
    </section>)}

    <section className="grid gap-3">
      <h2 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.1em] opacity-70">Every size</h2>
      {ICON_NAMES.map((name) => <div key={name} className="flex items-end gap-5">{SIZES.map((value) => <AppIcon key={value} name={name} size={value} />)}<span className="text-[13px] font-bold">{name}</span></div>)}
    </section>
  </div>;
}
