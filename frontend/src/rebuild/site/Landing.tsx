import type { Locale } from '../design/copyBudget';
import { type StartAction, type TutorAction } from './blocks';
import { Hero } from './hero/Hero';
import { ProblemSection } from './problem/ProblemSection';
import './landing.css';

export function Landing({ locale, start, tutor }: { locale: Locale; start: StartAction; tutor: TutorAction }) {
  return <div className="lf-site-page lf-landing" data-screen="landing">
    <Hero locale={locale} start={start} tutor={tutor} />
    <ProblemSection locale={locale} />
  </div>;
}
