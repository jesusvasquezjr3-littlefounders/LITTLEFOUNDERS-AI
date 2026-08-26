import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { trackMarketingGoal } from "@/lib/analytics";
import { APP_HOME } from "@/routes/app/navConfig";
import { Button, Card, Icon, LottieIcon, Reveal } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import { TechnologyGraph } from "./TechnologyGraph";
import { useAlphaVideoSupport, usePrefersReducedMotion } from "./alphaVideo";
import "./Landing.css";

/* DESIGN.md §Screen Recipes → Landing. This is a marketing narrative, not a
   product specification: invitation → learning experience → proof → CTA. */

export function Landing() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  /*
   * Which diorama the hero can actually show. See ./alphaVideo — the clip is a
   * cut-out, so a browser that ignores WebM's alpha channel would paint a black
   * rectangle rather than an island. `null` means the one-off probe has not
   * answered yet, and the honest render for that is nothing: the stage has a
   * fixed height so nothing shifts, and the section sits a viewport below the
   * fold. Guessing "video" would risk the black box; guessing "still" would
   * download an image most visitors then replace.
   */
  const alphaVideo = useAlphaVideoSupport();
  const reducedMotion = usePrefersReducedMotion();
  const { session, meLoaded, startGuestSession } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState(false);
  const ctaTo = session ? APP_HOME : "/signup";
  const ctaLabel = session
    ? t("dashboard.continueCta")
    : t("marketing.hero.ctaPrimary");

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
    trackMarketingGoal("guest_start", { pathname, session, meLoaded });
    setStartingGuest(true);
    setGuestError(false);
    const { error } = await startGuestSession();
    setStartingGuest(false);
    if (error) {
      setGuestError(true);
      return;
    }
    navigate("/onboarding");
  }

  /*
   * `guestLabel` overrides the wording for a VISITOR only. The signed-in branch
   * deliberately cannot be relabelled: /AGENTS.md §1.13 requires a marketing
   * CTA to be session-aware, and someone with a session gets "continue where
   * you left off" pointing at the dashboard no matter which button they found.
   */
  function PrimaryCta({
    dataCta,
    wrapperClassName,
    buttonClassName,
    guestLabel,
  }: {
    dataCta: string;
    wrapperClassName?: string;
    buttonClassName?: string;
    guestLabel?: string;
  }) {
    if (session) {
      return (
        <Link
          to={ctaTo}
          data-cta={dataCta}
          className={wrapperClassName}
          onClick={() =>
            trackMarketingGoal("cta_signup_start", {
              pathname,
              session,
              meLoaded,
            })
          }
        >
          <Button className={`group ${buttonClassName ?? ""}`}>
            {ctaLabel}
            <Icon
              name="arrow_forward"
              className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
            />
          </Button>
        </Link>
      );
    }
    return (
      <Button
        data-cta={dataCta}
        className={`group ${buttonClassName ?? ""}`}
        disabled={startingGuest}
        onClick={() => void startAsGuest()}
      >
        {startingGuest
          ? t("marketing.hero.ctaStarting")
          : (guestLabel ?? ctaLabel)}
        <Icon
          name="arrow_forward"
          className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
        />
      </Button>
    );
  }

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-base text-content dark:bg-inverse dark:text-on-inverse">
        <div
          className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-none">
          <Reveal delay={80}>
            <TechnologyGraph showTitle={false} />
          </Reveal>
          <div className="lf-landing-hero-copy absolute z-10 flex max-w-xl flex-col items-start px-5 md:max-w-2xl md:px-8">
            <h1 className="lf-display-xl">
              {t("marketing.hero.titleLead")}
              <span className="lf-hero-highlight block text-primary">
                {t("marketing.hero.titleHighlight")}
              </span>
            </h1>
            <p className="lf-body mt-6 max-w-xl text-content-muted dark:text-on-inverse-muted">
              {t("marketing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PrimaryCta
                dataCta="hero-primary"
                wrapperClassName="sm:inline-block"
                buttonClassName="w-full sm:w-auto"
              />
              {/* "I already have an account" only makes sense for a guest — a
                  signed-in visitor already sees "Continue where you left off"
                  as the primary CTA, and offering them a login link too reads
                  as a redundant, confusing pair. */}
              {!session && (
                <Link
                  to="/login"
                  data-cta="hero-secondary"
                  className="sm:inline-block"
                  onClick={() =>
                    trackMarketingGoal("cta_secondary", {
                      pathname,
                      session,
                      meLoaded,
                    })
                  }
                >
                  <Button
                    variant="secondary"
                    className="w-full border-content/15 bg-content/5 text-content hover:border-content/30 hover:bg-content/10 hover:text-content dark:border-white/20 dark:bg-white/10 dark:text-on-inverse dark:hover:border-white/40 dark:hover:bg-white/15 dark:hover:text-on-inverse sm:w-auto"
                  >
                    <Icon name="login" />
                    {t("marketing.hero.ctaSecondary")}
                  </Button>
                </Link>
              )}
            </div>
            {guestError && (
              <p role="alert" className="lf-caption mt-3 text-error-strong">
                {t("marketing.hero.guestError")}
              </p>
            )}
            {!session && (
              <div className="sr-only">
                <Link to="/login">{t("marketing.hero.loginLink")}</Link>
                <Link to="/signup">{t("marketing.hero.signupLink")}</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-base overflow-hidden py-16 sm:py-24">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left column: the Tutor diorama, pre-rendered.
                Real 3D — all FOUR canonical characters (Dina, Liruf, Rho,
                Zara) on the real island, captured off the real stage rather
                than run as a live WebGL canvas. Four at once is the scene's
                own `audition` arrangement (TutorScene → cast.standingCast),
                which is the only one that stages the whole catalog; note it
                also turns the shadow pass off by its own budget argument, so
                the absence of cast shadows here is the product's decision and
                not a fault in the capture. Landing is an eager route and
                frontend/AGENTS.md is explicit that `three` may only load
                behind a lazy one, so mounting the real Diorama/TutorScene
                component here was never on the table — this gets the same
                visual with none of the runtime GPU cost.

                The cast is dancing (`action="dance"`, which the engine lists in
                LOOPING_ACTIONS so nobody drops back to idle), because the idle
                pose had nothing to loop: its whole ambient motion measured
                0.2 px peak to peak at this framing, and the movement the
                retired GIF seemed to have was its own palette dithering
                flickering between frames.

                IT IS A REAL LOOP, AND THAT TOOK WORK. Nothing here returns to
                where it started on its own. The bipeds sway at 3.4 rad/s while
                the quadrupeds wag at 4.5 and swing their hips at 3.2 — as
                34 : 45 : 32 that is a common period of 62.8 SECONDS, and the
                ambient camera swing (ORBIT_RATE 0.04) is 157 s on top. So the
                clip is a PING-PONG: half a biped sway forward and the same
                frames back, which returns to frame 0 by construction whatever
                the phases are doing. The camera's own sub-pixel drift is
                registered out first, off the island's centroid with the cast
                masked, on the 2400x1800 capture before the downsample — which
                also holds the scenery still enough for the encoder to spend
                its bytes on the dancers. Measured after: the wrap is 0.74x the
                largest ordinary step in the loop, i.e. not the seam.

                IT IS A VIDEO, NOT AN ANIMATED IMAGE, and the reason is the
                frame rate. Animated WebP and GIF have no motion compensation:
                every frame re-encodes the whole changed rectangle as a fresh
                image, and here that rectangle is 59% of the picture. The 13 fps
                WebP this replaces cost 2.33 MB, and 24 fps would have cost
                about 4 MB — a property of the format, not a setting. VP9 in
                WebM predicts between frames and decodes in hardware, so the
                same 42 frames at 24 fps are 572 KB, and a decode of frame 0 is
                measurably CLOSER to the lossless render (mean error 1.14/255)
                than the q92 WebP still beside it (2.46). Lottie was considered
                and does not apply: it is a VECTOR format, and a textured 3D
                render has no vector form — the only way in is a sequence of
                embedded PNGs, which is heavier than the WebP and composites on
                the CPU every frame, which is the opposite of the goal.

                MARKETING RENDERS ARE MAXIMUM QUALITY (owner rule 2026-08-25),
                and that is the opposite of the Tutor's constraint, not a
                relaxation of it: the Tutor has a real frame budget on a real
                phone, a still has none. So this is captured from the ARTIST
                SOURCE .glb exports (1.9 M triangles on screen — the runtime
                stage draws a small fraction of that), on the `high` quality
                tier, at 2400x1800, and downsampled 2:1 with Lanczos-3 so the
                supersample fixes the aliasing INSIDE textured surfaces that
                MSAA cannot touch. It supersedes an animated GIF, whose
                256-colour palette dithered every gradient and whose 1-bit
                alpha cut a hard aliased edge around the island; WebP carries
                the render's real colour and an 8-bit alpha, and at 1200x900
                it is 2.9x the outgoing asset's linear resolution.

                Light/dark are two separately-captured clips, not a CSS
                filter over one: light uses the stage's `auto` backdrop, dark
                uses the `dusk` backdrop (backdrops.ts) so the dark hero shows
                a real sunset — warm low sun, long shadows — rather than the
                flat night palette `auto` resolves to in dark theme. Swapped
                by JS so only one clip ever downloads, and lazily because this
                section sits a full viewport below the fold. */}
            <div className="lf-hero-scene">
              <div className="lf-hero-scene__stage">
                <span className="lf-hero-scene__blob lf-hero-scene__blob--a" />
                <span className="lf-hero-scene__blob lf-hero-scene__blob--b" />
                {alphaVideo === null ? null : alphaVideo && !reducedMotion ? (
                  <video
                    key={isDark ? "dark" : "light"}
                    src={
                      isDark
                        ? "/marketing/hero-diorama-dark.webm"
                        : "/marketing/hero-diorama-light.webm"
                    }
                    width={1200}
                    height={900}
                    autoPlay
                    loop
                    muted
                    playsInline
                    /* `none`, with autoplay doing the fetching: a muted autoplay
                       video only starts once it is on screen, so this is the
                       `loading="lazy"` the <img> used to carry. */
                    preload="none"
                    aria-hidden="true"
                    className="lf-hero-scene__diorama"
                  />
                ) : (
                  <img
                    src={
                      isDark
                        ? "/marketing/hero-diorama-dark.webp"
                        : "/marketing/hero-diorama-light.webp"
                    }
                    alt=""
                    aria-hidden="true"
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    className="lf-hero-scene__diorama"
                  />
                )}
                {/* Reward preview Lotties, decorative-only per lottie/README.md
                    "Marketing / decorative preview use": streak/lesson/gold-coin
                    only, always Activated + default colors + a fixed placeholder
                    value (never a claim about a real visitor's stats). */}
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--streak"
                  aria-hidden="true"
                >
                  <LottieIcon
                    name="streak"
                    value={7}
                    activated
                    className="h-full w-full"
                  />
                </div>
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--lesson"
                  aria-hidden="true"
                >
                  <LottieIcon
                    name="lesson"
                    value={12}
                    activated
                    className="h-full w-full"
                  />
                </div>
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--coin"
                  aria-hidden="true"
                >
                  <LottieIcon
                    name="gold-coin"
                    value={40}
                    activated
                    className="h-full w-full"
                  />
                </div>
                {/* Small decorative finance-glyph sparks, not stat animations —
                    plain Material Symbols (frontend/AGENTS.md's icon rule),
                    not new Lottie files, so the lottie/README.md "Marketing /
                    decorative preview use" exception (limited to exactly
                    streak/lesson/gold-coin) stays untouched. Purely to add
                    floating density around the diorama; hidden on mobile
                    (Landing.css) where the stage itself is already tight. */}
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--spark lf-hero-scene__bubble--trending"
                  aria-hidden="true"
                >
                  <Icon name="trending_up" className="text-delight" />
                </div>
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--spark lf-hero-scene__bubble--savings"
                  aria-hidden="true"
                >
                  <Icon name="savings" className="text-secondary" />
                </div>
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--spark lf-hero-scene__bubble--payments"
                  aria-hidden="true"
                >
                  <Icon name="payments" className="text-primary" />
                </div>
                <div
                  className="lf-hero-scene__bubble lf-hero-scene__bubble--spark lf-hero-scene__bubble--bank"
                  aria-hidden="true"
                >
                  <Icon name="account_balance" className="text-accent-strong" />
                </div>
              </div>
            </div>

            {/* Right column: Pitch text */}
            <Reveal delay={80} className="flex flex-col gap-6">
              <h2 className="lf-display-xl">
                {t("marketing.journey.heading")}
              </h2>
              <p className="lf-body-lg text-content-muted">
                {t("marketing.journey.intro")}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* `flex items-center` so the extra height the slot floor buys shows up as
          air ABOVE and BELOW the content rather than as a gap hanging off the
          bottom — the section is now taller than what is in it. */}
      <section className="lf-band-slot flex items-center bg-band py-20 text-content sm:py-28">
        <div className="mx-auto w-full max-w-container px-5 md:px-8">
          <Reveal className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="lf-display-xl">{t("marketing.fact.heading")}</h2>
              <p className="lf-body-lg mt-6 text-content-muted">
                {t("marketing.fact.intro")}
              </p>
              <p className="lf-caption mt-6 text-content-faint">
                {t("marketing.fact.source")}
              </p>
            </div>

            {/* Card-stack composition, replacing the stock photo.
                Alludes to the platform's own resources (a lesson, a
                multiple-choice exercise, a progress readout) without
                rendering any real text — every "line" is a rounded bar, per
                the brief. Fans out from a stacked deck on scroll-into-view
                (one Reveal, CSS transition — not the Scroll-driven
                Animations API, which still has no Safari/Firefox baseline
                and this platform's whole reason to exist right now is NOT
                shipping another browser-specific rendering gap), then each
                card idles on its own slow float. Everything animated is
                `transform`/`opacity` only — GPU-composited, no per-frame
                JS, cheap enough for a low-end phone. */}
            {/* Shown at EVERY breakpoint. It was `hidden lg:block`, so the one
                  composition that carries this section visually did not exist below
                  1024px - the statistic arrived on a phone as three lines of text on
                  an empty band. Nothing here needed a wide viewport: every card is
                  positioned and sized in PERCENTAGES of the stack, so the whole deck
                  is resolution-independent and simply gets smaller. Capped at
                  `max-w-sm` below lg and centred: at a single-column width the 4:3
                  deck would otherwise be 836px tall on a tablet and take the band
                  past a full viewport on its own. */}
            <Reveal
              className="lf-fact-stack relative mx-auto aspect-[4/3] w-full max-w-[17rem] sm:max-w-sm lg:max-w-none"
              aria-hidden="true"
            >
              <span className="lf-fact-stack__glow" />

              {/* Each card carries a REAL platform asset, not an invented
                  abstraction: the exact `LottieIcon` clips already running
                  in the hero above (lesson/streak — two of the three
                  lottie/README.md clears for decorative marketing use), and
                  a mic orb built from the Tutor's own MicOrb recipe (flat
                  accent fill, dashed track ring, the same 4s breathe
                  keyframe) rather than a generic circle-with-icon. This is
                  what makes a card unmistakably OURS instead of a stock
                  dashboard shape that happens to be colourful. */}
              <div className="lf-fact-card lf-fact-card--tutor">
                <div className="lf-fact-card__inner">
                  <span className="lf-fact-card__icon bg-warning-soft text-warning-strong">
                    <Icon name="smart_toy" />
                  </span>
                  <span className="lf-fact-card__line--title" />
                  <span className="lf-fact-card__orb-wrap">
                    <span className="lf-fact-card__orb-track" />
                    <span className="lf-fact-card__orb">
                      <Icon name="mic" fill />
                    </span>
                  </span>
                  <span className="lf-fact-card__caption" />
                </div>
              </div>

              <div className="lf-fact-card lf-fact-card--lessons">
                <div className="lf-fact-card__inner">
                  <span className="lf-fact-card__icon bg-primary-soft text-primary">
                    <Icon name="auto_stories" />
                  </span>
                  <span className="lf-fact-card__line--title" />
                  <span className="lf-fact-card__lottie-wrap">
                    <LottieIcon
                      name="lesson"
                      value={12}
                      activated
                      className="h-full w-full"
                    />
                  </span>
                  <span className="lf-fact-card__steps">
                    <span className="lf-fact-card__step lf-fact-card__step--done" />
                    <span className="lf-fact-card__step lf-fact-card__step--done" />
                    <span className="lf-fact-card__step lf-fact-card__step--current" />
                    <span className="lf-fact-card__step" />
                    <span className="lf-fact-card__step" />
                  </span>
                </div>
              </div>

              <div className="lf-fact-card lf-fact-card--practice">
                <div className="lf-fact-card__inner">
                  <span className="lf-fact-card__icon bg-delight-soft text-delight">
                    <Icon name="extension" />
                  </span>
                  <span className="lf-fact-card__line--title" />
                  <span className="lf-fact-card__glass-panel" />
                  <span className="lf-fact-card__options">
                    <span className="lf-fact-card__option" />
                    <span className="lf-fact-card__option" />
                    <span className="lf-fact-card__option lf-fact-card__option--active">
                      <Icon name="check" />
                    </span>
                  </span>
                </div>
              </div>

              <div className="lf-fact-card lf-fact-card--progress">
                <div className="lf-fact-card__inner">
                  <span className="lf-fact-card__icon bg-success-soft text-success">
                    <Icon name="insights" />
                  </span>
                  <span className="lf-fact-card__line--title" />
                  <span className="lf-fact-card__lottie-wrap">
                    <LottieIcon
                      name="streak"
                      value={7}
                      activated
                      className="h-full w-full"
                    />
                  </span>
                  <span className="lf-fact-card__stat">
                    <span className="lf-fact-card__stat-line" />
                  </span>
                </div>
              </div>
            </Reveal>
          </Reveal>
        </div>
      </section>

      {/* THE FREE FALL. Zara, Liruf and Dina, the same height as the band above
          by sharing `lf-band-slot` rather than by repeating its numbers, and
          centred on both axes inside it.

          Captured off three artist-source exports at 2400x1800 and downsampled
          2:1, same pipeline as the hero diorama, and delivered the same way: a
          VP9-alpha `<video>` where the browser honours WebM's alpha channel
          (see ./alphaVideo) and a max-quality still everywhere else. ONE file
          serves both themes here, unlike the diorama - the light rig is our own
          and neutral rather than a time of day, so nothing about the clip
          changes between light and dark.

          Zara and Liruf play Meshy's `Fall1`, which is authored as a closed
          cycle: measured, its wrap costs 16.26 against 16.33 for an ordinary
          1/24 s step, so the seam IS an ordinary step and the real secondary
          motion survives. Dina has no clip at all - one static mesh, no skin -
          so her float is applied at capture time as EXACTLY ONE sine cycle
          across the loop, which closes by construction. Her orientation is not
          hand-tuned either: it is the minimal rotation that reproduces, under
          this camera, the view she was chosen from. */}
      <section
        className="lf-band-slot relative flex items-center justify-center overflow-hidden bg-band text-content"
        data-slot="fact-next"
      >
        {/* Speed lines, and they are CSS rather than pixels in the clip on
            purpose. Baking them into the render would put streaks across most
            of the frame, which is the one thing a video codec cannot compress
            cheaply - the whole reason this section is 510 KB and not four
            megabytes is that 90% of it never changes. As DOM they cost nothing
            to download, scale to any viewport, and move on `transform`/`opacity`
            alone, which is the closed motion system /DESIGN.md allows.

            They travel UPWARD: a falling body is read from the world streaking
            up past it, not from the body itself moving down the frame. */}
        <span className="lf-fall-vfx" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} />
          ))}
        </span>
        {/* Wider than the column on a phone, on purpose. The slot matches the
            band above it, and below lg that band is TALL because it stacks its
            card deck under the text, so a width-bound 4:3 artwork sat in the
            middle of it at a third of its height. The cast occupies 11% to 86%
            of the frame's width, so up to 1.34x can bleed off the sides before
            anyone is clipped; 1.30x takes the artwork past half the slot's
            height and still keeps the margin. `overflow-hidden` on the section is what makes
            that safe rather than a horizontal scrollbar (§1.11). */}
        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="w-[130%] max-w-none shrink-0 sm:w-full sm:max-w-[32rem] lg:max-w-[40rem]">
            {alphaVideo === null ? null : alphaVideo && !reducedMotion ? (
              <video
                src="/marketing/free-fall.webm"
                width={1200}
                height={900}
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                aria-hidden="true"
                className="lf-fall-scene"
              />
            ) : (
              <img
                src="/marketing/free-fall.webp"
                alt=""
                aria-hidden="true"
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="lf-fall-scene"
              />
            )}
          </div>

          {/* The argument the composition is illustrating. Styled off the
            sections that already carry a claim and its expansion
            (`marketing.family`, `marketing.finalCta`): `lf-display-lg` over
            `lf-body-lg` in the muted content token, one weight below the
            statistic in the band above it, because this reads as that band's
            conclusion rather than as a competing headline. Centred, since the
            artwork above it is. */}
          <div className="mt-2 max-w-2xl px-5 text-center md:px-8">
            <h2 className="lf-display-lg">{t("marketing.legacy.heading")}</h2>
            <p className="lf-body-lg mt-4 text-content-muted">
              {t("marketing.legacy.body")}
            </p>
          </div>
        </div>
      </section>

      {/* The tab between the band and the page below it.
          Two paths, not one stroked shape: the fill is closed across the top,
          but the top edge sits against MORE BAND, so stroking it would draw a
          hairline through a colour that is meant to run continuously. The edge
          path therefore traces the curve alone.

          The outline is not decoration, it is what makes this work in dark
          mode: `--lf-band` and `--lf-base` are defined to the SAME value there
          (10 14 26), so a filled tab has nothing to contrast against and would
          simply not exist. `--lf-outline` is subtle against the tint in light
          and is the whole shape in dark, and it is an existing token rather
          than a colour invented for this. */}
      <div className="lf-band-tongue bg-base" aria-hidden="true">
        {/* A DEFINED NOSE, not a flat shelf and not a swell. The tip is a
            single point at x=720 with both control points level with it, which
            keeps the tangent horizontal so the nose stays ROUND rather than
            becoming a corner. Their distance from the tip is the nose's radius:
            240 units either side gives a broad, blunt tip, where 80 gave a
            narrow V. The shoulder controls sit just outside them (1020 / 420),
            which is what keeps the sides steep while the bottom stays wide. */}
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" focusable="false">
          <path
            className="lf-band-tongue__fill"
            d="M0 0 H1440 C1020 0 960 200 720 200 C480 200 420 0 0 0 Z"
          />
          <path
            className="lf-band-tongue__edge"
            d="M1440 0 C1020 0 960 200 720 200 C480 200 420 0 0 0"
          />
        </svg>

        {/* Rho diving out of the tab. Posed rather than animated: his export
            carries one clip, `walking_man`, and no fall of any kind, so the
            dive is his bind pose with both arms rotated in against his body,
            composed onto each bone's bind rotation rather than assigned over
            it. The orientation is not hand-tuned either - it reproduces, under
            this camera, the view a camera
            34 degrees above him would have, so the viewer still looks DOWN on
            him and he still reads as being below and descending. His head is
            then craned back on top of that, which is what turns "falling away
            from you" into "leading you and checking you are following". His
            float is one sine cycle across the loop, so it closes by
            construction. */}
        {alphaVideo === null ? null : alphaVideo && !reducedMotion ? (
          <video
            src="/marketing/rho-dive.webm"
            width={430}
            height={858}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            aria-hidden="true"
            className="lf-band-tongue__diver"
          />
        ) : (
          <img
            src="/marketing/rho-dive.webp"
            alt=""
            aria-hidden="true"
            width={430}
            height={858}
            loading="lazy"
            decoding="async"
            className="lf-band-tongue__diver"
          />
        )}
      </div>

      {/* One statement, centred on both axes, and nothing else in the section.
          The claim carries `lf-display-lg` and the question `lf-body-lg` in the
          muted token, which is the treatment every other claim-and-expansion
          block on this page already uses (`marketing.legacy`,
          `marketing.finalCta`). Two keys rather than one so the question can
          take the second weight; the words and their order are unchanged. */}
      <section className="flex bg-base py-20 sm:py-28">
        <Reveal className="mx-auto flex max-w-container flex-col items-center justify-center px-5 text-center md:px-8">
          <h2 className="lf-display-lg max-w-3xl">
            {t("marketing.family.heading")}
          </h2>
          <p className="lf-body-lg mt-4 max-w-2xl text-content-muted">
            {t("marketing.family.body")}
          </p>
        </Reveal>
      </section>

      <Reveal as="section" className="bg-band py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Card
            hero
            className="grid items-center gap-8 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div>
              <h2 className="lf-display-lg">{t("marketing.finalCta.title")}</h2>
              <p className="lf-body-lg mt-4 text-content-muted">
                {t("marketing.finalCta.body")}
              </p>
              <PrimaryCta
                dataCta="final-primary"
                wrapperClassName="mt-7 inline-block"
                buttonClassName="mt-7"
                guestLabel={t("marketing.finalCta.cta")}
              />
            </div>
            <img
              src="/marketing/pexels-kid-piggybank-12955547.jpg"
              alt={t("marketing.finalCta.imageAlt")}
              className="aspect-[3/2] w-full rounded-lg object-cover shadow-glass"
            />
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
