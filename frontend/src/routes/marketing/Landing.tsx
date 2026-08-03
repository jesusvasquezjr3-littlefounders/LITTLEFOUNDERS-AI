import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Badge, Button, Card, Icon, IconChip, Reveal } from '@/components/ui';

/* DESIGN.md §Screen Recipes → Landing. This is a marketing narrative, not a
   product specification: invitation → learning experience → proof → CTA. */

const EXPERIENCE_ITEMS = [
  { key: 'learn', icon: 'touch_app', tone: 'accent' },
  { key: 'build', icon: 'lightbulb', tone: 'delight' },
  { key: 'share', icon: 'forum', tone: 'success' },
] as const;

const VALUES = [
  { key: 'short', icon: 'auto_stories', tone: 'primary' },
  { key: 'handsOn', icon: 'extension', tone: 'accent' },
  { key: 'growing', icon: 'trending_up', tone: 'delight' },
] as const;

export function Landing() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const ctaTo = session ? APP_HOME : '/signup';
  const ctaLabel = session ? t('dashboard.continueCta') : t('marketing.hero.ctaPrimary');

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-inverse text-on-inverse">
        <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-container items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28 lg:py-32">
          <div className="relative z-10 flex max-w-xl flex-col items-start">
            <h1 className="lf-display-xl max-w-lg">
              {t('marketing.hero.titleLead')}
              <span className="block text-primary">{t('marketing.hero.titleHighlight')}</span>
            </h1>
            <p className="lf-body-lg mt-6 max-w-xl text-on-inverse-muted">{t('marketing.hero.subtitle')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to={ctaTo} data-cta="hero-primary" className="sm:inline-block">
                <Button className="group w-full sm:w-auto">
                  {ctaLabel}
                  <Icon
                    name="arrow_forward"
                    className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                  />
                </Button>
              </Link>
              <Link to="/how-it-works" data-cta="hero-secondary" className="sm:inline-block">
                <Button variant="secondary" className="w-full border-white/20 bg-white/10 text-on-inverse hover:border-white/40 hover:bg-white/15 hover:text-on-inverse sm:w-auto">
                  <Icon name="play_circle" />
                  {t('marketing.hero.ctaSecondary')}
                </Button>
              </Link>
            </div>
            <p className="lf-caption mt-5 text-on-inverse-muted/80">{t('marketing.hero.note')}</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute inset-8 rounded-full bg-delight/20 blur-3xl" aria-hidden="true" />
            <div className="lf-float relative">
              <img
                src="/Hero-Families.webp"
                alt={t('marketing.hero.imageAlt')}
                className="relative aspect-[4/3] w-full rounded-xl object-cover shadow-pop"
              />
              <Card onInverse className="absolute -bottom-5 left-4 right-4 flex items-center gap-3 p-4 sm:left-8 sm:right-auto sm:min-w-72">
                <IconChip tone="delight" size="md">
                  <Icon name="stars" fill />
                </IconChip>
                <div>
                  <p className="lf-label">{t('marketing.hero.floatingCard.title')}</p>
                  <p className="lf-caption mt-0.5 text-on-inverse-muted">{t('marketing.hero.floatingCard.body')}</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="lf-label text-primary">{t('marketing.experience.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3">{t('marketing.experience.title')}</h2>
            <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.experience.body')}</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {EXPERIENCE_ITEMS.map(({ key, icon, tone }, index) => (
              <Reveal key={key} delay={index * 80}>
                <Card interactive className="flex h-full flex-col gap-5 p-7">
                  <IconChip tone={tone} size="lg">
                    <Icon name={icon} fill />
                  </IconChip>
                  <div>
                    <p className="lf-caption text-content-faint">{t(`marketing.experience.${key}.step`)}</p>
                    <h3 className="lf-headline mt-2">{t(`marketing.experience.${key}.title`)}</h3>
                    <p className="lf-body mt-3 text-content-muted">{t(`marketing.experience.${key}.body`)}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-band py-20 sm:py-28">
        <div className="mx-auto grid max-w-container items-center gap-12 px-5 md:grid-cols-2 md:px-8">
          <Reveal>
            <p className="lf-label text-primary">{t('marketing.lessonPreview.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3 max-w-lg">{t('marketing.lessonPreview.title')}</h2>
            <p className="lf-body-lg mt-4 max-w-lg text-content-muted">{t('marketing.lessonPreview.body')}</p>
            <Link to="/how-it-works" className="group mt-7 inline-flex min-h-11 items-center gap-2 rounded-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="lf-label">{t('marketing.lessonPreview.link')}</span>
              <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <Reveal delay={80}>
            <Card hero className="relative overflow-hidden p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <Badge className="bg-primary-soft text-primary">{t('marketing.lessonPreview.card.badge')}</Badge>
                <span className="lf-caption text-content-muted">{t('marketing.lessonPreview.card.progress')}</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
              <p className="lf-headline mt-7 max-w-sm">{t('marketing.lessonPreview.card.prompt')}</p>
              <div className="mt-6 grid gap-3">
                {['one', 'two', 'three'].map((option) => (
                  <div key={option} className="flex min-h-11 items-center gap-3 rounded-md bg-surface px-4 py-3 shadow-glass-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Icon name={option === 'two' ? 'check' : 'circle'} className="text-base" fill={option === 'two'} />
                    </span>
                    <span className="lf-body text-content-muted">{t(`marketing.lessonPreview.card.options.${option}`)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 rounded-md bg-success-soft p-4 text-success-strong">
                <div className="flex items-center gap-2">
                  <Icon name="auto_awesome" fill />
                  <span className="lf-label">{t('marketing.lessonPreview.card.feedback')}</span>
                </div>
                <span className="lf-caption">{t('marketing.lessonPreview.card.reward')}</span>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="bg-inverse py-20 text-on-inverse sm:py-28">
        <div className="mx-auto grid max-w-container items-center gap-12 px-5 md:grid-cols-2 md:px-8">
          <Reveal className="order-2 md:order-1">
            <Card onInverse hero>
              <p className="lf-number lf-display-xl text-delight">{t('marketing.fact.stat')}</p>
              <p className="lf-headline mt-5">{t('marketing.fact.title')}</p>
              <p className="lf-body mt-4 text-on-inverse-muted">{t('marketing.fact.body')}</p>
              <p className="lf-caption mt-5 text-on-inverse-muted/70">{t('marketing.fact.source')}</p>
            </Card>
          </Reveal>
          <Reveal delay={80} className="order-1 md:order-2">
            <p className="lf-label text-primary">{t('marketing.fact.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3">{t('marketing.fact.heading')}</h2>
            <p className="lf-body-lg mt-4 text-on-inverse-muted">{t('marketing.fact.intro')}</p>
          </Reveal>
        </div>
      </section>

      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <img
              src="/marketing/pexels-kid-saving-7118210.jpg"
              alt={t('marketing.family.imageAlt')}
              className="aspect-[4/3] w-full rounded-xl object-cover object-center shadow-glass"
            />
            <div>
              <p className="lf-label text-primary">{t('marketing.family.eyebrow')}</p>
              <h2 className="lf-display-lg mt-3 max-w-xl">{t('marketing.family.title')}</h2>
              <p className="lf-body-lg mt-4 max-w-xl text-content-muted">{t('marketing.family.body')}</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {VALUES.map(({ key, icon, tone }) => (
                  <div key={key} className="flex flex-col gap-3">
                    <IconChip tone={tone} size="md">
                      <Icon name={icon} fill />
                    </IconChip>
                    <p className="lf-label">{t(`marketing.family.values.${key}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Reveal as="section" className="bg-band py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Card hero className="grid items-center gap-8 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="lf-label text-primary">{t('marketing.finalCta.eyebrow')}</p>
              <h2 className="lf-display-lg mt-3">{t('marketing.finalCta.title')}</h2>
              <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.finalCta.body')}</p>
              <Link to={ctaTo} className="mt-7 inline-block" data-cta="final-primary">
                <Button className="group">
                  {ctaLabel}
                  <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
            <img
              src="/marketing/pexels-kid-piggybank-12955547.jpg"
              alt={t('marketing.finalCta.imageAlt')}
              className="aspect-[3/2] w-full rounded-lg object-cover shadow-glass"
            />
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
