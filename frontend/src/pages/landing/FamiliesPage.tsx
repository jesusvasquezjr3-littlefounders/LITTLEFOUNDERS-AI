import React from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { useTranslation } from 'react-i18next';

export default function FamiliesPage() {
    const { t } = useTranslation('landing');

    return (
        <LandingLayout>
            <div className="min-h-screen pt-32 pb-24 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">
                <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-6 text-center transition-colors">
                    {t('nav.families')}
                </h1>
            </div>
        </LandingLayout>
    );
}
