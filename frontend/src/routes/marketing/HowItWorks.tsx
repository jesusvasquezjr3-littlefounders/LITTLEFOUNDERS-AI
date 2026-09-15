import { useTranslation } from "react-i18next";
import { Card, LottieIcon, Reveal } from "@/components/ui";
import { DecisionExercise, type DecisionOption } from "./DecisionExercise";
import { PrimaryCta } from "./PrimaryCta";
import { TechnologyGraph } from "./TechnologyGraph";
import "./HowItWorks.css";

/*
 * The page answers four questions in order: how do we teach, who teaches, what
 * does it cost to try, and why open an account. Five blocks, no more. Anything
 * that explains the machinery rather than the promise belongs in the docs.
 *
 * THE MENTORS ARE NOT RE-NAMED HERE. Their names and personalities are read
 * from `tutor.character.*`, which is where the product already keeps them. A
 * marketing copy of the same four blurbs would drift the first time a
 * personality is retuned, and the page would then contradict the Tutor itself.
 *
 * WHAT THE MENTOR BLOCK MAY CLAIM. `TUTOR_VOICE_FOR_MINORS` is false: every
 * learner gets the Tutor captioned and typed, and a child's microphone is not
 * enabled pending a data-processing agreement and counsel-approved consent
 * wording. `marketing.howItWorks.mentors.body` is therefore written about
 * CONVERSATION ("ask, repeat, slower") and never about the child speaking.
 * Do not "improve" it into a promise of a microphone.
 */

/* Portraits, not one line-up render. Four separate stills reflow to 2x2 on a
   phone and 4-across on a desktop; a single 2.5:1 banner would land each mentor
   at about 90px tall at 375px. Stills rather than video because the life comes
   from a CSS float, which costs no decoder at all. */
const MENTORS = [
  { key: "zara", art: "/marketing/mentor-zara.webp" },
  { key: "rho", art: "/marketing/mentor-rho.webp" },
  { key: "liruf", art: "/marketing/mentor-liruf.webp" },
  { key: "dina", art: "/marketing/mentor-dina.webp" },
] as const;

/* Decorative-only per lottie/README.md "Marketing / decorative preview use":
   streak/lesson/gold-coin only, always Activated + default colors, with a fixed
   illustrative value that is never a claim about a real visitor's stats. */
const KEEPS = [
  { name: "streak", value: 7, label: "streak" },
  { name: "lesson", value: 12, label: "lessons" },
  { name: "gold-coin", value: 40, label: "coins" },
] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  // Neither option carries a 'correct' state — DecisionExercise never marks
  // one, but the copy itself has to hold the same line: this is two DIFFERENT
  // consequences, not a right answer and a wrong one.
  const decisionOptions: DecisionOption[] = [
    {
      id: "candy",
      label: t("marketing.howItWorks.decisions.optionA"),
      consequence: t("marketing.howItWorks.decisions.consequenceA"),
    },
    {
      id: "bike",
      label: t("marketing.howItWorks.decisions.optionB"),
      consequence: t("marketing.howItWorks.decisions.consequenceB"),
    },
  ];

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-base text-content dark:bg-inverse dark:text-on-inverse">
        <div
          className="pointer-events-none absolute inset-0 bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-none">
          <Reveal className="lf-how-hero-copy pointer-events-none absolute z-10 max-w-xl px-5 md:px-0">
            <h1 className="lf-display-xl">{t("marketing.howItWorks.title")}</h1>
          </Reveal>
          <Reveal delay={80}>
            <TechnologyGraph showTitle={false} />
          </Reveal>
        </div>
      </section>

      {/* HOW. A decision with a consequence, shown rather than described. */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className="lf-display-lg">
                {t("marketing.howItWorks.decisions.heading")}
              </h2>
              <p className="lf-body-lg mt-4 max-w-xl text-content-muted">
                {t("marketing.howItWorks.decisions.body")}
              </p>
            </Reveal>

            <Reveal delay={80} className="lf-hiw-choice">
              {/* Zara asks it. She is the mentor who already hands the learner a
                  decision during onboarding, so the block is in her voice.

                  HER OWN ASSET, not the mentor grid's portrait. She is posed
                  turned toward the card with an open presenting hand, which is
                  wrong for a line-up of four mentors standing evenly - the two
                  images look similar and are not interchangeable. */}
              <img
                src="/marketing/zara-presents.webp"
                alt=""
                aria-hidden="true"
                width={800}
                height={800}
                loading="lazy"
                decoding="async"
                className="lf-hiw-choice__art"
              />
              <Card className="lf-hiw-choice__card">
                <p className="lf-body-lg font-semibold">
                  {t("marketing.howItWorks.decisions.question")}
                </p>
                {/* Real interaction, not a mockup: this is the product's own
                    `best_decision` answer control (/DecisionExercise.tsx),
                    fed this scenario's copy. Tapping an option swaps the
                    reveal below in place — trying the other one costs nothing
                    and needs no reset button. */}
                <DecisionExercise
                  optionsClassName="lf-hiw-choice__options"
                  ariaLabel={t("marketing.howItWorks.decisions.question")}
                  prompt={t("marketing.howItWorks.decisions.prompt")}
                  options={decisionOptions}
                />
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* WHO. */}
      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">
              {t("marketing.howItWorks.mentors.heading")}
            </h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.howItWorks.mentors.body")}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <ul className="lf-hiw-mentors mt-14">
              {MENTORS.map((mentor) => (
                <li key={mentor.key} className="lf-hiw-mentor">
                  <span className="lf-hiw-mentor__stage">
                    <img
                      src={mentor.art}
                      alt=""
                      aria-hidden="true"
                      width={800}
                      height={800}
                      loading="lazy"
                      decoding="async"
                      className="lf-hiw-mentor__art"
                    />
                  </span>
                  <span className="lf-hiw-mentor__name lf-body-lg">
                    {t(`tutor.character.${mentor.key}.name`)}
                  </span>
                  <span className="text-sm text-content-muted">
                    {t(`tutor.character.${mentor.key}.blurb`)}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* WHY AN ACCOUNT. */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">
              {t("marketing.howItWorks.account.heading")}
            </h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.howItWorks.account.body")}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <ul className="lf-hiw-keeps mt-12">
              {KEEPS.map((keep) => (
                <li key={keep.name} className="lf-hiw-keep">
                  <span className="lf-hiw-keep__art" aria-hidden="true">
                    <LottieIcon
                      name={keep.name}
                      value={keep.value}
                      activated
                      className="h-full w-full"
                    />
                  </span>
                  <span className="lf-body font-semibold">
                    {t(`marketing.howItWorks.account.${keep.label}`)}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <Reveal as="section" className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          {/* Photo LEFT, copy right - the mirror of the Landing's final CTA,
              which puts its photo on the right. Below `lg` the grid collapses
              and the photo stacks on top, so the CTA is never pushed under a
              full-width image on a phone. */}
          <Card
            hero
            // No `max-w-4xl`: the Landing's final CTA card is governed by
              // `max-w-container` alone, and capping this one at 56rem made it
              // 240px narrower on any desktop while matching below 768px, where
              // the container is the smaller constraint. The two closing cards
              // are the same component in the same role and must measure the
              // same. Columns are the MIRROR of the Landing's, because the
              // photo is on the other side.
              className="grid items-center gap-8 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]"
          >
            <img
              src="/marketing/pexels-kid-saving-7118210.jpg"
              alt={t("marketing.howItWorks.closing.imageAlt")}
              // `object-bottom`, not the default centre crop. The source is portrait
              // 2:3 and its whole subject - the hands, the coins, the labelled
              // savings jar - sits in the bottom third, so a centred 3:2 crop
              // keeps empty floor and the back of a head and discards the
              // reason the photo was chosen.
              className="aspect-[3/2] w-full rounded-lg object-cover object-bottom shadow-glass"
              loading="lazy"
              decoding="async"
            />
            <div className="text-center lg:text-left">
              <h2 className="lf-display-lg">
                {t("marketing.howItWorks.closing.title")}
              </h2>
              <p className="lf-body-lg mt-4 text-content-muted">
                {t("marketing.howItWorks.closing.body")}
              </p>
              <PrimaryCta
                dataCta="how-it-works-primary"
                wrapperClassName="mt-7 inline-block"
                buttonClassName="mt-7"
                guestLabel={t("marketing.howItWorks.cta")}
              />
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
