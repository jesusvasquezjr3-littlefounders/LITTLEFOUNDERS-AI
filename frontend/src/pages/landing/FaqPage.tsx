import React from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { ShowreelPlayer } from "@/components/showreel/ShowreelPlayer";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bot, Globe, ShieldCheck, Mail, Sparkles, ArrowRight } from "lucide-react";

const FAQ_ITEMS = [
  { id: "item-1", icon: Globe, qKey: "faq.q1", aKey: "faq.a1", trans: true },
  { id: "item-2", icon: Bot, qKey: "faq.q2", aKey: "faq.a2", trans: false },
  { id: "item-3", icon: Sparkles, qKey: "faq.q3", aKey: "faq.a3", trans: true },
  { id: "item-4", icon: ShieldCheck, qKey: "faq.q4", aKey: "faq.a4", trans: false },
];

export default function FaqPage() {
  const { t } = useTranslation("landing");
  const playerRef = React.useRef<any>(null);

  return (
    <LandingLayout hideCTA>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-white dark:bg-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        {/* Warm amber glow — on-brand, not generic indigo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-amber-400/8 dark:bg-amber-500/8 blur-[140px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-16 text-center">
          <Reveal as="span" className="corp-eyebrow">{t("nav.faq")}</Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
              {t("faq.title")}
            </h1>
          </Reveal>
        </div>
      </header>

      {/* ── VIDEO + ACCORDION ─────────────────────────────────────────────── */}
      <section className="relative py-16 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
            {/* Video */}
            <Reveal variant="left" className="w-full lg:w-7/12 lg:sticky lg:top-28">
              <div className="relative rounded-3xl border border-slate-200 dark:border-white/10 p-2 shadow-2xl bg-white dark:bg-white/5">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900">
                  <ShowreelPlayer playerRef={playerRef} />
                </div>
              </div>
            </Reveal>

            {/* Accordion */}
            <Reveal variant="right" className="w-full lg:w-5/12">
              <Accordion type="single" collapsible className="w-full space-y-3">
                {FAQ_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className="corp-card overflow-hidden !border-b"
                    >
                      <AccordionTrigger className="px-5 py-4 hover:no-underline text-left">
                        <div className="flex items-center gap-3 w-full pr-2">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/12 border border-amber-100 dark:border-amber-500/18 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm leading-snug">
                            {t(item.qKey)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="px-5 pb-5 pl-[4.25rem] text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.trans ? <Trans i18nKey={item.aKey} ns="landing" /> : t(item.aKey)}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CONTACT CTA ───────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="w-14 h-14 rounded-2xl bg-[#1a9e7a] shadow-[0_8px_24px_-6px_rgba(26,158,122,0.45)] flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-slate-900 dark:text-white">{t("faq.contact_title")}</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {t("faq.contact_subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:informame@littlefounders.ai"
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5"
              >
                <Mail className="w-5 h-5" />
                {t("faq.contact_button")}
              </a>
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-[#1a9e7a] hover:text-[#0d7a5f] dark:hover:text-[#34d399] transition-colors"
              >
                {t("corp.hero.cta_primary")}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
}
