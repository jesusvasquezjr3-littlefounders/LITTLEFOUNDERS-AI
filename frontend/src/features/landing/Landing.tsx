import { FinalCta } from '@/features/landing/FinalCta';
import { Hero } from '@/features/landing/Hero';
import { Path } from '@/features/landing/Path';
import { Principles } from '@/features/landing/Principles';
import { Problem } from '@/features/landing/Problem';

/** `/`: the landing page. Who it is for and what it promises, the evidence, the path, what stays true, the ask. */
export function Landing() {
  return <div>
    <Hero />
    <Problem />
    <Path />
    <Principles />
    <FinalCta />
  </div>;
}
