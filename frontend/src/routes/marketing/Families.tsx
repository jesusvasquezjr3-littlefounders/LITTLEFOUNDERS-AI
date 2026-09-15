import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { Badge, Button, Card, Icon, Reveal } from "@/components/ui";
import { DecisionExercise, type DecisionOption } from "./DecisionExercise";
import { FamilyPanelPreview } from "./FamilyPanelPreview";
import { MentorStrip } from "./MentorStrip";
import { TutorVisibilityDemo } from "./TutorVisibilityDemo";
import "./Families.css";

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
 *
 * THE MENTORS ARE NOT DECORATION HERE EITHER, and getting this wrong twice
 * is worth recording so it does not happen a third time. Draft 1 shipped five
 * walls of centred text with no face on screen at all. Draft 2 bolted a
 * mentor bust onto a card's absolute-positioned corner, which is exactly
 * where the card's own header sits, so it covered the "Illustrative preview"
 * badge. Draft 3 fixed the collision but by copy-pasting HowItWorks' block-2
 * "one mentor beside a card" recipe twice — including reusing
 * `zara-presents.webp`, the EXACT file HowItWorks already spends on that
 * exact role. Two mentors in the same template is still one template.
 *
 * This is draft 4: each scene composes more than one mentor at different
 * scale, depth and (for the flanking pair) mirroring
 * (`.lf-fam-huddle*` / `.lf-fam-flank*` in Families.css), and no file is
 * reused in a compositional role another page already gave it — the hero is
 * Dina front and centre with Rho peeking in from behind her shoulder
 * (dimmed, lower z-index, mostly behind her — a friend leaning into frame,
 * not a copy of the mentor grid's flat row), and the tasks card is flanked by
 * two mirrored renders standing in the gutter either side of it, never on
 * top of it. Every figure lives in its own region: nothing overlaps a card's
 * text at any viewport.
 *   - Dina fronts the hero huddle because she is the one mentor with no
 *     existing claim on an auth-flow page (Zara: HowItWorks' decision block;
 *     Liruf: SignupPage.tsx's `MENTOR`; Rho: VerifyParentPage.tsx's
 *     `MENTOR`) — she is free to be this page's own face.
 *   - Zara and Dina flank the tasks card, mirrored and standing rather than
 *     presenting, because Zara is already HowItWorks' decision mentor and
 *     this is a decision too — without repeating her exact presenting pose.
 *   - Liruf and Rho get a face on steps 1 and 2 because those are the
 *     literal mentors SignupPage.tsx and VerifyParentPage.tsx already show at
 *     that exact step — foreshadowing who the visitor is about to meet, not
 *     a random assignment.
 *   - MentorStrip (all four) opens the AI-visibility block, because "who is
 *     my child talking to" is precisely what that block answers, and closes
 *     the page as the full cast the Tutor signs up to trust.
 * Names are read from `tutor.character.*`, same reason HowItWorks reads them
 * rather than re-authoring blurbs that would drift the next time a
 * personality is retuned.
 */

/* Liruf fronts SignupPage.tsx (its `MENTOR` constant), Rho fronts
   VerifyParentPage.tsx (same) — steps 1 and 2 show that exact mentor. Steps 3
   and 4 (AddKidCard.tsx, guardian_links) have no dedicated mentor, so they
   keep the plain numbered tile. */
const STEPS = [
  { key: "step1", face: "/marketing/mentor-liruf-bust.webp" },
  { key: "step2", face: "/marketing/mentor-rho-bust.webp" },
  { key: "step3", face: null },
  { key: "step4", face: null },
] as const;

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
    <div className="flex flex-wrap items-center justify-center gap-4">
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
      {/* HERO — the adult, named directly, then Dina and the product's own
          family panel as the scene to look at (see the file header for why
          she fronts this one). */}
      <section className="relative isolate overflow-hidden bg-base py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h1 className="lf-display-xl">{t("marketing.families.hero.title")}</h1>
            <p className="lf-body-lg mx-auto mt-4 max-w-xl text-content-muted">
              {t("marketing.families.hero.subtitle")}
            </p>
            <div className="mt-7 flex justify-center">
              <FamiliesHeroCta />
            </div>
          </Reveal>

          <Reveal delay={80} className="lf-fam-huddle mt-14">
            {/* Dina front and centre, Rho peeking in from behind her left
                shoulder — see the file header for why she fronts this one. */}
            <div className="lf-fam-huddle__scene">
              <img
                src="/marketing/mentor-rho.webp"
                alt=""
                aria-hidden="true"
                width={600}
                height={600}
                loading="lazy"
                decoding="async"
                className="lf-fam-huddle__figure lf-fam-huddle__figure--rho"
              />
              <img
                src="/marketing/mentor-dina.webp"
                alt=""
                aria-hidden="true"
                width={800}
                height={800}
                loading="lazy"
                decoding="async"
                className="lf-fam-huddle__figure lf-fam-huddle__figure--dina"
              />
            </div>
            <div className="lf-fam-huddle__card">
              <FamilyPanelPreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* AI TUTOR VISIBILITY — ahead of money, deliberately: the harder sell
          for a parent is "AI talking to my kid," not "toy currency." */}
      <section className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal>
            <MentorStrip className="mb-10" />
          </Reveal>
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
          <Reveal delay={80} className="lf-fam-flank mt-10">
            {/* Zara and Dina again, mirrored and STANDING rather than
                presenting — flanking the card from the gutter, never on top
                of it, and never HowItWorks' own `zara-presents.webp` pose.
                Desktop-only (see Families.css): a phone has no gutter for a
                crowd to stand in, so it just gets the clean card. */}
            <img
              src="/marketing/mentor-zara.webp"
              alt=""
              aria-hidden="true"
              width={600}
              height={600}
              loading="lazy"
              decoding="async"
              className="lf-fam-flank__figure lf-fam-flank__figure--left"
            />
            <img
              src="/marketing/mentor-dina.webp"
              alt=""
              aria-hidden="true"
              width={600}
              height={600}
              loading="lazy"
              decoding="async"
              className="lf-fam-flank__figure lf-fam-flank__figure--right"
            />
            <Card hero className="lf-fam-flank__card p-6 sm:p-8">
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
              {STEPS.map(({ key, face }, index) => (
                <li key={key} className="lf-config-row flex items-start gap-3 p-3.5">
                  {/* The mentor the visitor is actually about to meet on that
                      real screen (see the file header), not a generic
                      number, wherever one applies. */}
                  {face ? (
                    <img src={face} alt="" aria-hidden="true" width={90} height={90} loading="lazy" decoding="async" className="lf-fam-step-face" />
                  ) : (
                    <span className="lf-tile lf-label h-9 w-9 shrink-0 !rounded-full text-accent" aria-hidden>
                      {index + 1}
                    </span>
                  )}
                  <div>
                    <p className="lf-label text-content">{t(`marketing.families.steps.${key}Title`)}</p>
                    <p className="lf-caption mt-0.5 text-content-muted">{t(`marketing.families.steps.${key}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* CLOSING — the full cast, together, closing the loop the hero opened
          with Dina alone: the whole team a Tutor is actually signing up to
          trust. Otherwise the same centred claim-and-expansion treatment
          Landing's `marketing.family` section already uses. */}
      <Reveal as="section" className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto flex max-w-container flex-col items-center px-5 text-center md:px-8">
          <MentorStrip className="mb-10" />
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
