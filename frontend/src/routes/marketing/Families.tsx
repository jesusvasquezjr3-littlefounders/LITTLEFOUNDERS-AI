import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { Badge, Button, Card, Icon, Reveal } from "@/components/ui";
import { DecisionExercise, type DecisionOption } from "./DecisionExercise";
import { FamilyPanelPreview } from "./FamilyPanelPreview";
import { TutorVisibilityDemo } from "./TutorVisibilityDemo";

/*
 * /families — the third question in the marketing site's order, after
 * Landing ("what is this?") and /how-it-works ("how does it learn?"): "what
 * do I, the adult putting my name on this, actually control?"
 *
 * Every block below is named after a component or endpoint that already
 * exists (FamilyPage.tsx, AddKidCard.tsx, VerifyParentPage.tsx, tasks.ts,
 * banking.ts, migration 0068) — nothing here is a feature invented for the
 * page. Two blocks are reused product primitives fed marketing state
 * (FamilyPanelPreview, TutorVisibilityDemo, DecisionExercise) rather than
 * screenshots, because a visitor who clicks a working preview trusts it more
 * than a picture of one — and because a picture goes stale the next time the
 * real screen changes and this one cannot.
 *
 * ORDER IS THE ARGUMENT. Supervision of the Tutor comes before money: the
 * anxiety a parent actually carries about "AI talking to my kid" is answered
 * before the anxiety about "toy money," because the first is the harder sell
 * and this product's realest answer to it.
 */

function FamiliesHeroCta() {
  const { t } = useTranslation();
  const { session, roles } = useAuth();
  const isParent = roles.includes("parent");

  if (session && isParent) {
    return (
      <Link to="/family" data-cta="families-hero">
        <Button className="group">
          {t("marketing.families.hero.ctaGoFamily")}
          <Icon name="arrow_forward" aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
        </Button>
      </Link>
    );
  }

  if (session && !isParent) {
    return (
      <Link to="/verify-parent" data-cta="families-hero">
        <Button className="group">
          {t("dashboard.upgrade.cta")}
          <Icon name="arrow_forward" aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
      <Link to="/signup?intent=tutor" data-cta="families-hero">
        <Button className="group">
          {t("marketing.families.hero.ctaCreate")}
          <Icon name="arrow_forward" aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
        </Button>
      </Link>
      <Link
        to="/login"
        className="lf-label lf-press inline-flex min-h-11 items-center rounded-sm px-2 text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("marketing.hero.ctaSecondary")}
      </Link>
    </div>
  );
}

export function Families() {
  const { t } = useTranslation();

  const taskOptions: DecisionOption[] = [
    {
      id: "save",
      label: t("marketing.families.tasks.optionSave"),
      consequence: t("marketing.families.tasks.consequenceSave"),
    },
    {
      id: "spend",
      label: t("marketing.families.tasks.optionSpend"),
      consequence: t("marketing.families.tasks.consequenceSpend"),
    },
    {
      id: "share",
      label: t("marketing.families.tasks.optionShare"),
      consequence: t("marketing.families.tasks.consequenceShare"),
    },
  ];

  return (
    <div>
      {/* HERO — the adult, named directly, with the product's own family
          panel (not a photo) as the thing to look at while reading. */}
      <section className="bg-base py-16 sm:py-20">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className="text-center lg:text-left">
              <h1 className="lf-display-xl">{t("marketing.families.hero.title")}</h1>
              <p className="lf-body-lg mx-auto mt-4 max-w-xl text-content-muted lg:mx-0">
                {t("marketing.families.hero.subtitle")}
              </p>
              <div className="mt-7">
                <FamiliesHeroCta />
              </div>
            </Reveal>
            <Reveal delay={80}>
              <FamilyPanelPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* AI TUTOR VISIBILITY — ahead of money, deliberately: the harder sell
          for a parent is "AI talking to my kid," not "toy currency." */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal className="text-center lg:text-left">
              <h2 className="lf-display-lg">{t("marketing.families.tutor.heading")}</h2>
              <p className="lf-body-lg mx-auto mt-4 max-w-xl text-content-muted lg:mx-0">
                {t("marketing.families.tutor.body")}
              </p>
            </Reveal>
            <Reveal delay={80}>
              <TutorVisibilityDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* TASKS & REWARDS — the same interactive answer control as
          /how-it-works' decision block, fed the real earn -> allocate cycle
          (tasks.ts: Save / Spend / Share). */}
      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">{t("marketing.families.tasks.heading")}</h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.families.tasks.body")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Card hero className="mx-auto mt-10 max-w-xl p-6 sm:p-8">
              <DecisionExercise
                scenario={t("marketing.families.tasks.scenario")}
                ariaLabel={t("marketing.families.tasks.scenario")}
                prompt={t("marketing.families.tasks.prompt")}
                options={taskOptions}
              />
            </Card>
          </Reveal>
        </div>
      </section>

      {/* BANKING — the permanent "educational simulation" tag, not a
          one-time disclaimer, next to the heading itself (banking.ts forbids
          "bank account" / "interest" / "APY" / "insured" outright). */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Badge className="bg-accent-soft text-accent">{t("marketing.families.banking.tag")}</Badge>
            <h2 className="lf-display-lg mt-4">{t("marketing.families.banking.heading")}</h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.families.banking.body")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* TERRITORY — same renderer the kid sees, never a parent-only redraw
          that can drift from it (KidTerritoryPage.tsx reuses TerritoryView). */}
      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">{t("marketing.families.territory.heading")}</h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.families.territory.body")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* PRIVACY — the §1.9 ceiling, said plainly. */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">{t("marketing.families.privacy.heading")}</h2>
            <p className="lf-body-lg mx-auto mt-4 max-w-2xl text-content-muted">
              {t("marketing.families.privacy.body")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* THE STEPS — the explanation this page was asked to carry: how a
          Tutor account is created and linked, in the order SignupPage.tsx /
          VerifyParentPage.tsx / AddKidCard.tsx actually require it. */}
      <section className="bg-base py-20 sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="lf-display-lg">{t("marketing.families.steps.heading")}</h2>
          </Reveal>
          <Reveal delay={80} className="mx-auto mt-12 max-w-2xl">
            <ol className="flex flex-col gap-3">
              {(["step1", "step2", "step3", "step4"] as const).map((step, index) => (
                <li key={step} className="lf-config-row flex items-start gap-3 p-3.5">
                  <span className="lf-tile lf-label h-8 w-8 shrink-0 !rounded-full text-accent" aria-hidden>
                    {index + 1}
                  </span>
                  <div>
                    <p className="lf-label text-content">{t(`marketing.families.steps.${step}Title`)}</p>
                    <p className="lf-caption mt-0.5 text-content-muted">{t(`marketing.families.steps.${step}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* CLOSING — text only, deliberately (see file header for why no photo
          joins this block): the same centred claim-and-expansion treatment
          Landing's `marketing.family` section already uses. */}
      <Reveal as="section" className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto flex max-w-container flex-col items-center px-5 text-center md:px-8">
          <h2 className="lf-display-lg max-w-2xl">{t("marketing.families.closing.title")}</h2>
          <p className="lf-body-lg mt-4 max-w-xl text-content-muted">
            {t("marketing.families.closing.body")}
          </p>
          <div className="mt-7">
            <FamiliesHeroCta />
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default Families;
