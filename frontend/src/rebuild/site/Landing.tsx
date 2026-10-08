import type { Locale } from '../design/copyBudget';
import { type Navigate, type StartAction, type TutorAction } from './blocks';
import { Hero } from './hero/Hero';
import { ProblemSection } from './problem/ProblemSection';
import './landing.css';

export function Landing({ locale, start, tutor = { kind: 'visitor' }, onNavigate, onSecondary }: { locale: Locale; start: StartAction; tutor?: TutorAction; onNavigate?: Navigate; onSecondary?: () => void }) {
  return <div className="lf-site-page lf-landing" data-screen="landing">
    <Hero locale={locale} start={start} tutor={tutor} onNavigate={onNavigate} onSecondary={onSecondary} />
    <ProblemSection locale={locale} />
  </div>;
}
