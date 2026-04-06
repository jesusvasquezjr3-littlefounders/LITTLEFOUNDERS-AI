import React from "react";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

interface ChildDashboardProps {
  user: any;
}

export function ChildDashboard({ user }: ChildDashboardProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
      <div className="bg-yellow-100 dark:bg-yellow-900/30 p-8 rounded-full mb-6">
        <Construction className="w-24 h-24 text-yellow-600 dark:text-yellow-500" />
      </div>

      <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-4">
        ¡Página en Construcción!
      </h1>

      <p className="text-lg text-muted-foreground max-w-md mb-8">
        {t('in_development.description', 'Pronto tendremos un nuevo y mejorado panel para ti.')}
      </p>
    </div>
  );
}
