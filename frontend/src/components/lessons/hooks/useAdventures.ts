/**
 * Hook para obtener aventuras desde el API con soporte i18n
 * Reemplaza el hook estático anterior
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Adventure {
    id: number;
    code: string;
    title: string;
    ageRange: string;
    description: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    status: 'available' | 'locked' | 'completed';
    progress: number;
    totalLessons: number;
    completedLessons: number;
    themeColor: string;
}

interface APIAdventure {
    id: number;
    code: string;
    title: string;
    description: string;
    age_range: string;
    theme: string;
    theme_color: string;
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
}

interface UseAdventuresReturn {
    adventures: Adventure[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Determina el estado de una aventura basado en su posición y progreso
 */
function getAdventureStatus(
    index: number,
    completedLessons: number,
    totalLessons: number,
    previousCompleted: boolean
): 'available' | 'locked' | 'completed' {
    if (completedLessons === totalLessons && totalLessons > 0) {
        return 'completed';
    }
    // First adventure is always available, others unlock when previous is complete
    if (index === 0 || previousCompleted) {
        return 'available';
    }
    return 'locked';
}

export function useAdventuresAPI(userId?: number): UseAdventuresReturn {
    const { t, i18n } = useTranslation('adventures');
    const [data, setData] = useState<APIAdventure[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAdventures = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (userId) params.append('user_id', userId.toString());
            params.append('lang', i18n.language || 'es');

            const url = `${API_BASE}/lesson-engine/adventures?${params}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const adventures = await response.json();
            setData(adventures);
        } catch (err) {
            console.error('Error fetching adventures:', err);
            setError(err instanceof Error ? err.message : 'Error loading adventures');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdventures();
    }, [userId, i18n.language]);

    // Transform API data to frontend format with i18n titles from translations
    const adventures = useMemo<Adventure[]>(() => {
        return data.map((adv, index) => {
            // Get previous adventure completion status
            const previousCompleted = index === 0 ||
                (data[index - 1]?.completed_lessons === data[index - 1]?.total_lessons && data[index - 1]?.total_lessons > 0);

            return {
                id: adv.id,
                code: adv.code,
                // Use i18n translation if available, fallback to API title
                title: t(`list.${adv.id}.title`, { defaultValue: adv.title }),
                description: t(`list.${adv.id}.description`, { defaultValue: adv.description || '' }),
                ageRange: t(`list.${adv.id}.age_range`, { defaultValue: adv.age_range }),
                theme: adv.theme as Adventure['theme'],
                themeColor: adv.theme_color,
                status: getAdventureStatus(index, adv.completed_lessons, adv.total_lessons, previousCompleted),
                progress: adv.progress_percent,
                totalLessons: adv.total_lessons,
                completedLessons: adv.completed_lessons
            };
        });
    }, [data, t]);

    return { adventures, isLoading, error, refetch: fetchAdventures };
}

// Export legacy hook for backward compatibility
export const useAdventures = useAdventuresAPI;
