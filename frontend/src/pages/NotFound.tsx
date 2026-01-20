import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation('common');

  useEffect(() => {
    console.error(
      t('not_found.console_error'),
      location.pathname
    );
  }, [location.pathname, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{t('not_found.title')}</h1>
        <p className="text-xl text-gray-600 mb-4">{t('not_found.message')}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {t('not_found.return_home')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
