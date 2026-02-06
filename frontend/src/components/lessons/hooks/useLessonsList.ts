/**
 * Hook para obtener lecciones de una aventura/saga/topic
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    userId?: number
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
            if (userId) params.append('user_id', userId.toString());
            params.append('lang', i18n.language || 'es');

            const url = `${API_BASE}/lesson-engine/lessons/by-adventure/${adventureId}?${params}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            setLessons(data.lessons.map((l: any) => ({
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
                completed: l.completed,
                progress: l.progress,
                score: l.score
            })));
            setTotalLessons(data.total_lessons);
            setCompletedLessons(data.completed_lessons);
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
