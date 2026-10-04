import type { Locale } from '../design/copyBudget';
import { siteCopy } from './blocks';
import './marketing.css';

const SCENES = {
  how: '/rebuild/marketing/how.webp',
  families: '/rebuild/marketing/families.webp',
  questions: '/rebuild/marketing/questions.webp',
  mentorsHow: '/rebuild/marketing/mentors-how.webp',
  mentorsFamilies: '/rebuild/marketing/mentors-families.webp',
  mentorsQuestions: '/rebuild/marketing/mentors-questions.webp',
} as const;

/** Original marketing artwork. AI action compositions use real-model references (OD-33). */
export function MarketingArt({ scene, locale, compact = false }: {
  scene: keyof typeof SCENES; locale: Locale; compact?: boolean;
}) {
  return <img className={`lf-marketing-art${compact ? ' lf-marketing-art--compact' : ''}`}
    src={SCENES[scene]} alt={siteCopy(locale).marketingArt[scene]} width={1120} height={1400}
    loading="eager" decoding="async" data-asset-id={`site.marketing.${scene}`} />;
}
