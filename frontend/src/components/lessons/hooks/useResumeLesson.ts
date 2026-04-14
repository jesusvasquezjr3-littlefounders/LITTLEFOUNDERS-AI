import { useState, useEffect } from 'react';
import { getGuestProfile } from '@/lib/guestProfile';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export function useResumeLesson(userId?: string) {
    const [nextLessonCode, setNextLessonCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        // ── Guest path: read next lesson pointer from localStorage ──────────
        // Guests have no backend account, so progress is tracked in lf_guest_profile.
        // LessonRunner saves next_lesson_code there after each completion.
        if (!userId) {
            const guestProfile = getGuestProfile();
            if (guestProfile?.next_lesson_code) {
                setNextLessonCode(guestProfile.next_lesson_code);
            }
            // isFinished stays false for guests (we never lock them out of the map)
            return;
        }

        // ── Auth path: fetch from backend ───────────────────────────────────
        const fetchNext = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE}/lesson-engine/users/${userId}/next-lesson`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.is_last || !data.next_code) {
                        setIsFinished(true);
                        setNextLessonCode(null);
                    } else {
                        setNextLessonCode(data.next_code);
                        setIsFinished(false);
                    }
                }
            } catch (err) {
                console.error("Error fetching next global lesson", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNext();
    }, [userId]);

    return { nextLessonCode, isLoading, isFinished };
}
