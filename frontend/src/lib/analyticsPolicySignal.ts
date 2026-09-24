/** Invalidation only: another tab must fetch its own authority from Core. */
export const ANALYTICS_POLICY_SIGNAL = 'lf.analytics-policy.changed.v1';
export function announceAnalyticsPolicyChange(): void {
  try { localStorage.setItem(ANALYTICS_POLICY_SIGNAL, crypto.randomUUID()); } catch { /* Focus refresh remains available without storage. */ }
}
