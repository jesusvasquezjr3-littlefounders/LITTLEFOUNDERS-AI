import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export const LandingParentCTA: React.FC = () => {
  const { t } = useTranslation("landing");

  return (
    <section className="relative py-20 sm:py-28 bg-slate-50 dark:bg-[#0a0e1a] overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="corp-eyebrow mb-6 inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {t("cta_parents.disclaimer")}
        </span>

        <h2 className="corp-h2 mb-6">
          {t("cta_parents.title")}
        </h2>

        <p className="corp-body mb-10 max-w-2xl mx-auto">
          {t("cta_parents.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link
            to="/onboarding"
            className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 w-full sm:w-auto"
          >
            {t("cta_parents.button")}
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            to="/login"
            className="corp-btn-secondary inline-flex items-center justify-center text-base font-semibold rounded-xl px-8 py-3.5 w-full sm:w-auto"
          >
            {t("cta_parents.login_link")}
          </Link>
        </div>

        <p className="corp-body mt-5">
          {t("hero.cta_subtext")}
        </p>
      </div>
    </section>
  );
};
