import { Hero } from '@/features/landing/Hero';
import { Problem } from '@/features/landing/Problem';

/** `/`: the landing page. */
export function Landing() {
  return <div className="grid gap-10 pb-8 md:gap-16">
    <Hero />
    <Problem />
  </div>;
}
