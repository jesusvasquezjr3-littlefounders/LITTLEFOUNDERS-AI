import { useState } from 'react';
import { AnswerChoice, Banner, Button, Copy, InlineNotice, RebuildProvider, TextField } from '../../design/controls';
import { OverlayGallery } from '../OverlayGallery';
import { GalleryIndex, SHELL_KINDS, ShellGallery, type ShellKind } from '../ShellGallery';
import { SystemGallery } from '../SystemGallery';
import { framed, standalone, type PreviewContext, type PreviewRegistry } from './types';

/*
 * Lane 0 (core): the design-system catalogues (S03.1 controls, S03.2 overlays
 * and shells) and the preview index with its two small practice screens.
 */

function Gallery({ locale, theme, ageBand, params, t, screen }: PreviewContext) {
  // S03.2 component gallery: dev/preview only (this entry never ships; see main.tsx).
  const shell = SHELL_KINDS.includes(params.get('shell') as ShellKind) ? params.get('shell') as ShellKind : 'learner';
  const open = (next: string, kind?: ShellKind) => {
    const query = new URLSearchParams({ locale, theme, screen: next, ...(kind ? { shell: kind } : {}) });
    location.search = query.toString();
  };
  return <div className="lf-rebuild" data-theme={theme} data-age-band={ageBand} lang={locale}>
    <RebuildProvider environment={{ theme, locale, ageBand }} labels={{ dismiss: t.designGallery.dismiss }}>
      {screen === 'overlays' ? <OverlayGallery key={locale} t={t.designGallery} s={t.designSystem} onBack={() => open('gallery')} />
        : screen === 'shell' ? <ShellGallery key={`${locale}:${shell}`} kind={shell} t={t.designGallery} s={t.designSystem} locale={locale} onGallery={() => open('gallery')} />
        : <GalleryIndex t={t.designGallery} onOpen={open} />}
    </RebuildProvider>
  </div>;
}

function Practice({ t, go }: PreviewContext) {
  const [answer, setAnswer] = useState<'save' | 'spend' | null>(null);
  const [checked, setChecked] = useState(false);
  return <>
    <Button onClick={() => go('home')}>{t.back}</Button>
    <h1 data-copy-role="prompt">{t.question}</h1>
    <div className="lf-choices" role="group" aria-label={t.question}>
      {(['save', 'spend'] as const).map((choice) => <AnswerChoice key={choice} label={t[choice]}
        selected={answer === choice} disabled={checked} onSelect={() => setAnswer(choice)}
        verdict={checked && answer === choice ? (choice === 'save' ? 'correct' : 'retry') : null} />)}
    </div>
    <div role="status" className="lf-feedback">
      {checked ? <Banner tone={answer === 'save' ? 'success' : 'retry'} live={false}>{answer === 'save' ? t.correct : t.hint}</Banner> : null}
    </div>
    <Button variant="accent" disabled={!answer} onClick={() => checked ? (setChecked(false), setAnswer(null)) : setChecked(true)}>
      {checked ? t.again : t.check}
    </Button>
  </>;
}

function ControlsForm({ t, go }: PreviewContext) {
  const [goal, setGoal] = useState('');
  const [formState, setFormState] = useState<'idle' | 'error' | 'saved'>('idle');
  return <>
    <Button onClick={() => go('home')}>{t.back}</Button>
    <h1 data-copy-role="heading">{t.controls}</h1>
    <form className="lf-form" onSubmit={(event) => { event.preventDefault(); setFormState(goal.trim() ? 'saved' : 'error'); }}>
      <TextField label={t.name} value={goal} onChange={(event) => { setGoal(event.target.value); setFormState('idle'); }}
        help={t.nameHint} error={formState === 'error' ? t.required : undefined} />
      <Button variant="accent" type="submit">{t.confirm}</Button>
      <div role="status">{formState === 'saved' ? <InlineNotice tone="success">{t.confirmed}</InlineNotice> : null}</div>
    </form>
  </>;
}

/** The preview index, the practice question and the goal-name form; also any screen id no registry knows. */
export function renderPreviewFallback(context: PreviewContext) {
  const { t, go, screen } = context;
  return <main className={`lf-preview lf-preview--${screen}`} data-surface="app" data-screen={screen}>
    <div className="lf-preview-content">
      {screen === 'home' ? <>
        <Copy role="body">{t.preview}</Copy>
        <h1 data-copy-role="heading">{t.heading}</h1>
        <Copy role="body">{t.intro}</Copy>
        <div className="lf-actions">
          <Button variant="accent" onClick={() => go('lesson')}>{t.lessonDemo}</Button>
          <Button onClick={() => go('timeline')}>{t.timelineDemo}</Button>
          <Button onClick={() => go('numberline')}>{t.numberLineDemo}</Button>
          <Button onClick={() => go('practice')}>{t.practice}</Button>
          <Button onClick={() => go('controls')}>{t.controls}</Button>
        </div>
      </> : screen === 'practice' ? <Practice key={screen} {...context} /> : <ControlsForm key={screen} {...context} />}
    </div>
  </main>;
}

export const corePreviewScreens: PreviewRegistry = {
  gallery: standalone((context) => <Gallery {...context} />),
  overlays: standalone((context) => <Gallery {...context} />),
  shell: standalone((context) => <Gallery {...context} />),
  system: framed(({ locale, theme, t, go }) => <SystemGallery key={locale} t={t.designSystem} theme={theme} onBack={() => go('home')} />),
  home: framed(renderPreviewFallback),
  practice: framed(renderPreviewFallback),
  controls: framed(renderPreviewFallback),
};
