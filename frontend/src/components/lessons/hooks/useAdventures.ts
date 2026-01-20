import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

export interface Adventure {
    id: number;
    title: string;
    ageRange: string;
    description: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    status: 'available' | 'locked' | 'completed';
    progress: number;
    totalLessons: number;
    completedLessons: number;
}

export const useAdventures = () => {
    const { t } = useTranslation('adventures');

    const adventures = useMemo<Adventure[]>(() => [
        {
            id: 1,
            title: t('list.1.title'),
            ageRange: t('list.1.age_range'),
            description: t('list.1.description'),
            theme: "archipelago",
            status: "available",
            progress: 35,
            totalLessons: 50,
            completedLessons: 18,
        },
        {
            id: 2,
            title: t('list.2.title'),
            ageRange: t('list.2.age_range'),
            description: t('list.2.description'),
            theme: "forest",
            status: "locked",
            progress: 0,
            totalLessons: 40,
            completedLessons: 0,
        },
        {
            id: 3,
            title: t('list.3.title'),
            ageRange: t('list.3.age_range'),
            description: t('list.3.description'),
            theme: "city",
            status: "locked",
            progress: 0,
            totalLessons: 29,
            completedLessons: 0,
        },
        {
            id: 4,
            title: t('list.4.title'),
            ageRange: t('list.4.age_range'),
            description: t('list.4.description'),
            theme: "valley",
            status: "locked",
            progress: 0,
            totalLessons: 40,
            completedLessons: 0,
        },
        {
            id: 5,
            title: t('list.5.title'),
            ageRange: t('list.5.age_range'),
            description: t('list.5.description'),
            theme: "kingdom",
            status: "locked",
            progress: 0,
            totalLessons: 65,
            completedLessons: 0,
        },
        {
            id: 6,
            title: t('list.6.title'),
            ageRange: t('list.6.age_range'),
            description: t('list.6.description'),
            theme: "cosmos",
            status: "locked",
            progress: 0,
            totalLessons: 8,
            completedLessons: 0,
        },
    ], [t]);

    return { adventures };
};
