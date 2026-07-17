import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Card, Icon, IconChip, Reveal } from '@/components/ui';

/* Composition per /DESIGN.md §Screen Recipes → Landing: full-bleed alternating
   bands (navy hero → white problem/solution → tinted feature grid → navy fact
   band → white motivation → final CTA banner). Sections rise in on scroll;
   grids stagger (DESIGN.md §Motion). */

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
  const { session } = useAuth();
  
  const ctaTo = session ? APP_HOME : '/signup';
  const primaryCtaLabel = session ? t('dashboard.continueCta') : t('marketing.hero.ctaPrimary');
  const finalCtaLabel = session ? t('dashboard.continueCta') : t('marketing.finalCta.button');

  return (
    <div>
      {/* 1. Hero — responds to light/dark mode (user requested override of navy band) */}
      <section className="bg-base text-content">
        <div className="mx-auto grid max-w-container items-center gap-12 px-5 py-24 md:grid-cols-2 md:px-8 md:py-32 lg:py-40">
          <div className="z-10 flex flex-col items-start gap-6">
            <h1 className="lf-display-xl">
              {t('marketing.hero.titleLead')}
              <br />
              <span className="text-accent">{t('marketing.hero.titleHighlight')}</span>
            </h1>
            <p className="lf-body-lg max-w-lg text-content-muted">
              {t('marketing.hero.subtitle')}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link to={ctaTo}>
                <Button className="group">
                  {primaryCtaLabel}
                  <Icon
                    name="arrow_forward"
                    className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                  />
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
            <div className="absolute inset-0 scale-75 rounded-full bg-primary/20 blur-3xl" />
            <img
              src="/Hero-Families.webp"
              alt={t('marketing.hero.imageAlt')}
              className="relative z-10 w-full rounded-lg object-contain"
            />
          </div>
        </div>
      </section>

      {/* 2. Problem → solution — white band */}
      <section className="mx-auto max-w-container px-5 pt-20 md:px-8 sm:pt-28">
        <Reveal className="mb-14 text-center">
          <h2 className="lf-display-lg">{t('marketing.problem.title')}</h2>
        </Reveal>
        <div className="grid gap-8 md:grid-cols-2">
          <Reveal>
            <Card interactive className="flex h-full flex-col gap-4 p-8">
              <IconChip tone="accent" size="lg">
                <Icon name="extension" fill />
              </IconChip>
              <h3 className="lf-headline">{t('marketing.problem.problemTitle')}</h3>
              <p className="lf-body text-content-muted">{t('marketing.problem.problemBody')}</p>
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card interactive className="flex h-full flex-col gap-4 p-8">
              <IconChip tone="primary" size="lg">
                <Icon name="rocket_launch" fill />
              </IconChip>
              <h3 className="lf-headline">{t('marketing.problem.solutionTitle')}</h3>
              <p className="lf-body text-content-muted">{t('marketing.problem.solutionBody')}</p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* 3. Features grid — tinted band */}
      <section className="mt-20 bg-band py-20 sm:mt-28 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mb-14 text-center">
            <h2 className="lf-display-lg mb-4">{t('marketing.features.title')}</h2>
            <p className="lf-body-lg mx-auto max-w-2xl text-content-muted">
              {t('marketing.features.subtitle')}
            </p>
          </Reveal>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon, tone }, i) => (
              <Reveal key={key} delay={(i % 3) * 80}>
                <Card interactive className="flex h-full flex-col gap-4 p-8">
                  <IconChip tone={tone} size="lg">
                    <Icon name={icon} fill />
                  </IconChip>
                  <h3 className="lf-headline">{t(`marketing.features.${key}.title`)}</h3>
                  <p className="lf-body text-content-muted">{t(`marketing.features.${key}.body`)}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Historical fact — navy band with a frosted glass card */}
      <section className="bg-inverse py-20 text-on-inverse sm:py-28">
        <Reveal className="mx-auto max-w-container px-5 md:px-8">
          <Card onInverse hero className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
            <p className="lf-display-xl lf-number text-delight">{t('marketing.fact.stat')}</p>
            <div>
              <h2 className="lf-headline">{t('marketing.fact.title')}</h2>
              <p className="lf-body mt-3 text-on-inverse-muted">{t('marketing.fact.body')}</p>
              <p className="lf-caption mt-3 text-on-inverse-muted/70">{t('marketing.fact.source')}</p>
            </div>
          </Card>
        </Reveal>
      </section>

      {/* 5. Human motivation — white band */}
      <Reveal
        as="section"
        className="mx-auto grid max-w-container items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8 sm:py-28"
      >
        <img
          src="/marketing/pexels-kid-saving-7118210.jpg"
          alt={t('marketing.motivation.imageAlt')}
          className="aspect-[4/3] w-full rounded-lg object-cover object-bottom shadow-glass"
        />
        <div>
          <h2 className="lf-display-lg">{t('marketing.motivation.title')}</h2>
          <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.motivation.body1')}</p>
          <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.motivation.body2')}</p>
        </div>
      </Reveal>

      {/* 6. Final CTA — banner card */}
      <Reveal as="section" className="mx-auto max-w-container px-5 md:px-8">
        <Card hero className="grid items-center gap-8 text-center lg:grid-cols-2 lg:text-left">
          <div>
            <h2 className="lf-display-lg">{t('marketing.finalCta.title')}</h2>
            <p className="lf-body-lg mt-3 text-content-muted">{t('marketing.finalCta.body')}</p>
            <Link to={ctaTo} className="mt-6 inline-block">
              <Button className="group">
                {finalCtaLabel}
                <Icon
                  name="arrow_forward"
                  className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                />
              </Button>
            </Link>
          </div>
          <img
            src="/marketing/pexels-kid-piggybank-12955547.jpg"
            alt={t('marketing.finalCta.imageAlt')}
            className="aspect-[3/2] w-full rounded-lg object-cover shadow-glass"
          />
        </Card>
      </Reveal>
    </div>
  );
}
