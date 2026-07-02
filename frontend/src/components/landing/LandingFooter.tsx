import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck, Globe, Sparkles } from "lucide-react";
import { EmailWaitlistForm } from "@/components/landing/EmailWaitlistForm";

interface LandingFooterProps {
  hideCTA?: boolean;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ hideCTA = false }) => {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language;

  const productLinks = [
    { to: "/how-it-works", label: t("nav.how") },
    { to: "/families", label: t("nav.families") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/faq", label: t("nav.faq") },
  ];

  return (
    <>
      {/* ── Pre-footer waitlist band ──────────────────────────────────────── */}
      {!hideCTA && (
        <section className="corp relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a] border-t border-slate-200/70 dark:border-white/10">
          <div className="absolute inset-0 corp-grid-bg opacity-60 dark:opacity-40 pointer-events-none" />
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="rounded-3xl bg-slate-900 px-6 sm:px-12 py-12 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] relative overflow-hidden">
              {/* Brand glows — jade + amber, not indigo */}
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-[#1a9e7a]/15 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-amber-500/12 blur-[80px] pointer-events-none" />
              <span className="corp-eyebrow text-white/70">
                {t("families.hero.coming_soon_label")}
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-white">
                {t("families.cta.title")}
              </h2>
                <p className="mt-3 text-white/70 max-w-xl mx-auto leading-relaxed">
                {t("families.hero.notify_desc")}
              </p>
              <div className="mt-7 flex justify-center">
                <EmailWaitlistForm
                  ctaLabel={t("families.hero.notify_cta")}
                  placeholder={t("families.hero.email_placeholder")}
                  successMsg={t("families.hero.email_success")}
                  language={lang}
                  source="landing_footer"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="corp relative bg-white dark:bg-[#060911] border-t border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-5">
              <Link to="/" className="inline-flex items-center">
                <img
                  src="/logo-sized.png"
                  alt="LittleFounders"
                  className="h-9 w-auto object-contain dark:brightness-110"
                  loading="lazy"
                />
              </Link>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                {t("corp.hero.subtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> {t("corp.trust.item_1")}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Globe className="w-4 h-4 text-indigo-500" /> {t("corp.trust.item_3")}
                </span>
              </div>
            </div>

            {/* Product links */}
            <div className="md:col-span-3">
              <h3 className="corp-eyebrow mb-4">
                {t("footer.product")}
              </h3>
              <ul className="space-y-3">
                {productLinks.map((l) => (
                  <li key={l.to}>
                    <Link
                       to={l.to}
                       className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 active:scale-[0.97] transition-[color,transform] duration-150"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact / legal */}
            <div className="md:col-span-4">
              <h3 className="corp-eyebrow mb-4">
                {t("footer.contact")}
              </h3>
              <div>
                <a
                  href="mailto:informame@littlefounders.ai"
                  className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 active:scale-[0.97] transition-[color,transform] duration-150"
                >
                  <Mail className="w-4 h-4" /> informame@littlefounders.ai
                </a>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="corp-btn-primary inline-flex items-center justify-center text-sm font-semibold rounded-xl px-5 py-2.5 w-fit"
                >
                  {t("nav.register")}
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("footer.copyright")}</p>
            <div className="flex items-center gap-6 text-xs text-slate-400 dark:text-slate-500">
              <Link to="/legal/terms" className="hover:text-slate-700 dark:hover:text-slate-300 active:scale-[0.97] transition-[color,transform] duration-150">{t("footer.terms")}</Link>
              <Link to="/legal/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 active:scale-[0.97] transition-[color,transform] duration-150">{t("footer.privacy")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
