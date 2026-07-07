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
      {/* ─ Pre-footer waitlist band ──────────────────────────────────────── */}
      {!hideCTA && (
        <section className="corp relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a] border-t border-slate-200/50 dark:border-white/8">
          <div className="relative z-10 max-w-[85rem] mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
            <div className="rounded-[2rem] md:rounded-[2.5rem] bg-white dark:bg-[#0d1426] px-6 sm:px-14 py-14 sm:py-20 text-center shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-slate-200/50 dark:border-white/5 relative overflow-hidden">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/8 corp-caption font-bold uppercase tracking-wider">
                {t("families.hero.coming_soon_label")}
              </span>
              <h2 className="corp-h2 mt-6">
                {t("families.cta.title")}
              </h2>
              <p className="corp-body mt-4 max-w-lg mx-auto">
                {t("families.hero.notify_desc")}
              </p>
              <div className="mt-10 flex justify-center">
                <EmailWaitlistForm
                  ctaLabel={t("families.hero.notify_cta")}
                  placeholder={t("families.hero.email_placeholder")}
                  successMsg={t("families.hero.email_success")}
                  language={lang}
                  source="landing_footer"
                />
              </div>
              <p className="corp-body-sm mt-6">
                {t("families.cta.disclaimer")}
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-8">
                {[t("families.cta.trust_1"), t("families.cta.trust_2"), t("families.cta.trust_3")].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span className="corp-caption font-bold uppercase tracking-wider">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="corp relative bg-white dark:bg-[#060911] border-t border-slate-200/60 dark:border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-10 lg:gap-12">
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
              <p className="corp-body mt-4 max-w-xs">
                {t("corp.hero.subtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <span className="inline-flex items-center gap-2 corp-caption font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {t("corp.trust.item_1")}
                </span>
                <span className="inline-flex items-center gap-2 corp-caption font-semibold uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" /> {t("corp.trust.item_3")}
                </span>
              </div>
            </div>

            {/* Product links */}
            <div className="md:col-span-3">
              <h3 className="corp-eyebrow mb-5">
                {t("footer.product")}
              </h3>
               <ul className="space-y-3.5">
                {productLinks.map((l) => (
                  <li key={l.to}>
                    <Link
                       to={l.to}
                        className="relative corp-body-sm hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:rounded-md after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-current after:scale-x-0 after:origin-left hover:after:scale-x-100 after:transition-transform after:duration-200 after:ease-out"
                    >
                       {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact / legal */}
            <div className="md:col-span-4">
              <h3 className="corp-eyebrow mb-5">
                {t("footer.contact")}
              </h3>
              <div>
                <a
                  href="mailto:informame@littlefounders.ai"
                  className="inline-flex items-center gap-2.5 corp-body-sm hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:rounded-md group"
                >
                  <Mail className="w-4 h-4 transition-transform duration-200 ease-out group-hover:-rotate-6" /> informame@littlefounders.ai
                </a>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="corp-btn-primary inline-flex items-center justify-center corp-body-sm font-semibold rounded-full px-6 py-2.5 w-fit"
                >
                  {t("nav.register")}
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-8 border-t border-slate-200/60 dark:border-white/8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="corp-body-sm">{t("footer.copyright")}</p>
            <div className="flex items-center gap-6 corp-caption">
              <Link to="/legal/terms" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-md">{t("footer.terms")}</Link>
              <Link to="/legal/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-md">{t("footer.privacy")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
