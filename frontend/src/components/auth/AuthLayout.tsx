import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  showBackToWelcome?: boolean;
}

export function AuthLayout({ children, title, description, showBackToWelcome = true }: AuthLayoutProps) {
  const { t } = useTranslation("auth");

  return (
    <div className="corp min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="full" />
      </div>
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            {showBackToWelcome && (
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 corp-body-sm hover:text-slate-800 dark:hover:text-slate-100 transition-colors duration-200 group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] inline-block">&larr;</span>
                  {t("login.back_to_home")}
                </Link>
              </div>
            )}
          </div>

          {/* Auth Card */}
          <div className="corp-card p-7 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center space-y-1.5">
              <h1 className="corp-h3">{title}</h1>
              <p className="corp-subtitle">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
