import React from "react";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

interface ParentDashboardProps {
  user: any;
}

export function ParentDashboard({ user }: ParentDashboardProps) {
  const { t } = useTranslation('common');

  return (
    <div className="corp flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
      <div className="corp-icon-chip w-24 h-24 mb-6">
        <Construction className="w-12 h-12" />
      </div>

      <h1 className="corp-display text-3xl md:text-5xl font-bold mb-4">
        <span className="corp-gradient-text">{t('in_development.title', '¡Página en Construcción!')}</span>
      </h1>

      <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mb-8">
        {t('in_development.description', 'Pronto tendremos un nuevo y mejorado panel para ti.')}
      </p>
    </div>
  );
}
