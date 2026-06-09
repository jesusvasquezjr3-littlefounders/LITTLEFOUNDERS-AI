import React from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { ShowreelPlayer } from '@/components/showreel/ShowreelPlayer';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bot, Sparkles, Globe, ShieldCheck, Mail, ArrowRight, ChevronDown } from "lucide-react";

/* ── FAQ item config ──────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  { id: 'item-1', icon: Globe, color: 'from-pink-500 to-rose-500', accent: 'text-pink-300', border: 'border-pink-500/20', bg: 'bg-pink-500/8', qKey: 'faq.q1', aKey: 'faq.a1', trans: true },
  { id: 'item-2', icon: Bot, color: 'from-blue-500 to-cyan-500', accent: 'text-blue-300', border: 'border-blue-500/20', bg: 'bg-blue-500/8', qKey: 'faq.q2', aKey: 'faq.a2', trans: false },
  { id: 'item-3', icon: Sparkles, color: 'from-violet-500 to-purple-500', accent: 'text-violet-300', border: 'border-violet-500/20', bg: 'bg-violet-500/8', qKey: 'faq.q3', aKey: 'faq.a3', trans: true },
  { id: 'item-4', icon: ShieldCheck, color: 'from-emerald-500 to-teal-500', accent: 'text-emerald-300', border: 'border-emerald-500/20', bg: 'bg-emerald-500/8', qKey: 'faq.q4', aKey: 'faq.a4', trans: false },
];

export default function FaqPage() {
  const { t } = useTranslation('landing');
  const playerRef = React.useRef<any>(null);

  return (
    <LandingLayout hideCTA={true}>
      <div className="min-h-screen">

        {/* ══════════════════════════════════════════════════════
          HERO BAND
      ══════════════════════════════════════════════════════ */}
        <section className="relative pt-24 pb-10 px-4 overflow-hidden text-gray-900 dark:text-white hero-sunburst dark:bg-[#16112a]">

          {/* Ambient glow orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 right-[5%] w-[400px] h-[400px] bg-fuchsia-300/25 dark:bg-fuchsia-700/18 rounded-full blur-[90px] animate-orb-1" />
            <div className="absolute -bottom-20 left-[8%] w-[350px] h-[350px] bg-rose-300/25 dark:bg-rose-700/18 rounded-full blur-[90px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">

            <h1 className="landing-heading text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 animate-fade-in-up-delay-1">
              {t('faq.title')}
            </h1>
            {/* Squiggle accent */}
            <div className="flex justify-center mb-6">
              <svg viewBox="0 0 260 14" fill="none" className="w-52" preserveAspectRatio="none">
                <path d="M2 9 C60 2, 130 13, 200 6 C225 3, 248 10, 258 7" stroke="url(#faq-sq)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <defs>
                  <linearGradient id="faq-sq" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" /><stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 56 }}>
            <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,28 C360,56 720,8 1080,40 C1260,52 1380,18 1440,28 L1440,56 L0,56 Z" fill="#eff6ff" className="dark:hidden" />
              <path d="M0,28 C360,56 720,8 1080,40 C1260,52 1380,18 1440,28 L1440,56 L0,56 Z" className="hidden dark:block" style={{ fill: '#0f172a' }} />
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
          MAIN CONTENT — video + accordion
      ══════════════════════════════════════════════════════ */}
        <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50/30 via-purple-50/30 to-pink-50/30 dark:from-slate-900 dark:to-slate-950 overflow-hidden">

          {/* Ambient glow orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-fuchsia-300/15 dark:bg-fuchsia-900/12 rounded-full blur-[80px] animate-orb-1" />
            <div className="absolute bottom-0 left-[5%] w-[350px] h-[350px] bg-rose-300/15 dark:bg-rose-900/10 rounded-full blur-[80px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          {/* Wave top */}
          <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 56 }}>
            <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,28 C360,0 720,48 1080,16 C1260,4 1380,38 1440,28 L1440,0 L0,0 Z" fill="#eff6ff" className="dark:hidden" />
              <path d="M0,28 C360,0 720,48 1080,16 C1260,4 1380,38 1440,28 L1440,0 L0,0 Z" className="hidden dark:block" style={{ fill: '#0f172a' }} />
            </svg>
          </div>

          <div className="max-w-7xl mx-auto pt-8">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">

              {/* LEFT — video player */}
              <div className="w-full lg:w-7/12 xl:w-2/3 lg:sticky lg:top-28">
                <div className="relative group">
                  {/* Glow behind player */}
                  <div className="absolute -inset-3 rounded-3xl blur-2xl opacity-30 bg-gradient-to-br from-violet-500 via-pink-500 to-blue-500 pointer-events-none" />
                  {/* Player card */}
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl bg-gray-100 dark:bg-slate-900">
                    <div className="absolute inset-0 z-10 rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 pointer-events-none" />
                    <ShowreelPlayer playerRef={playerRef} />
                  </div>

                </div>
              </div>

              {/* RIGHT — accordion */}
              <div className="w-full lg:w-5/12 xl:w-1/3">
                <Accordion type="single" collapsible className="w-full space-y-3">
                  {FAQ_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <AccordionItem key={item.id} value={item.id}
                        className="rounded-2xl glass-card shadow-sm overflow-hidden group !border-b-0">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline text-left">
                          <div className="flex items-center gap-3 w-full pr-2">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
                              {t(item.qKey)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className={`mx-5 mb-4 mt-1 p-4 rounded-xl ${item.bg} border ${item.border}`}>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                              {item.trans
                                ? <Trans i18nKey={item.aKey} ns="landing" />
                                : t(item.aKey)
                              }
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                   })}
                </Accordion>
              </div>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 56 }}>
            <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,20 C480,56 960,5 1440,35 L1440,56 L0,56 Z" fill="currentColor" className="text-violet-50 dark:text-[#0f0720]" />
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
          CONTACT CTA
      ══════════════════════════════════════════════════════ */}
        <section className="relative py-24 overflow-hidden text-gray-900 dark:text-white bg-gradient-to-br from-violet-50 to-pink-50 dark:from-[#0f0720] dark:to-[#0a1530]">

          {/* Ambient glow orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-300/25 dark:bg-fuchsia-700/18 rounded-full blur-[100px] animate-orb-1" />
            <div className="absolute top-10 right-[8%] w-[400px] h-[400px] bg-rose-300/20 dark:bg-rose-700/15 rounded-full blur-[80px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          {/* Wave top */}
          <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 56 }}>
            <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,28 C480,5 960,52 1440,20 L1440,0 L0,0 Z" fill="currentColor" className="text-pink-50/50 dark:text-[#0f172a]" />
            </svg>
          </div>

          <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
            {/* Morphing Liquid Glass icon background */}
            <div 
              className="w-16 h-16 relative flex-shrink-0 morphing-blob-frame bg-gradient-to-tr from-[#ff6b6b]/60 via-white/20 to-[#7048e8]/60 dark:from-[#ff6b6b]/45 dark:via-white/5 dark:to-[#7048e8]/45 p-[3px] backdrop-blur-md shadow-xl border border-white/40 dark:border-white/15 overflow-hidden mx-auto mb-6 z-10 animate-fade-in-up"
            >
              <div 
                className="w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-pink-500 to-violet-600 relative" 
                style={{ borderRadius: 'inherit' }}
              >
                <Mail className="w-8 h-8 text-white relative z-10" />
                {/* Glossy liquid glass reflections */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/35 to-transparent pointer-events-none mix-blend-overlay" />
                <div className="absolute -inset-full bg-gradient-to-b from-white/15 via-transparent to-transparent rotate-45 pointer-events-none" />
              </div>
            </div>

            <h2 className="landing-heading text-3xl md:text-4xl font-black mb-4 animate-fade-in-up-delay-1">
              {t('faq.contact_title')}
            </h2>
            <p className="landing-body-text text-base text-gray-600 dark:text-white/55 mb-8 leading-relaxed font-medium animate-fade-in-up-delay-2">
              {t('faq.contact_subtitle')}
            </p>

            <Button asChild size="lg"
              className="btn-press h-14 px-10 text-lg rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-black border-0 shadow-none w-72 justify-center mx-auto"
            >
              <a href="mailto:informame@littlefounders.ai" className="flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" />
                {t('faq.contact_button')}
              </a>
            </Button>
          </div>
        </section>

      </div>
    </LandingLayout>
  );
}
