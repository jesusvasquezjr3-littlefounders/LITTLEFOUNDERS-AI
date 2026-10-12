import { FinalCta } from '@/features/landing/FinalCta';
import { Hero } from '@/features/landing/Hero';
import { SavedNotice } from '@/features/onboarding/SavedNotice';
import { Path } from '@/features/landing/Path';
import { Principles } from '@/features/landing/Principles';
import { Problem } from '@/features/landing/Problem';

/** `/`: the landing page. Who it is for and what it promises, the evidence, the path, what stays true, the ask. Layout rules: type.ts. Above it, for somebody who walked the onboarding without creating an account, the notice of what this device keeps. */
export function Landing() {
  return <div>
    <div className="flex justify-center pt-3"><SavedNotice /></div>
    <Hero />
    <Problem />
    <Path />
    <Principles />
    <FinalCta />
  </div>;
}
