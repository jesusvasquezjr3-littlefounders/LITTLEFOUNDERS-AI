/*
 * Where each sign-in action goes. These are placeholders for the first application routes: a value of
 * `null` means "not set up yet", and the action then tells the visitor so instead of doing nothing.
 *
 * Every route path in the platform is in English, whatever the interface language (D-011 in
 * docs/process/DECISIONS.md): `/sign-up`, not `/crear-cuenta`. To wire an action, put its path here.
 * Signing in with Google and with email is handled by the auth provider, not by a route, so those two
 * entries stay `null` until the provider is connected.
 */

export const AUTH_TARGETS = {
  google: null,
  emailOrUsername: null,
  signUp: null,
} as const satisfies Record<string, string | null>;

export type AuthAction = keyof typeof AUTH_TARGETS;
