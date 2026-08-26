import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Card, Icon, IconChip, LottieIcon, Reveal } from '@/components/ui';
import { TechnologyGraph } from './TechnologyGraph';
import './HowItWorks.css';

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
      <section className="relative isolate overflow-hidden bg-base text-content dark:bg-inverse dark:text-on-inverse">
        <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-none">
          <Reveal className="lf-how-hero-copy pointer-events-none absolute z-10 max-w-xl px-5 md:px-0">
            <h1 className="lf-display-xl">{t('marketing.howItWorks.title')}</h1>
            <p className="lf-body-lg mt-6 text-content-muted dark:text-on-inverse-muted">{t('marketing.howItWorks.intro')}</p>
          </Reveal>
          <Reveal delay={80}><TechnologyGraph showTitle={false} /></Reveal>
        </div>
      </section>

      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal delay={80}>
              <h2 className="lf-display-lg">{t('marketing.technology.parentTitle')}</h2>
              <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.technology.parentBody')}</p>
              <div className="mt-8 space-y-5">
                {['visible', 'adaptive', 'private'].map((key) => (
                  <div key={key} className="flex items-start gap-4">
                    <IconChip tone={key === 'private' ? 'success' : 'primary'} size="md">
                      <Icon name={t(`marketing.technology.parentPoints.${key}.icon`)} fill />
                    </IconChip>
                    <div className="pt-1">
                      <h3 className="lf-title">{t(`marketing.technology.parentPoints.${key}.title`)}</h3>
                      <p className="lf-body mt-1 text-content-muted">{t(`marketing.technology.parentPoints.${key}.body`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Wordless motion graphic: a live growth readout — three
                metrics climbing on a loop, plus the platform's own
                Lessons-Completed Lottie asset. Just the elements, no
                panel, previewing the parent-dashboard promise above. */}
            <div className="lf-growth" aria-hidden="true">
              <div className="lf-growth__row">
                <IconChip tone="primary" size="lg"><Icon name="auto_stories" fill /></IconChip>
                <span className="lf-growth__track"><span className="lf-growth__fill lf-growth__fill--1" /></span>
              </div>
              <div className="lf-growth__row">
                <IconChip tone="success" size="lg"><Icon name="trending_up" fill /></IconChip>
                <span className="lf-growth__track"><span className="lf-growth__fill lf-growth__fill--2" /></span>
              </div>
              <div className="lf-growth__row">
                <IconChip tone="delight" size="lg"><Icon name="emoji_events" fill /></IconChip>
                <span className="lf-growth__track"><span className="lf-growth__fill lf-growth__fill--3" /></span>
              </div>
              <LottieIcon name="lesson" value={1} activated className="lf-growth__badge" />
              <span className="lf-growth__live"><span className="lf-growth__live-dot" /></span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-band py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="lf-display-lg">{t('marketing.howItWorks.steps.title')}</h2>
          </Reveal>

          {/* Wordless motion graphic: the lesson path itself (Duolingo's own
              visual language) — a winding track with the three step icons as
              nodes and a glowing runner that travels and pauses at each one,
              on a loop. Just the elements, no panel behind them. Decorative
              preview of the three cards below, which carry the real content. */}
          <div className="lf-path" aria-hidden="true">
            <svg className="lf-path__track" viewBox="0 0 480 110">
              <path d="M24 82 Q 150 14, 240 55 T 456 28" />
            </svg>
            <span className="lf-path__node lf-path__node--1"><IconChip tone="primary" size="lg" className="!h-[4.5rem] !w-[4.5rem] !text-[2rem]"><Icon name={LESSON_STEPS[0].icon} fill /></IconChip></span>
            <span className="lf-path__node lf-path__node--2"><IconChip tone="accent" size="lg" className="!h-[4.5rem] !w-[4.5rem] !text-[2rem]"><Icon name={LESSON_STEPS[1].icon} fill /></IconChip></span>
            <span className="lf-path__node lf-path__node--3"><IconChip tone="delight" size="lg" className="!h-[4.5rem] !w-[4.5rem] !text-[2rem]"><Icon name={LESSON_STEPS[2].icon} fill /></IconChip></span>
            <span className="lf-path__runner" />
          </div>

          <div className="mt-12 grid gap-8 border-t border-content/10 md:grid-cols-3 md:gap-6">
            {LESSON_STEPS.map(({ key, icon, tone }, index) => (
              <Reveal key={key} delay={index * 80}>
                <div className="relative flex h-full flex-col gap-5 border-b border-content/10 pb-8 pt-6 md:border-b-0 md:border-r md:pr-6 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="lf-display-lg text-primary/35">{t(`marketing.howItWorks.steps.${key}.number`)}</span>
                    <IconChip tone={tone} size="lg"><Icon name={icon} fill /></IconChip>
                  </div>
                  <h3 className="lf-headline">{t(`marketing.howItWorks.steps.${key}.title`)}</h3>
                  <p className="lf-body text-content-muted">{t(`marketing.howItWorks.steps.${key}.body`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-band py-20 sm:py-28">
        <div className="mx-auto grid max-w-container items-center gap-12 px-5 md:grid-cols-2 md:px-8">
          <Reveal>
            <h2 className="lf-display-lg max-w-lg">{t('marketing.howItWorks.lesson.title')}</h2>
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
            {/* Wordless motion-graphic demo: a tilted, Duolingo-style
                device scene playing the tap → correct → celebrate →
                progress loop with the platform's own reward assets
                (gold-coin / streak Lottie, frontend/public/lottie). Just
                the elements themselves — no panel behind them, same
                grammar as the knowledge tree and character scene. No
                i18n copy inside — see
                marketing.howItWorks.lesson.demoAriaLabel for the
                accessible description. */}
            <div className="lf-lesson-demo" role="img" aria-label={t('marketing.howItWorks.lesson.demoAriaLabel')}>
              <div className="lf-lesson-demo__stage">
                <div className="lf-lesson-demo__glow" aria-hidden="true" />

                <LottieIcon name="streak" value={7} activated className="lf-lesson-demo__streak" />

                <div className="lf-lesson-demo__frame">
                  <span className="lf-lesson-demo__notch" aria-hidden="true" />
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div className="lf-lesson-demo__progress-fill h-full w-full rounded-full bg-primary" />
                  </div>
                  <div className="lf-lesson-demo__tiles relative mt-7 grid grid-cols-2 gap-4">
                    <span className="lf-lesson-demo__tile flex min-h-24 items-center justify-center rounded-xl bg-surface shadow-glass-sm">
                      <Icon name="change_history" className="text-[26px] text-content-faint" />
                    </span>
                    <span className="lf-lesson-demo__tile flex min-h-24 items-center justify-center rounded-xl bg-surface shadow-glass-sm">
                      <Icon name="square" className="text-[26px] text-content-faint" />
                    </span>
                    <span className="lf-lesson-demo__tile-target relative flex min-h-24 items-center justify-center rounded-xl shadow-glass-sm">
                      <Icon name="check" className="lf-lesson-demo__check text-[30px] text-success" />
                    </span>
                    <span className="lf-lesson-demo__tile flex min-h-24 items-center justify-center rounded-xl bg-surface shadow-glass-sm">
                      <Icon name="circle" className="text-[26px] text-content-faint" />
                    </span>
                    <span className="lf-lesson-demo__tap" aria-hidden="true" />
                  </div>
                </div>

                <LottieIcon name="gold-coin" value={1} activated className="lf-lesson-demo__coin" />

                <div className="lf-lesson-demo__particles" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className="lf-lesson-demo__particle" />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
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
