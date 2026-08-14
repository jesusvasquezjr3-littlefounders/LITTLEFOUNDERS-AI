import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { trackMarketingGoal } from '@/lib/analytics';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Card, Icon, IconChip, Reveal } from '@/components/ui';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import { GeometricBackground } from '@/components/backgrounds/GeometricBackground';
import { TechnologyGraph } from './TechnologyGraph';
import './Landing.css';

/* DESIGN.md §Screen Recipes → Landing. This is a marketing narrative, not a
   product specification: invitation → learning experience → proof → CTA. */

const VALUES = [
  { key: 'short', icon: 'auto_stories', tone: 'primary' },
  { key: 'handsOn', icon: 'extension', tone: 'accent' },
  { key: 'growing', icon: 'trending_up', tone: 'delight' },
] as const;

export function Landing() {
  const { t } = useTranslation();
  const { session, meLoaded, startGuestSession } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState(false);
  const ctaTo = session ? APP_HOME : '/signup';
  const ctaLabel = session ? t('dashboard.continueCta') : t('marketing.hero.ctaPrimary');

  // Guest-first entry (Duolingo-style, no signup friction): the primary CTA
  // starts a guest session and drops the visitor straight into onboarding.
  // Signed-in visitors keep the plain declarative Link above (ctaTo).
  async function startAsGuest() {
    /*
     * The acquisition conversion. Reported BEFORE the await, not after: the
     * call navigates away on success, and an event fired after a route change
     * would be attributed to the destination rather than to the marketing
     * page that actually earned it.
     *
     * trackMarketingGoal re-checks the same gate the pageview path uses, so
     * this is a no-op for a signed-in visitor, a non-consented one, or any
     * surface outside the public marketing set — this component never has to
     * reason about the boundary itself.
     */
    trackMarketingGoal('guest_start', { pathname, session, meLoaded });
    setStartingGuest(true);
    setGuestError(false);
    const { error } = await startGuestSession();
    setStartingGuest(false);
    if (error) {
      setGuestError(true);
      return;
    }
    navigate('/onboarding');
  }

  function PrimaryCta({
    dataCta,
    wrapperClassName,
    buttonClassName,
  }: {
    dataCta: string;
    wrapperClassName?: string;
    buttonClassName?: string;
  }) {
    if (session) {
      return (
        <Link
          to={ctaTo}
          data-cta={dataCta}
          className={wrapperClassName}
          onClick={() => trackMarketingGoal('cta_signup_start', { pathname, session, meLoaded })}
        >
          <Button className={`group ${buttonClassName ?? ''}`}>
            {ctaLabel}
            <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
          </Button>
        </Link>
      );
    }
    return (
      <Button
        data-cta={dataCta}
        className={`group ${buttonClassName ?? ''}`}
        disabled={startingGuest}
        onClick={() => void startAsGuest()}
      >
        {startingGuest ? t('marketing.hero.ctaStarting') : ctaLabel}
        <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
      </Button>
    );
  }

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-inverse text-on-inverse">
        <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-none">
          <Reveal delay={80}><TechnologyGraph showTitle={false} /></Reveal>
          <div className="lf-landing-hero-copy absolute z-10 flex max-w-xl flex-col items-start px-5 md:px-8">
            <h1 className="lf-display-xl max-w-lg">
              {t('marketing.hero.titleLead')}
              <span className="block text-primary">{t('marketing.hero.titleHighlight')}</span>
            </h1>
            <p className="lf-body-lg mt-6 max-w-xl text-on-inverse-muted">{t('marketing.hero.subtitle')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PrimaryCta dataCta="hero-primary" wrapperClassName="sm:inline-block" buttonClassName="w-full sm:w-auto" />
              <Link
                to="/how-it-works"
                data-cta="hero-secondary"
                className="sm:inline-block"
                onClick={() => trackMarketingGoal('cta_secondary', { pathname, session, meLoaded })}
              >
                <Button variant="secondary" className="w-full border-white/20 bg-white/10 text-on-inverse hover:border-white/40 hover:bg-white/15 hover:text-on-inverse sm:w-auto">
                  <Icon name="play_circle" />
                  {t('marketing.hero.ctaSecondary')}
                </Button>
              </Link>
            </div>
            {guestError && (
              <p role="alert" className="lf-caption mt-3 text-error-strong">
                {t('marketing.hero.guestError')}
              </p>
            )}
            {!session && (
              <div className="sr-only">
                <Link to="/login">{t('marketing.hero.loginLink')}</Link>
                <Link to="/signup">{t('marketing.hero.signupLink')}</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-base overflow-hidden py-16 sm:py-24">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left column: Character scene */}
            <div className="lf-hero-scene">
              <div className="lf-hero-scene__stage">
                <GeometricBackground className="z-0" />
                <CharacterActor
                  character="liruf"
                  emotion="excited"
                  size="fill"
                  enableMouseTracking={false}
                  className="lf-hero-scene__char lf-hero-scene__char--liruf"
                />
                <CharacterActor
                  character="rho"
                  emotion="happy"
                  size="fill"
                  enableMouseTracking={false}
                  className="lf-hero-scene__char lf-hero-scene__char--rho"
                />
                <CharacterActor
                  character="dina"
                  emotion="happy"
                  size="fill"
                  enableMouseTracking={false}
                  className="lf-hero-scene__char lf-hero-scene__char--dina"
                />
                <CharacterActor
                  character="zara"
                  emotion="proud"
                  size="fill"
                  enableMouseTracking={false}
                  className="lf-hero-scene__char lf-hero-scene__char--zara"
                />
                <span className="lf-hero-scene__blob lf-hero-scene__blob--a" />
                <span className="lf-hero-scene__blob lf-hero-scene__blob--b" />
              </div>
            </div>

            {/* Right column: Pitch text */}
            <Reveal delay={80} className="flex flex-col gap-6">
              <h2 className="lf-display-lg">{t('marketing.journey.heading')}</h2>
              <p className="lf-body-lg text-content-muted">{t('marketing.journey.intro')}</p>

              <ul className="space-y-4">
                <li className="flex gap-4">
                  <Icon name="check_circle" className="text-primary flex-shrink-0 mt-1" />
                  <span className="lf-body text-content">{t('marketing.journey.guided')}</span>
                </li>
                <li className="flex gap-4">
                  <Icon name="check_circle" className="text-primary flex-shrink-0 mt-1" />
                  <span className="lf-body text-content">{t('marketing.journey.free')}</span>
                </li>
                <li className="flex gap-4">
                  <Icon name="check_circle" className="text-primary flex-shrink-0 mt-1" />
                  <span className="lf-body text-content">{t('marketing.journey.fun')}</span>
                </li>
                <li className="flex gap-4">
                  <Icon name="check_circle" className="text-primary flex-shrink-0 mt-1" />
                  <span className="lf-body text-content">{t('marketing.journey.safe')}</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="lf-display-lg">{t('marketing.fact.heading')}</h2>
              <p className="lf-body-lg mt-6 text-content-muted">{t('marketing.fact.intro')}</p>

              <div className="mt-10 space-y-2">
                <p className="lf-number lf-display-md text-primary">{t('marketing.fact.stat')}</p>
                <p className="lf-body text-content">{t('marketing.fact.title')}</p>
                <p className="lf-caption text-content-faint">{t('marketing.fact.source')}</p>
              </div>
            </div>

            <img
              src="https://images.pexels.com/photos/4260325/pexels-photo-4260325.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt={t('marketing.fact.imageAlt')}
              className="hidden lg:block aspect-video w-full rounded-xl object-cover shadow-glass"
            />
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
              <h2 className="lf-display-lg max-w-xl">{t('marketing.family.title')}</h2>
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
              <h2 className="lf-display-lg">{t('marketing.finalCta.title')}</h2>
              <p className="lf-body-lg mt-4 text-content-muted">{t('marketing.finalCta.body')}</p>
              <PrimaryCta dataCta="final-primary" wrapperClassName="mt-7 inline-block" buttonClassName="mt-7" />
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
