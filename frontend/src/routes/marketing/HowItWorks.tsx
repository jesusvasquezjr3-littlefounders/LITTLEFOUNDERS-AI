import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Badge, Button, Card, Icon, IconChip, Reveal } from '@/components/ui';

const LESSON_STEPS = [
  { key: 'discover', icon: 'explore', tone: 'primary' },
  { key: 'practice', icon: 'touch_app', tone: 'accent' },
  { key: 'celebrate', icon: 'workspace_premium', tone: 'delight' },
] as const;

const LESSON_MOMENTS = [
  { key: 'stories', icon: 'auto_stories' },
  { key: 'choices', icon: 'account_tree' },
  { key: 'wins', icon: 'emoji_events' },
] as const;

export function HowItWorks() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const ctaTo = session ? APP_HOME : '/signup';
  const ctaLabel = session ? t('dashboard.continueCta') : t('marketing.howItWorks.cta');

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-inverse py-20 text-on-inverse sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl" aria-hidden="true" />
        <Reveal className="relative mx-auto max-w-3xl px-5 text-center md:px-8">
          <Badge className="bg-white/10 text-on-inverse">{t('marketing.howItWorks.eyebrow')}</Badge>
          <h1 className="lf-display-xl mt-5">{t('marketing.howItWorks.title')}</h1>
          <p className="lf-body-lg mx-auto mt-6 max-w-2xl text-on-inverse-muted">{t('marketing.howItWorks.intro')}</p>
        </Reveal>
      </section>

      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="lf-label text-primary">{t('marketing.howItWorks.steps.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3">{t('marketing.howItWorks.steps.title')}</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {LESSON_STEPS.map(({ key, icon, tone }, index) => (
              <Reveal key={key} delay={index * 80}>
                <Card interactive className="flex h-full flex-col gap-5 p-7">
                  <IconChip tone={tone} size="lg">
                    <Icon name={icon} fill />
                  </IconChip>
                  <span className="lf-caption text-content-faint">{t(`marketing.howItWorks.steps.${key}.number`)}</span>
                  <h3 className="lf-headline -mt-3">{t(`marketing.howItWorks.steps.${key}.title`)}</h3>
                  <p className="lf-body text-content-muted">{t(`marketing.howItWorks.steps.${key}.body`)}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-band py-20 sm:py-28">
        <div className="mx-auto grid max-w-container items-center gap-12 px-5 md:grid-cols-2 md:px-8">
          <Reveal>
            <p className="lf-label text-primary">{t('marketing.howItWorks.lesson.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3 max-w-lg">{t('marketing.howItWorks.lesson.title')}</h2>
            <p className="lf-body-lg mt-4 max-w-lg text-content-muted">{t('marketing.howItWorks.lesson.body')}</p>
            <div className="mt-8 space-y-4">
              {LESSON_MOMENTS.map(({ key, icon }) => (
                <div key={key} className="flex items-start gap-3">
                  <IconChip tone="primary" size="md">
                    <Icon name={icon} fill />
                  </IconChip>
                  <div className="pt-1">
                    <p className="lf-title">{t(`marketing.howItWorks.lesson.moments.${key}.title`)}</p>
                    <p className="lf-body mt-1 text-content-muted">{t(`marketing.howItWorks.lesson.moments.${key}.body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <Card hero className="relative overflow-hidden p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <Badge className="bg-primary-soft text-primary">{t('marketing.howItWorks.lesson.card.badge')}</Badge>
                <span className="lf-caption text-content-muted">{t('marketing.howItWorks.lesson.card.progress')}</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full w-3/5 rounded-full bg-primary" />
              </div>
              <p className="lf-headline mt-7">{t('marketing.howItWorks.lesson.card.prompt')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {['one', 'two', 'three', 'four'].map((answer) => (
                  <div key={answer} className="flex min-h-20 items-center justify-center rounded-md bg-surface p-3 text-center shadow-glass-sm">
                    <span className="lf-label text-content-muted">{t(`marketing.howItWorks.lesson.card.answers.${answer}`)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-md bg-delight-soft p-4 text-delight">
                <Icon name="celebration" fill />
                <span className="lf-label">{t('marketing.howItWorks.lesson.card.feedback')}</span>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      <Reveal as="section" className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Card hero className="mx-auto max-w-4xl text-center">
            <p className="lf-label text-primary">{t('marketing.howItWorks.closing.eyebrow')}</p>
            <h2 className="lf-display-lg mt-3">{t('marketing.howItWorks.closing.title')}</h2>
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
