import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation('common');

  useEffect(() => {
    console.error(
      t('common:notFound.console_error'),
      location.pathname
    );
  }, [location.pathname, t]);

  return (
    <div className="corp min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <p className="corp-gradient-text text-7xl sm:text-8xl font-bold leading-none">404</p>
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t('common:notFound.title')}
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('common:notFound.message')}
            </p>
          </div>
          <a
            href="/"
            className="corp-btn-primary inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold"
          >
            {t('common:notFound.back_home')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
