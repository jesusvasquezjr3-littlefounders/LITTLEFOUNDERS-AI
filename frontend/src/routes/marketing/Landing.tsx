import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, IconChip } from '@/components/ui';

const GOALS = [
  { key: 'g1', tone: 'primary', emoji: '🧠' },
  { key: 'g2', tone: 'secondary', emoji: '👨‍👩‍👧' },
  { key: 'g3', tone: 'accent', emoji: '🛡️' },
] as const;

export function Landing() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <h1 className="lf-display-xl">
            {t('marketing.hero.titleLead')}{' '}
            <span className="text-primary">{t('marketing.hero.titleHighlight')}</span>
          </h1>
          <p className="lf-body-lg mt-5 text-content-muted">{t('marketing.hero.subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/learn">
              <Button>{t('marketing.hero.ctaPrimary')}</Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="secondary">{t('marketing.hero.ctaSecondary')}</Button>
            </Link>
          </div>
        </div>
        <img
          src="/Hero-Families.webp"
          alt={t('marketing.hero.imageAlt')}
          className="w-full rounded-xl shadow-clay"
        />
      </section>

      {/* Problem → Solution */}
      <section className="py-12">
        <h2 className="lf-display-lg text-center">{t('marketing.problem.title')}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <IconChip tone="accent">🧩</IconChip>
            <h3 className="lf-title mt-4">{t('marketing.problem.problemTitle')}</h3>
            <p className="lf-body mt-2 text-content-muted">{t('marketing.problem.problemBody')}</p>
          </Card>
          <Card>
            <IconChip tone="primary">🚀</IconChip>
            <h3 className="lf-title mt-4">{t('marketing.problem.solutionTitle')}</h3>
            <p className="lf-body mt-2 text-content-muted">{t('marketing.problem.solutionBody')}</p>
          </Card>
        </div>
      </section>

      {/* Historical fact */}
      <section className="py-12">
        <Card hero className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <p className="lf-display-xl lf-number text-primary">{t('marketing.fact.stat')}</p>
          <div>
            <h2 className="lf-headline">{t('marketing.fact.title')}</h2>
            <p className="lf-body mt-3 text-content-muted">{t('marketing.fact.body')}</p>
            <p className="lf-caption mt-3 text-content-faint">{t('marketing.fact.source')}</p>
          </div>
        </Card>
      </section>

      {/* Human motivation */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-2">
        <img
          src="/marketing/pexels-kid-saving-7118210.jpg"
          alt={t('marketing.motivation.imageAlt')}
          className="aspect-[4/3] w-full rounded-xl object-cover object-bottom shadow-clay"
        />
        <div>
          <h2 className="lf-display-lg">{t('marketing.motivation.title')}</h2>
          <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.motivation.body1')}</p>
          <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.motivation.body2')}</p>
        </div>
      </section>

      {/* Reach & goals */}
      <section className="py-12">
        <h2 className="lf-display-lg text-center">{t('marketing.reach.title')}</h2>
        <p className="lf-body-lg mx-auto mt-3 max-w-2xl text-center text-content-muted">
          {t('marketing.reach.subtitle')}
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {GOALS.map(({ key, tone, emoji }) => (
            <Card key={key}>
              <IconChip tone={tone}>{emoji}</IconChip>
              <h3 className="lf-title mt-4">{t(`marketing.reach.goals.${key}.title`)}</h3>
              <p className="lf-body mt-2 text-content-muted">
                {t(`marketing.reach.goals.${key}.body`)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12">
        <Card hero className="grid items-center gap-8 text-center lg:grid-cols-2 lg:text-left">
          <div>
            <h2 className="lf-display-lg">{t('marketing.finalCta.title')}</h2>
            <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.finalCta.body')}</p>
            <Link to="/learn" className="mt-6 inline-block">
              <Button>{t('marketing.finalCta.button')}</Button>
            </Link>
          </div>
          <img
            src="/marketing/pexels-kid-piggybank-12955547.jpg"
            alt={t('marketing.reach.imageAlt')}
            className="aspect-[3/2] w-full rounded-xl object-cover shadow-clay"
          />
        </Card>
      </section>
    </div>
  );
}
