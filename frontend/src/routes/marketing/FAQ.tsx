import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Accordion, Button, Reveal, type AccordionItem } from "@/components/ui";
import { cn } from "@/lib/utils";

/*
 * /faq — the fourth marketing page, and a different kind of question from
 * the first three. Landing sells the promise, /how-it-works explains the
 * mechanism, /families speaks to the Tutor's authority. /faq answers
 * FRICTION: the specific objection someone with a thumb over the signup
 * button searches for, not the narrative that brought them here. So the
 * page is built as a scannable reference, not a persuasion arc — no hero
 * composition, no mentor huddle. Clarity IS the pitch here.
 *
 * Every answer below is grounded in a real file, constant or migration
 * (see the `data-src` comment beside each) rather than invented — the same
 * discipline /families' content followed. Two answers (`tutorCanBeWrong`,
 * `coppa`) sit close to legal/product-honesty lines on purpose: the
 * alternative was a confident-sounding lie, and this product's own Terms
 * (c.8: "AI may produce incomplete, inaccurate or outdated results") and
 * Privacy Notice (preamble: built around COPPA/LGPD standards) already say
 * this — the FAQ just says it in plain language instead of inventing a
 * softer claim.
 *
 * Categories over search: 29 questions is short enough that a search box
 * would be solving a problem the page doesn't have yet. A single-open
 * Accordion (components/ui/Accordion.tsx) keeps a long list scannable
 * without every answer stacked open.
 */

const CATEGORIES = ["start", "family", "tutor", "money", "privacy", "support"] as const;
type Category = (typeof CATEGORIES)[number];

const ITEMS: { id: string; category: Category }[] = [
  // start — data-src: marketing.finalCta.body, PrimaryCta.tsx, MIN_SIGNUP_AGE_YEARS=13, admin age bands
  { id: "whatIs", category: "start" },
  { id: "isFree", category: "start" },
  { id: "tryWithoutAccount", category: "start" },
  { id: "languages", category: "start" },
  { id: "ages", category: "start" },
  // family — data-src: AddKidCard.tsx, guardian_links, MAX_KIDS_PER_PARENT=10
  { id: "whatIsTutor", category: "family" },
  { id: "addChild", category: "family" },
  { id: "twoParents", category: "family" },
  { id: "howMany", category: "family" },
  { id: "ownDevice", category: "family" },
  // tutor — data-src: FamilyPage.tsx, migration 0068, VoiceConsentControl
  { id: "talksToAI", category: "tutor" },
  { id: "privateFromYou", category: "tutor" },
  { id: "remember", category: "tutor" },
  { id: "mentors", category: "tutor" },
  { id: "canBeWrong", category: "tutor" },
  // money — data-src: banking.ts language rule, tasks.ts earn/allocate, the
  // independence levels (docs/operations/FAMILY-INDEPENDENCE-AND-DECISIONS.md)
  // and, for notTaught, the D.20 scope statement (block-d-scope.json, whose
  // gate keeps this answer naming every exclusion in three locales)
  { id: "realBank", category: "money" },
  { id: "lfCoins", category: "money" },
  { id: "chores", category: "money" },
  { id: "realMoney", category: "money" },
  { id: "notTaught", category: "money" },
  // privacy — data-src: Privacy Notice §2, tutor-retention.yml, analyticsConsent toggle;
  // familyRecords: the D.21 policy (block-d-retention.json, whose gate keeps
  // the periods in this answer equal to the ones the nightly job enforces)
  { id: "dataCollected", category: "privacy" },
  { id: "moderation", category: "privacy" },
  { id: "retention", category: "privacy" },
  // E.10/E.11 — data-src: docs/rebuild/policies/SOCIAL-GOVERNANCE.md §2.1 and §3.2
  { id: "noMessaging", category: "privacy" },
  { id: "socialRetention", category: "privacy" },
  { id: "familyRecords", category: "privacy" },
  { id: "analyticsToggle", category: "privacy" },
  { id: "coppa", category: "privacy" },
  // support — data-src: Terms c.13, Privacy Notice
  { id: "contact", category: "support" },
  { id: "deleteAccount", category: "support" },
  { id: "cancelTutor", category: "support" },
];

const SUPPORT_EMAIL = "informame@littlefounders.ai";

export function FAQ() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Category | "all">("all");

  const visible = useMemo(
    () => (active === "all" ? ITEMS : ITEMS.filter((item) => item.category === active)),
    [active],
  );

  const accordionItems: AccordionItem[] = visible.map((item) => ({
    id: item.id,
    question: t(`marketing.faq.items.${item.id}.question`),
    answer: t(`marketing.faq.items.${item.id}.answer`),
  }));

  return (
    <div>
      <section className="bg-base py-16 sm:py-20">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h1 className="lf-display-xl">{t("marketing.faq.hero.title")}</h1>
            <p className="lf-body-lg mx-auto mt-4 max-w-xl text-content-muted">
              {t("marketing.faq.hero.subtitle")}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-base pb-24 sm:pb-28">
        <div className="mx-auto max-w-container px-5 md:px-8">
          <div className="mx-auto max-w-3xl">
            {/* Category filter — a plain, static row: 6 chips plus "All"
                never wraps ambiguously and needs no icon to read as a
                filter once one is pressed (aria-pressed + the primary
                fill say so). */}
            <Reveal
              className="flex flex-wrap justify-center gap-2"
              // The list itself doesn't need a label read aloud item by
              // item; each button's own pressed state carries the meaning.
            >
              <button
                type="button"
                aria-pressed={active === "all"}
                onClick={() => setActive("all")}
                className={cn(
                  "lf-press lf-label min-h-10 rounded-full border px-4 py-2 transition-colors duration-150",
                  active === "all"
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline bg-surface text-content-muted hover:text-primary",
                )}
              >
                {t("marketing.faq.filterAll")}
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active === cat}
                  onClick={() => setActive(cat)}
                  className={cn(
                    "lf-press lf-label min-h-10 rounded-full border px-4 py-2 transition-colors duration-150",
                    active === cat
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline bg-surface text-content-muted hover:text-primary",
                  )}
                >
                  {t(`marketing.faq.categories.${cat}`)}
                </button>
              ))}
            </Reveal>

            <Reveal delay={80} className="mt-8">
              <Accordion items={accordionItems} />
            </Reveal>
          </div>
        </div>
      </section>

      <Reveal as="section" className="bg-band py-20 text-content sm:py-28">
        <div className="mx-auto flex max-w-container flex-col items-center px-5 text-center md:px-8">
          <h2 className="lf-display-lg max-w-xl">{t("marketing.faq.closing.title")}</h2>
          <p className="lf-body-lg mt-4 max-w-md text-content-muted">
            {t("marketing.faq.closing.body")}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Button variant="secondary">{t("marketing.faq.closing.emailCta")}</Button>
            </a>
            <Link to="/signup?intent=tutor" data-cta="faq-closing">
              <Button>{t("marketing.faq.closing.signupCta")}</Button>
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default FAQ;
