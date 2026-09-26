import { Faq } from '@/rebuild/site/Faq';
import { useSiteActions } from './siteActions';

/*
 * `/faq` (M4). The questions and the gates that hold their answers to the
 * code live beside the surface: rebuild/site/faqItems.ts.
 */
export function FAQ() {
  const { locale, onNavigate, tutor } = useSiteActions();
  return <Faq locale={locale} tutor={tutor} onNavigate={onNavigate} />;
}
