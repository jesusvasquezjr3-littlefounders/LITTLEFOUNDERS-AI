import { api } from '@/lib/api';

/*
 * Social login helpers. Core brokers everything (the frontend never talks to the
 * auth host directly — /AGENTS.md §1.5): Core tells us which providers are live
 * and hands back the GoTrue /authorize URL to redirect the browser to. GoTrue
 * then returns to /auth/callback with the session in the URL fragment.
 */

export type OAuthProvider = 'google';

/** Providers GoTrue has enabled server-side. Empty until credentials are added. */
export async function fetchEnabledProviders(): Promise<OAuthProvider[]> {
  const { data } = await api<{ providers: OAuthProvider[] }>('/auth/oauth/providers');
  return data?.providers ?? [];
}

/** Begin social login: fetch the authorize URL from Core, then redirect the browser. */
export async function startOAuth(provider: OAuthProvider): Promise<{ error: string | null }> {
  const { data, error } = await api<{ url: string }>(`/auth/oauth/${provider}`);
  if (error || !data?.url) return { error: error?.code ?? 'INTERNAL' };
  window.location.href = data.url;
  return { error: null };
}
