/**
 * Gesture Mapper Utility
 * 
 * Provides gesture equivalence mappings and default fallbacks for character gestures.
 * This ensures backward compatibility when lesson data uses old/different gesture codes.
 */

interface GestureMapping {
    default: string;
    mappings: Record<string, string>;
}

interface GestureEquivalences {
    [characterCode: string]: GestureMapping;
}

/**
 * Gesture equivalence mappings per character
 * Maps old/alternative gesture names to actual component prop values
 */
export const GESTURE_EQUIVALENCES: GestureEquivalences = {
    liruf: {
        default: 'happy',
        mappings: {
            // Actual gestures (DinoCharacter moods)
            happy: 'happy',
            sad: 'sad',
            excited: 'excited',
            thinking: 'thinking',
            shocked: 'shocked',
            // Spanish equivalents
            feliz: 'happy',
            triste: 'sad',
            emocionado: 'excited',
            pensando: 'thinking',
            sorprendido: 'shocked',
            // Common alternatives/fallbacks
            neutral: 'happy',
            surprised: 'shocked',
            alegre: 'happy',
            contento: 'happy',
        },
    },
    dina: {
        default: 'happy',
        mappings: {
            // Actual gestures (DinaCharacter expressions)
            neutral: 'neutral',
            happy: 'happy',
            surprised: 'surprised',
            wink: 'wink',
            // Spanish equivalents
            feliz: 'happy',
            sorprendida: 'surprised',
            guiño: 'wink',
            // Common alternatives/fallbacks
            excited: 'happy',
            alegre: 'happy',
            shocked: 'surprised',
            sorprendido: 'surprised',
        },
    },
    dr_rho: {
        default: 'wise',
        mappings: {
            // Actual gestures (DrRhoCharacter moods)
            neutral: 'neutral',
            wise: 'wise',
            mysterious: 'mysterious',
            explaining: 'explaining',
            surprised: 'surprised',
            // Spanish equivalents
            sabio: 'wise',
            misterioso: 'mysterious',
            explicando: 'explaining',
            sorprendido: 'surprised',
            // Common alternatives/fallbacks
            happy: 'wise',
            thinking: 'explaining',
            shocked: 'surprised',
        },
    },
    zara_vex: {
        default: 'happy',
        mappings: {
            // Actual gestures (ZaraVexCharacter moods)
            neutral: 'neutral',
            happy: 'happy',
            flirty: 'flirty',
            curious: 'curious',
            excited: 'excited',
            // Spanish equivalents
            feliz: 'happy',
            coqueta: 'flirty',
            curiosa: 'curious',
            emocionada: 'excited',
            // Common alternatives/fallbacks
            alegre: 'happy',
            thinking: 'curious',
            surprised: 'curious',
        },
    },
};

/**
 * Character options for UI selectors
 */
export const CHARACTER_OPTIONS = [
    { code: 'liruf', emoji: '🦖', label: 'Liruf' },
    { code: 'dina', emoji: '🐱', label: 'Dina' },
    { code: 'dr_rho', emoji: '🤖', label: 'Dr. Rho' },
    { code: 'zara_vex', emoji: '👽', label: 'Zara Vex' },
];

/**
 * Gesture labels with emoji for UI display, per character
 */
export const GESTURE_LABELS: Record<string, Array<{ value: string; emoji: string; label: string; labelEn: string }>> = {
    liruf: [
        { value: 'happy', emoji: '😊', label: 'Feliz', labelEn: 'Happy' },
        { value: 'sad', emoji: '😢', label: 'Triste', labelEn: 'Sad' },
        { value: 'excited', emoji: '🤩', label: 'Emocionado', labelEn: 'Excited' },
        { value: 'thinking', emoji: '🤔', label: 'Pensando', labelEn: 'Thinking' },
        { value: 'shocked', emoji: '😱', label: 'Sorprendido', labelEn: 'Shocked' },
    ],
    dina: [
        { value: 'neutral', emoji: '😐', label: 'Neutral', labelEn: 'Neutral' },
        { value: 'happy', emoji: '😊', label: 'Feliz', labelEn: 'Happy' },
        { value: 'surprised', emoji: '😮', label: 'Sorprendida', labelEn: 'Surprised' },
        { value: 'wink', emoji: '😉', label: 'Guiño', labelEn: 'Wink' },
    ],
    dr_rho: [
        { value: 'neutral', emoji: '😐', label: 'Neutral', labelEn: 'Neutral' },
        { value: 'wise', emoji: '🧙', label: 'Sabio', labelEn: 'Wise' },
        { value: 'mysterious', emoji: '🔮', label: 'Misterioso', labelEn: 'Mysterious' },
        { value: 'explaining', emoji: '📚', label: 'Explicando', labelEn: 'Explaining' },
        { value: 'surprised', emoji: '😮', label: 'Sorprendido', labelEn: 'Surprised' },
    ],
    zara_vex: [
        { value: 'neutral', emoji: '😐', label: 'Neutral', labelEn: 'Neutral' },
        { value: 'happy', emoji: '😊', label: 'Feliz', labelEn: 'Happy' },
        { value: 'flirty', emoji: '😏', label: 'Coqueta', labelEn: 'Flirty' },
        { value: 'curious', emoji: '🧐', label: 'Curiosa', labelEn: 'Curious' },
        { value: 'excited', emoji: '🤩', label: 'Emocionada', labelEn: 'Excited' },
    ],
};

/**
 * Get gesture label options for a character
 */
export function getGestureLabels(characterCode: string): Array<{ value: string; emoji: string; label: string; labelEn: string }> {
    const charCode = characterCode.toLowerCase().trim();
    return GESTURE_LABELS[charCode] || [];
}

/**
 * Normalize a gesture code to match the character component's expected prop value.
 * 
 * @param characterCode - The character code (e.g., 'liruf', 'dina', 'dr_rho', 'zara_vex')
 * @param rawGesture - The raw gesture code from the database or lesson data
 * @returns The normalized gesture code that matches the component's prop definition,
 *          or the default gesture for the character if no mapping is found.
 * 
 * @example
 * normalizeGesture('liruf', 'feliz') // returns 'happy'
 * normalizeGesture('dina', 'sorprendida') // returns 'surprised'
 * normalizeGesture('dr_rho', 'unknown_gesture') // returns 'wise'
 */
export function normalizeGesture(characterCode: string, rawGesture?: string | null): string {
    // Normalize character code
    const charCode = characterCode.toLowerCase().trim();

    // Handle None or empty gesture
    if (!rawGesture) {
        return GESTURE_EQUIVALENCES[charCode]?.default || 'happy';
    }

    // Normalize gesture code
    const gesture = rawGesture.toLowerCase().trim();

    // Get character's mapping
    const charMapping = GESTURE_EQUIVALENCES[charCode];
    if (!charMapping) {
        return 'happy'; // Ultimate fallback
    }

    // Try to find mapping
    const normalized = charMapping.mappings[gesture];

    // Return mapped gesture or default
    return normalized || charMapping.default || 'happy';
}

/**
 * Get the list of valid gestures for a character.
 * 
 * @param characterCode - The character code
 * @returns List of valid gesture codes for the character
 */
export function getAvailableGestures(characterCode: string): string[] {
    const charCode = characterCode.toLowerCase().trim();
    const charMapping = GESTURE_EQUIVALENCES[charCode];

    if (!charMapping) {
        return [];
    }

    // Get unique actual gesture values (not the keys)
    const actualGestures = new Set(Object.values(charMapping.mappings));
    return Array.from(actualGestures).sort();
}
