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

// El wrapper "Isla" que define el estilo Brilliant.org
function Island({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-[85rem] mx-auto">
      <section className={`rounded-[2.5rem] md:rounded-[3rem] overflow-hidden ${className}`}>
        {children}
      </section>
    </div>
  );
}

const FAQ_ITEMS = [
  { id: "item-1", icon: Globe, qKey: "faq.q1", aKey: "faq.a1", trans: true },
  { id: "item-2", icon: Bot, qKey: "faq.q2", aKey: "faq.a2", trans: false },
  { id: "item-3", icon: Sparkles, qKey: "faq.q3", aKey: "faq.a3", trans: true },
  { id: "item-4", icon: ShieldCheck, qKey: "faq.q4", aKey: "faq.a4", trans: false },
];

export default function FaqPage() {
  const { t } = useTranslation("landing");
  const playerRef = React.useRef<{ play: () => void; pause: () => void } | null>(null);

  return (
    <LandingLayout hideCTA>
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] mb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Reveal as="span" className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-8 shadow-sm">
              {t("nav.faq")}
            </Reveal>
            <Reveal delay={60}>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                {t("faq.title")}
              </h1>
            </Reveal>
          </div>

          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
            {/* Video — sticky on desktop */}
            <Reveal variant="left" className="w-full lg:w-1/2 lg:sticky lg:top-28">
              <div className="rounded-[2.5rem] overflow-hidden bg-slate-900 shadow-xl border-4 border-white dark:border-[#0d1426]">
                <div className="relative w-full aspect-[4/3]">
                  <ShowreelPlayer playerRef={playerRef} />
                </div>
              </div>
            </Reveal>

            {/* FAQ Accordion */}
            <Reveal variant="right" className="w-full lg:w-1/2">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className="border-b border-slate-200 dark:border-white/10"
                    >
                      <AccordionTrigger className="py-8 hover:no-underline text-left">
                        <div className="flex items-center gap-5 w-full pr-4">
                          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-xl leading-snug tracking-tight">
                            {t(item.qKey)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="pb-8 pl-[4.25rem] text-lg text-slate-600 dark:text-slate-400 leading-relaxed pr-8">
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
      </Island>

      {/* ── CONTACT CTA ───────────────────────────────────────────────── */}
      <section className="bg-slate-900 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-8">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-xl font-bold text-white tracking-tight leading-tight mb-8">
              {t("faq.contact_title")}
            </h2>
            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-12">
              {t("faq.contact_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="mailto:informame@littlefounders.ai"
                className="inline-flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-lg font-semibold rounded-full px-10 py-5 transition-colors duration-200"
              >
                <Mail className="w-6 h-6" />
                {t("faq.contact_button")}
              </a>
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-lg font-semibold rounded-full px-10 py-5 transition-colors duration-200"
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
