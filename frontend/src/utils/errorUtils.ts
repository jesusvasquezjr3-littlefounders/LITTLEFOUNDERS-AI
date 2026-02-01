import { TFunction } from "i18next";

/**
 * Maps backend error messages to localized strings.
 * 
 * @param error The error object or string from the backend response (usually data.detail).
 * @param t The translation function from useTranslation.
 * @returns A localized error message string.
 */
export const getTranslatedError = (error: any, t: TFunction): string => {
    // If error is undefined or null, return generic error
    if (!error) {
        return t('errors:generic.something_went_wrong');
    }

    // 1. Handle error strings (direct messages from backend)
    if (typeof error === 'string') {
        const lowerError = error.toLowerCase();

        // Common Backend Error Mappings
        if (lowerError.includes('incorrect email or password') || lowerError.includes('credentials')) {
            return t('errors:auth.invalid_credentials');
        }
        if (lowerError.includes('already exists') || lowerError.includes('registered')) {
            // Check for the specific "Please login" part to distinguish
            if (lowerError.includes('please login')) {
                return t('errors:auth.user_already_registered');
            }
            return t('errors:auth.email_already_exists');
        }
        if (lowerError.includes('google')) {
            return t('auth:messages.login_error'); // Or specific google error
        }
        if (lowerError.includes('register first') || lowerError.includes('user not found')) {
            return t('errors:not_found.user_not_found');
        }
        if (lowerError.includes('not found')) {
            return t('errors:not_found.resource');
        }

        // Return the string itself if no mapping found (fallback)
        // Ideally we should log this so we can add it to mappings later
        return error;
    }

    // 2. Handle Pydantic validation errors (Array of objects)
    // Format: [{ loc: [..], msg: "...", type: "..." }]
    if (Array.isArray(error)) {
        // Return the first error message, mapped if possible
        const firstError = error[0];
        if (firstError && firstError.msg) {
            return `${t('errors:validation.required_field')}: ${firstError.msg}`;
        }
        return t('errors:validation.required_field');
    }

    // 3. Handle object with detail property (sometimes nested)
    if (typeof error === 'object' && error.detail) {
        return getTranslatedError(error.detail, t);
    }

    // Fallback
    return t('errors:generic.something_went_wrong');
};
