import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon, IconChip } from '@/components/ui';

/* Composition adapted from template/tactile_learning_lab_landing_page (DESIGN.md §0):
   hero (two-line headline w/ gradient line → subtitle → CTA pair → floating
   illustration) → problem/solution → 6-feature clay grid → fact band → motivation →
   final CTA. Badge and trust strip dropped per product decision (WALKTHROUGH). */

const FEATURES = [
  { key: 'f1', icon: 'sports_esports', tone: 'secondary' },
  { key: 'f2', icon: 'smart_toy', tone: 'primary' },
  { key: 'f3', icon: 'touch_app', tone: 'accent' },
  { key: 'f4', icon: 'joystick', tone: 'success' },
  { key: 'f5', icon: 'family_restroom', tone: 'warning' },
  { key: 'f6', icon: 'shield', tone: 'primary' },
] as const;

export function Landing() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6">
      {/* 1. Hero */}
      <section className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="z-10 flex flex-col items-start gap-6">
          <h1 className="lf-display-xl lg:text-6xl lg:leading-tight">
            {t('marketing.hero.titleLead')}
            <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {t('marketing.hero.titleHighlight')}
            </span>
          </h1>
          <p className="lf-body-lg max-w-lg text-content-muted">{t('marketing.hero.subtitle')}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link to="/">
              <Button>
                {t('marketing.hero.ctaPrimary')}
                <Icon name="arrow_forward" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="secondary">
                <Icon name="play_circle" />
                {t('marketing.hero.ctaSecondary')}
              </Button>
            </Link>
          </div>
        </div>
        <div className="lf-float relative flex w-full items-center justify-center">
          <div className="absolute inset-0 scale-75 rounded-full bg-primary/5 blur-3xl" />
          <img
            src="/Hero-Families.webp"
            alt={t('marketing.hero.imageAlt')}
            className="relative z-10 w-full rounded-xl object-contain drop-shadow-2xl"
          />
        </div>
      </section>

      {/* 2. Problem → solution */}
      <section className="border-t border-surface-sunken pt-16">
        <div className="mb-16 text-center">
          <h2 className="lf-display-lg">{t('marketing.problem.title')}</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Card interactive className="flex flex-col gap-4 p-8">
            <IconChip tone="accent" size="lg">
              <Icon name="extension" fill />
            </IconChip>
            <h3 className="lf-headline">{t('marketing.problem.problemTitle')}</h3>
            <p className="lf-body text-content-muted">{t('marketing.problem.problemBody')}</p>
          </Card>
          <Card interactive className="flex flex-col gap-4 p-8">
            <IconChip tone="primary" size="lg">
              <Icon name="rocket_launch" fill />
            </IconChip>
            <h3 className="lf-headline">{t('marketing.problem.solutionTitle')}</h3>
            <p className="lf-body text-content-muted">{t('marketing.problem.solutionBody')}</p>
          </Card>
        </div>
      </section>

      {/* 3. Features grid */}
      <section className="py-24">
        <div className="mb-16 text-center">
          <h2 className="lf-display-lg mb-4">{t('marketing.features.title')}</h2>
          <p className="lf-body-lg mx-auto max-w-2xl text-content-muted">
            {t('marketing.features.subtitle')}
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon, tone }) => (
            <Card key={key} interactive className="flex flex-col gap-4 p-8">
              <IconChip tone={tone} size="lg">
                <Icon name={icon} fill />
              </IconChip>
              <h3 className="lf-headline">{t(`marketing.features.${key}.title`)}</h3>
              <p className="lf-body text-content-muted">{t(`marketing.features.${key}.body`)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Historical fact */}
      <section className="pb-24">
        <Card hero className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <p className="lf-display-xl lf-number bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {t('marketing.fact.stat')}
          </p>
          <div>
            <h2 className="lf-headline">{t('marketing.fact.title')}</h2>
            <p className="lf-body mt-3 text-content-muted">{t('marketing.fact.body')}</p>
            <p className="lf-caption mt-3 text-content-faint">{t('marketing.fact.source')}</p>
          </div>
        </Card>
      </section>

      {/* 5. Human motivation */}
      <section className="grid items-center gap-12 pb-24 md:grid-cols-2">
        <img
          src="/marketing/pexels-kid-saving-7118210.jpg"
          alt={t('marketing.motivation.imageAlt')}
          className="aspect-[4/3] w-full rounded-xl border border-white object-cover object-bottom shadow-clay dark:border-white/10"
        />
        <div>
          <h2 className="lf-display-lg">{t('marketing.motivation.title')}</h2>
          <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.motivation.body1')}</p>
          <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.motivation.body2')}</p>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section>
        <Card hero className="grid items-center gap-8 text-center lg:grid-cols-2 lg:text-left">
          <div>
            <h2 className="lf-display-lg">{t('marketing.finalCta.title')}</h2>
            <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.finalCta.body')}</p>
            <Link to="/" className="mt-6 inline-block">
              <Button>
                {t('marketing.finalCta.button')}
                <Icon name="arrow_forward" />
              </Button>
            </Link>
          </div>
          <img
            src="/marketing/pexels-kid-piggybank-12955547.jpg"
            alt={t('marketing.finalCta.imageAlt')}
            className="aspect-[3/2] w-full rounded-xl border border-white object-cover shadow-clay dark:border-white/10"
          />
        </Card>
      </section>
    </div>
  );
}
