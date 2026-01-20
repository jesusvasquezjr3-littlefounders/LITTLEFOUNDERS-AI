import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Topic } from '../TopicNode';

export interface SagaData {
    id: number;
    title: string;
    subtitle: string;
    theme: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple';
    description: string;
    topics: Topic[];
}

export interface NextAdventureData {
    id: number;
    title: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    description: string;
}

export const useSagaData = () => {
    const { t } = useTranslation('adventures');

    const adventure1Sagas = useMemo<SagaData[]>(() => [
        {
            id: 1,
            title: t('sagas.1.title'),
            subtitle: t('sagas.1.subtitle'),
            theme: "amber",
            description: t('sagas.1.description'),
            topics: [
                { id: 1, title: t('sagas.1.topics.1.title'), description: t('sagas.1.topics.1.description'), isCompleted: true, isLocked: false, type: 'lesson' },
                { id: 2, title: t('sagas.1.topics.2.title'), description: t('sagas.1.topics.2.description'), isCompleted: true, isLocked: false, type: 'lesson' },
                { id: 3, title: t('sagas.1.topics.3.title'), description: t('sagas.1.topics.3.description'), isCompleted: true, isLocked: false, type: 'lesson' },
                { id: 4, title: t('sagas.1.topics.4.title'), description: t('sagas.1.topics.4.description'), isCompleted: false, isLocked: false, type: 'lesson' },
                { id: 5, title: t('sagas.1.topics.5.title'), description: t('sagas.1.topics.5.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 6, title: t('sagas.1.topics.6.title'), description: t('sagas.1.topics.6.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 7, title: t('sagas.1.topics.7.title'), description: t('sagas.1.topics.7.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 8, title: t('sagas.1.topics.8.title'), description: t('sagas.1.topics.8.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 9, title: t('sagas.1.topics.9.title'), description: t('sagas.1.topics.9.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 10, title: t('sagas.1.topics.10.title'), description: t('sagas.1.topics.10.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 11, title: t('sagas.1.topics.11.title'), description: t('sagas.1.topics.11.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        },
        {
            id: 2,
            title: t('sagas.2.title'),
            subtitle: t('sagas.2.subtitle'),
            theme: "blue",
            description: t('sagas.2.description'),
            topics: [
                { id: 12, title: t('sagas.2.topics.12.title'), description: t('sagas.2.topics.12.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 13, title: t('sagas.2.topics.13.title'), description: t('sagas.2.topics.13.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 14, title: t('sagas.2.topics.14.title'), description: t('sagas.2.topics.14.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 15, title: t('sagas.2.topics.15.title'), description: t('sagas.2.topics.15.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 16, title: t('sagas.2.topics.16.title'), description: t('sagas.2.topics.16.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 17, title: t('sagas.2.topics.17.title'), description: t('sagas.2.topics.17.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 18, title: t('sagas.2.topics.18.title'), description: t('sagas.2.topics.18.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 19, title: t('sagas.2.topics.19.title'), description: t('sagas.2.topics.19.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 20, title: t('sagas.2.topics.20.title'), description: t('sagas.2.topics.20.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 21, title: t('sagas.2.topics.21.title'), description: t('sagas.2.topics.21.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        },
        {
            id: 3,
            title: t('sagas.3.title'),
            subtitle: t('sagas.3.subtitle'),
            theme: "emerald",
            description: t('sagas.3.description'),
            topics: [
                { id: 22, title: t('sagas.3.topics.22.title'), description: t('sagas.3.topics.22.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 23, title: t('sagas.3.topics.23.title'), description: t('sagas.3.topics.23.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 24, title: t('sagas.3.topics.24.title'), description: t('sagas.3.topics.24.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 25, title: t('sagas.3.topics.25.title'), description: t('sagas.3.topics.25.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 26, title: t('sagas.3.topics.26.title'), description: t('sagas.3.topics.26.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 27, title: t('sagas.3.topics.27.title'), description: t('sagas.3.topics.27.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 28, title: t('sagas.3.topics.28.title'), description: t('sagas.3.topics.28.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 29, title: t('sagas.3.topics.29.title'), description: t('sagas.3.topics.29.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 30, title: t('sagas.3.topics.30.title'), description: t('sagas.3.topics.30.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 31, title: t('sagas.3.topics.31.title'), description: t('sagas.3.topics.31.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        },
        {
            id: 4,
            title: t('sagas.4.title'),
            subtitle: t('sagas.4.subtitle'),
            theme: "rose",
            description: t('sagas.4.description'),
            topics: [
                { id: 32, title: t('sagas.4.topics.32.title'), description: t('sagas.4.topics.32.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 33, title: t('sagas.4.topics.33.title'), description: t('sagas.4.topics.33.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 34, title: t('sagas.4.topics.34.title'), description: t('sagas.4.topics.34.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 35, title: t('sagas.4.topics.35.title'), description: t('sagas.4.topics.35.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 36, title: t('sagas.4.topics.36.title'), description: t('sagas.4.topics.36.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 37, title: t('sagas.4.topics.37.title'), description: t('sagas.4.topics.37.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 38, title: t('sagas.4.topics.38.title'), description: t('sagas.4.topics.38.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 39, title: t('sagas.4.topics.39.title'), description: t('sagas.4.topics.39.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 40, title: t('sagas.4.topics.40.title'), description: t('sagas.4.topics.40.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 41, title: t('sagas.4.topics.41.title'), description: t('sagas.4.topics.41.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 42, title: t('sagas.4.topics.42.title'), description: t('sagas.4.topics.42.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 43, title: t('sagas.4.topics.43.title'), description: t('sagas.4.topics.43.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        },
        {
            id: 5,
            title: t('sagas.5.title'),
            subtitle: t('sagas.5.subtitle'),
            theme: "purple",
            description: t('sagas.5.description'),
            topics: [
                { id: 44, title: t('sagas.5.topics.44.title'), description: t('sagas.5.topics.44.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 45, title: t('sagas.5.topics.45.title'), description: t('sagas.5.topics.45.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 46, title: t('sagas.5.topics.46.title'), description: t('sagas.5.topics.46.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 47, title: t('sagas.5.topics.47.title'), description: t('sagas.5.topics.47.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 48, title: t('sagas.5.topics.48.title'), description: t('sagas.5.topics.48.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 49, title: t('sagas.5.topics.49.title'), description: t('sagas.5.topics.49.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 50, title: t('sagas.5.topics.50.title'), description: t('sagas.5.topics.50.description'), isCompleted: false, isLocked: true, type: 'lesson' },
                { id: 51, title: t('sagas.5.topics.51.title'), description: t('sagas.5.topics.51.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        }
    ], [t]);

    const adventure6Sagas = useMemo<SagaData[]>(() => [
        {
            id: 60,
            title: t('sagas.60.title'),
            subtitle: t('sagas.60.subtitle'),
            theme: "purple",
            description: t('sagas.60.description'),
            topics: [
                { id: 247, title: t('sagas.60.topics.247.title'), description: t('sagas.60.topics.247.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 248, title: t('sagas.60.topics.248.title'), description: t('sagas.60.topics.248.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 249, title: t('sagas.60.topics.249.title'), description: t('sagas.60.topics.249.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 250, title: t('sagas.60.topics.250.title'), description: t('sagas.60.topics.250.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 251, title: t('sagas.60.topics.251.title'), description: t('sagas.60.topics.251.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 252, title: t('sagas.60.topics.252.title'), description: t('sagas.60.topics.252.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 253, title: t('sagas.60.topics.253.title'), description: t('sagas.60.topics.253.description'), isCompleted: false, isLocked: true, type: 'milestone' },
                { id: 254, title: t('sagas.60.topics.254.title'), description: t('sagas.60.topics.254.description'), isCompleted: false, isLocked: true, type: 'milestone' },
            ]
        }
    ], [t]);

    const nextAdventures = useMemo<Record<number, NextAdventureData | null>>(() => ({
        1: { id: 2, title: t('list.2.title'), theme: "forest", description: t('list.2.description') },
        2: { id: 3, title: t('list.3.title'), theme: "city", description: t('list.3.description') },
        3: { id: 4, title: t('list.4.title'), theme: "valley", description: t('list.4.description') },
        4: { id: 5, title: t('list.5.title'), theme: "kingdom", description: t('list.5.description') },
        5: { id: 6, title: t('list.6.title'), theme: "cosmos", description: t('list.6.description') },
        6: null,
    }), [t]);

    return { adventure1Sagas, adventure6Sagas, nextAdventures };
};
