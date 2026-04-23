export interface PlacementResult {
    version: 1;
    takenAt: string;
    durationSec: number;
    ageDeclared: number;
    baseAdventure: number;
    finalAdventure: number;
    finalSaga: number;
    /** First lesson of the assigned saga — e.g. "3-2-1-1" */
    targetLessonCode: string;
    overallScore: number;
    confidence: number;
    skipped: boolean;
    itemsServed: string[];
    itemsCorrect: string[];
}

export interface GuestProfile {
    name: string;
    age: number;
    interests: string[];
    experience_level: 'beginner' | 'some_knowledge' | 'experienced';
    preferred_language: 'es' | 'en';
    xp: number;
    current_streak: number;
    max_streak: number;
    lessons_completed: number;
    games_played: number;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
    /** List of lesson codes the guest has completed — used to show progress on /learn */
    completed_lesson_codes: string[];
    /** The next lesson code to resume — mirrors what auth users get from /next-lesson API */
    next_lesson_code: string | null;
    /**
     * YYYY-MM-DD (user's LOCAL date) of the most recent lesson completion.
     * Used to compute streak visual state: 'zero' | 'inactive' | 'active'.
     * null = no activity yet.
     */
    last_activity_date: string | null;
    /** Placement quiz result — null = not yet taken, undefined = field absent (legacy profiles) */
    placement?: PlacementResult | null;
    /**
     * Highest adventure level unlocked via placement.
     * Adventures up to this ID are shown as available even without completing prior adventures.
     */
    placement_adventure?: number | null;
}

const GUEST_KEY = 'lf_guest_profile';

export function getGuestProfile(): GuestProfile | null {
    try {
        const raw = localStorage.getItem(GUEST_KEY);
        return raw ? (JSON.parse(raw) as GuestProfile) : null;
    } catch {
        return null;
    }
}

export function setGuestProfile(profile: GuestProfile): void {
    localStorage.setItem(GUEST_KEY, JSON.stringify(profile));
}

export function updateGuestProfile(updates: Partial<GuestProfile>): void {
    const current = getGuestProfile();
    if (!current) return;
    setGuestProfile({ ...current, ...updates, updated_at: new Date().toISOString() });
}

export function clearGuestProfile(): void {
    localStorage.removeItem(GUEST_KEY);
}

/** True if a guest profile exists AND onboarding is completed. */
export function isGuest(): boolean {
    const profile = getGuestProfile();
    return profile !== null && profile.onboarding_completed === true;
}

/** True if the user has either an authenticated session OR a completed guest profile. */
export function hasSession(): boolean {
    const user = localStorage.getItem('user');
    return user !== null || isGuest();
}

export function addGuestXP(amount: number): void {
    updateGuestProfile({ xp: (getGuestProfile()?.xp ?? 0) + amount });
}

// ─── Pending merge (retry if merge-guest API call failed at registration) ─────

const PENDING_MERGE_KEY = 'lf_guest_merge_pending';

/** Save guest profile as "pending merge" — called before clearing the main profile. */
export function savePendingMerge(profile: GuestProfile): void {
    localStorage.setItem(PENDING_MERGE_KEY, JSON.stringify(profile));
}

/** Get the saved pending merge payload, or null if none. */
export function getPendingMerge(): GuestProfile | null {
    try {
        const raw = localStorage.getItem(PENDING_MERGE_KEY);
        return raw ? (JSON.parse(raw) as GuestProfile) : null;
    } catch {
        return null;
    }
}

/** Clear the pending merge payload after a successful retry. */
export function clearPendingMerge(): void {
    localStorage.removeItem(PENDING_MERGE_KEY);
}
