import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmailWaitlistForm } from "@/components/landing/EmailWaitlistForm";

interface LandingFooterProps {
  hideCTA?: boolean;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ hideCTA = false }) => {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language;

  const [ctaWordIndex, setCtaWordIndex] = React.useState(0);
  const ctaWords = (t("cta.rotating_words", { returnObjects: true }) as string[]) || ["founder"];

  React.useEffect(() => {
    if (hideCTA) return;
    const interval = setInterval(() => setCtaWordIndex(p => (p + 1) % ctaWords.length), 4000);
    return () => clearInterval(interval);
  }, [ctaWords.length, hideCTA]);

  return (
    <>
      {/* ── Pre-footer CTA ──────────────────────────────────────────────────── */}
      {!hideCTA && (
        <section className="relative py-28 overflow-hidden text-gray-900 dark:text-white bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-[#0f0720] dark:to-[#0a1530]">

          {/* Radial glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)' }} />
          </div>

          {/* Dot-grid */}
          <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          {/* Wave top */}
          <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,20 C360,60 720,8 1080,42 C1260,58 1380,18 1440,32 L1440,0 L0,0 Z"
                fill="currentColor" className="text-pink-50 dark:text-[#060d20]" />
            </svg>
          </div>

          <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
            <h2 className="landing-heading text-4xl md:text-5xl font-black mb-8 leading-tight">
              {t("cta.title_part1")}
              <br />
              <span className="relative inline-block min-w-[4ch]">
                <span key={ctaWordIndex} className="relative z-10 animate-fade-in-up inline-block text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #ec4899, #a855f7)' }}>
                  {ctaWords[ctaWordIndex]}.
                </span>
                {/* Underline squiggle */}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 8 C40 2, 80 12, 120 6 C160 0, 185 10, 198 6" stroke="url(#squiggle-grad-cta)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                  <defs>
                    <linearGradient id="squiggle-grad-cta" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f97316"/>
                      <stop offset="50%" stopColor="#ec4899"/>
                      <stop offset="100%" stopColor="#a855f7"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h2>

            <p className="text-lg text-gray-600 dark:text-white/55 mb-10 max-w-xl mx-auto leading-relaxed">
              {t("families.hero.notify_desc")}
            </p>

            <div className="flex justify-center">
              <EmailWaitlistForm
                ctaLabel={t("families.hero.notify_cta")}
                placeholder={t("families.hero.email_placeholder")}
                successMsg={t("families.hero.email_success")}
                language={lang}
                source="landing_footer"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-slate-50 dark:bg-[#04020f]">

        {/* Rainbow gradient strip at top */}
        <div className="w-full h-px"
          style={{ background: 'linear-gradient(90deg, #f97316, #ec4899, #a855f7, #3b82f6, #10b981, #f97316)' }} />

        {/* Subtle dot texture */}
        <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 sm:py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">

            {/* Logo */}
            <Link to="/" className="opacity-80 hover:opacity-100 transition-opacity">
              <img src="/logo-sized.png" alt="LittleFounders Logo - Educación Financiera para Niños"
                className="h-9 w-auto object-contain brightness-0 dark:invert" loading="lazy" />
            </Link>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-white/35">
              <Link to="#" className="hover:text-gray-900 dark:hover:text-white/70 transition-colors">{t("footer.terms")}</Link>
              <Link to="#" className="hover:text-gray-900 dark:hover:text-white/70 transition-colors">{t("footer.privacy")}</Link>
              <a href="mailto:informame@littlefounders.ai" className="hover:text-gray-900 dark:hover:text-white/70 transition-colors">{t("footer.contact")}</a>
            </div>

            {/* Copyright */}
            <p className="text-xs text-gray-400 dark:text-white/20">{t("footer.copyright")}</p>
          </div>
        </div>
      </footer>
    </>
  );
};
