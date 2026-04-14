/**
 * Hook para obtener lecciones de una aventura/saga/topic.
 * For guest users (no userId), completed status is overlaid from localStorage
 * so that /learn shows accurate progress without a backend user account.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getGuestProfile } from '@/lib/guestProfile';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export interface LessonItem {
    id: number;
    code: string;
    title: string;
    description: string;
    adventureLevel: number;
    sagaLevel: number;
    topicLevel: number;
    topicTitle?: string;
    lessonNumber: number;
    duration: number;
    pointsReward: number;
    completed: boolean;
    progress: number;
    score: number;
}

interface UseLessonsListReturn {
    lessons: LessonItem[];
    totalLessons: number;
    completedLessons: number;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useLessonsList(
    adventureId: number,
    sagaId?: number,
    topicId?: number,
    userId?: string
): UseLessonsListReturn {
    const { i18n } = useTranslation();
    const [lessons, setLessons] = useState<LessonItem[]>([]);
    const [totalLessons, setTotalLessons] = useState(0);
    const [completedLessons, setCompletedLessons] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLessons = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (sagaId) params.append('saga_id', sagaId.toString());
            if (topicId) params.append('topic_id', topicId.toString());
            if (userId) params.append('user_public_id', userId);
            params.append('lang', i18n.language || 'es');

            const url = `${API_BASE}/lesson-engine/lessons/by-adventure/${adventureId}?${params}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // For guest users, the backend has no user_id to check completion against.
            // We overlay completion status from the guest profile stored in localStorage.
            const guestCompletedCodes: Set<string> = !userId
                ? new Set(getGuestProfile()?.completed_lesson_codes ?? [])
                : new Set();

            const mappedLessons = data.lessons.map((l: any) => {
                const completedByGuest = !userId && guestCompletedCodes.has(l.code);
                return {
                    id: l.id,
                    code: l.code,
                    title: l.title,
                    description: l.description,
                    adventureLevel: l.adventure_level,
                    sagaLevel: l.saga_level,
                    topicLevel: l.topic_level,
                    topicTitle: l.topic_title || '',
                    lessonNumber: l.lesson_number,
                    duration: l.duration,
                    pointsReward: l.points_reward,
                    completed: l.completed || completedByGuest,
                    progress: completedByGuest ? 100 : l.progress,
                    score: l.score
                };
            });

            setLessons(mappedLessons);
            setTotalLessons(data.total_lessons);
            // Recount completed using the guest-overlaid data
            setCompletedLessons(!userId
                ? mappedLessons.filter((l: LessonItem) => l.completed).length
                : data.completed_lessons
            );
        } catch (err) {
            console.error('Error fetching lessons:', err);
            setError(err instanceof Error ? err.message : 'Error loading lessons');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (adventureId) {
            fetchLessons();
        }
    }, [adventureId, sagaId, topicId, userId, i18n.language]);

    return { lessons, totalLessons, completedLessons, isLoading, error, refetch: fetchLessons };
}
