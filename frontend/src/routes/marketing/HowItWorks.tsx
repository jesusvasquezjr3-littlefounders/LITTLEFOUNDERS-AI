import { useTranslation } from "react-i18next";
import { Card, LottieIcon, Reveal } from "@/components/ui";
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
                  decision during onboarding, so the block is in her voice. */}
              <img
                src="/marketing/mentor-zara.webp"
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
                <div className="lf-hiw-choice__options">
                  <span className="lf-hiw-choice__option rounded-md border border-outline bg-base">
                    {t("marketing.howItWorks.decisions.optionA")}
                  </span>
                  <span className="lf-hiw-choice__option rounded-md border border-outline bg-base">
                    {t("marketing.howItWorks.decisions.optionB")}
                  </span>
                </div>
                {/* Neither option is marked correct, deliberately: the claim is
                    that the story changes, not that one answer wins. */}
                <p className="lf-body mt-4 text-content-muted">
                  {t("marketing.howItWorks.decisions.consequence")}
                </p>
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
          <Card hero className="mx-auto max-w-4xl text-center">
            <h2 className="lf-display-lg">
              {t("marketing.howItWorks.closing.title")}
            </h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.howItWorks.closing.body")}
            </p>
            <PrimaryCta
              dataCta="how-it-works-primary"
              wrapperClassName="mt-7 inline-block"
              buttonClassName="mt-7"
              guestLabel={t("marketing.howItWorks.cta")}
            />
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
