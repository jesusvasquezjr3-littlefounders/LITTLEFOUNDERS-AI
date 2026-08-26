import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Card, Icon, Reveal } from '@/components/ui';
import { TechnologyGraph } from './TechnologyGraph';

/*
 * DELIBERATELY DOWN TO TWO BLOCKS. The page is being rewritten around an
 * explanation of the product in a following session, so it keeps its hero and
 * its closing invitation and nothing in between.
 *
 * What went: the three-step walk, the lesson demo, the parent-dashboard block
 * and the growth readout. Not commented out and not hidden - the markup, the
 * i18n keys in all three locales, and `HowItWorks.css` (every class in it was
 * read by this file alone) are gone. Dead copy is worse than absent copy: it
 * survives translation passes, shows up in key-parity checks, and reads as
 * intentional to whoever arrives next.
 *
 * The concept atlas STAYS. It is the hero, the title is positioned over it by
 * `lf-how-hero-copy` (which lives in TechnologyGraph.css, not here), and the
 * page has no hero at all without it. `marketing.technology.parent*` is still
 * retired: that was the parent-facing block this page wrapped AROUND the graph,
 * not the graph.
 */
export function HowItWorks() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const ctaTo = session ? APP_HOME : '/signup';
  const ctaLabel = session ? t('dashboard.continueCta') : t('marketing.howItWorks.cta');

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-base text-content dark:bg-inverse dark:text-on-inverse">
        <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-none">
          <Reveal className="lf-how-hero-copy pointer-events-none absolute z-10 max-w-xl px-5 md:px-0">
            <h1 className="lf-display-xl">{t('marketing.howItWorks.title')}</h1>
          </Reveal>
          <Reveal delay={80}><TechnologyGraph showTitle={false} /></Reveal>
        </div>
      </section>

      <Reveal as="section" className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Card hero className="mx-auto max-w-4xl text-center">
            <h2 className="lf-display-lg">{t('marketing.howItWorks.closing.title')}</h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">{t('marketing.howItWorks.closing.body')}</p>
            <Link to={ctaTo} className="mt-7 inline-block">
              <Button className="group">
                {ctaLabel}
                <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
