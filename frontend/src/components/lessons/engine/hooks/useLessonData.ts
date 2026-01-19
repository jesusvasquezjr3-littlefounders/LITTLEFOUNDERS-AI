/**
 * Hook para obtener datos de lección desde el backend
 */
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AudioData {
    url: string | null;
    characterId?: number;
    characterCode?: string;
    gesture?: string;
    emotion?: string;
    transcript?: string;
    duration_ms?: number;
}

export interface ExerciseData {
    id: number;
    type: 'intro_narrative' | 'multiple_choice' | 'drag_drop' | 'match_pairs' | 'fill_blank' | 'classification' | 'tap_action' | 'comparison';
    order_index: number;
    character_code?: string; // 'liruf' o 'dina'
    start_time_ms: number;
    pause_at_ms?: number;
    content: {
        question?: string;
        characterCode?: string;
        gesture?: string;
        emotion?: string;
        transcript?: string;
        instruction?: string;
        options?: Array<{ id: string; text: string; image?: string | null }>;
        // Classification specific
        items?: Array<{ id: string; text: string; emoji?: string; category?: string; isTarget?: boolean; type?: string }>;
        categories?: Array<{ id: string; label: string }>;
    };
    correct_answer?: {
        correctOptionId?: string;
        classifications?: Record<string, string>;
        targetIds?: string[];
    } | null;
    feedback?: { success: string; error: string } | null;
    points: number;
    audio?: AudioData | null;
}

export interface LessonMeta {
    estimated_duration_seconds: number;
    points_reward: number;
    xp_reward: number;
}

export interface LessonInfo {
    id: number;
    code: string;
    title: string;
    description?: string;
    saga?: string;
    saga_code?: string;
    adventure?: string;
    adventure_code?: string;
}

export interface LessonData {
    lesson: LessonInfo;
    meta: LessonMeta;
    timeline: ExerciseData[];
}

interface UseLessonDataReturn {
    data: LessonData | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useLessonData(lessonCode: string): UseLessonDataReturn {
    const [data, setData] = useState<LessonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLesson = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE}/lesson-engine/lessons/${lessonCode}/play`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: Lección no encontrada`);
            }

            const lessonData = await response.json();
            setData(lessonData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar la lección');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (lessonCode) {
            fetchLesson();
        }
    }, [lessonCode]);

    return { data, loading, error, refetch: fetchLesson };
}
