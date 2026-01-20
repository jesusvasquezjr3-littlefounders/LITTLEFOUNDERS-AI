/**
 * Hook para obtener datos de lección desde el backend
 * Soporte para internacionalización (i18n)
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
    language?: string; // Idioma de la respuesta
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

/**
 * Hook para obtener datos de lección con soporte de idioma
 * @param lessonCode - Código de la lección (ej: "1-1-0-1")
 * @param language - Código de idioma opcional (si no se pasa, usa el idioma actual de i18n)
 */
export function useLessonData(lessonCode: string, language?: string): UseLessonDataReturn {
    const { i18n } = useTranslation();
    const [data, setData] = useState<LessonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Usar idioma pasado o el idioma actual de i18n
    const currentLanguage = language || i18n.language || 'es';

    const fetchLesson = async () => {
        try {
            setLoading(true);
            setError(null);

            // Agregar parámetro de idioma a la URL
            const url = `${API_BASE}/lesson-engine/lessons/${lessonCode}/play?lang=${currentLanguage}`;
            const response = await fetch(url);

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
    }, [lessonCode, currentLanguage]); // Re-fetch cuando cambie el idioma

    return { data, loading, error, refetch: fetchLesson };
}
