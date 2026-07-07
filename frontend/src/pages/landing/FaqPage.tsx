import React from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { LiquidGlassMedia } from "@/components/landing/LiquidGlassMedia";
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
    <div className="py-5 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-[85rem] mx-auto">
      <section className={`rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-slate-200/50 dark:border-white/5 ${className}`}>
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

  return (
    <LandingLayout hideCTA>
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] mb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Reveal as="span" className="inline-flex items-center px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/8 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-8 shadow-sm">
              {t("nav.faq")}
            </Reveal>
            <Reveal delay={60}>
              <h1 className="corp-h1">
                {t("faq.title")}
              </h1>
            </Reveal>
          </div>

          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
            {/* Video — sticky on desktop */}
            <Reveal variant="left" className="w-full lg:w-1/2 lg:sticky lg:top-28">
              <div className="rounded-[2rem] overflow-hidden shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)]">
                <div className="relative w-full aspect-[4/3]">
                  <LiquidGlassMedia
                    type="video"
                    src="/video/8747232-sd_960_540_25fps.mp4"
                  />
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
                      className="border-b border-slate-200/50 dark:border-white/8"
                    >
                      <AccordionTrigger className="py-6 hover:no-underline text-left rounded-xl px-2 -mx-2 transition-[background-color] duration-150 ease-out hover:bg-slate-100/50 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                        <div className="flex items-center gap-4 w-full pr-4">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 shadow-sm border border-slate-200/50 dark:border-white/8 flex items-center justify-center shrink-0 transition-[box-shadow,background-color] duration-150 ease-out group-hover:shadow-md">
                            <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="corp-h4 tracking-tight">
                            {t(item.qKey)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="pb-6 pl-[3.75rem] corp-body pr-8">
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
      <section className="bg-slate-900 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-7 border border-white/10">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h2 className="corp-h2 mb-5 !text-white">
              {t("faq.contact_title")}
            </h2>
            <p className="corp-body max-w-xl mx-auto mb-10">
              {t("faq.contact_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="mailto:informame@littlefounders.ai"
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-full px-10 py-4"
              >
                <Mail className="w-5 h-5" />
                {t("faq.contact_button")}
              </a>
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/15 text-base font-semibold rounded-full px-10 py-4 transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
