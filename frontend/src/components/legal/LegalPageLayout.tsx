import React from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { FileText, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LegalPageLayoutProps {
  titleKey: string;
  subtitleKey: string;
  eyebrowKey: string;
  effectiveDateKey: string;
  comingSoonKey: string;
  comingSoonDescKey: string;
  contactNoteKey: string;
  children?: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  titleKey,
  subtitleKey,
  eyebrowKey,
  effectiveDateKey,
  comingSoonKey,
  comingSoonDescKey,
  contactNoteKey,
  children,
}) => {
  const { t } = useTranslation("legal");

  return (
    <LandingLayout hideCTA>
      <div className="bg-slate-50 dark:bg-[#0a0e1a] pb-20 sm:pb-28">
      <header className="relative overflow-hidden">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="corp-eyebrow">{t(eyebrowKey)}</Reveal>
          <Reveal delay={60}>
            <h1 className="corp-h1 mt-3">
              {t(titleKey)}
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="corp-subtitle-lg mt-4 max-w-xl mx-auto">
              {t(subtitleKey)}
            </p>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t(effectiveDateKey)}
            </p>
          </Reveal>
        </div>
      </header>

      <section className="relative -mt-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-[#0d1426] rounded-[2rem] p-8 sm:p-12 lg:p-16 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-slate-200/50 dark:border-white/5">
          {children ? (
            <div className="prose prose-slate dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 max-w-none">
              {children}
            </div>
          ) : (
              <Reveal>
              <div className="text-center flex flex-col items-center gap-5 py-12">
                <div className="corp-icon-chip w-14 h-14">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="corp-h3">
                    {t(comingSoonKey)}
                  </h2>
                  <p className="corp-body mt-2 max-w-md mx-auto">
                    {t(comingSoonDescKey)}
                  </p>
                </div>
                <a
                  href="mailto:informame@littlefounders.ai"
                  className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:rounded-md"
                >
                  <Mail className="w-4 h-4" />
                  {t(contactNoteKey)} informame@littlefounders.ai
                </a>
              </div>
            </Reveal>
          )}
          </div>
        </div>
      </section>
    </div>
  </LandingLayout>
  );
};
