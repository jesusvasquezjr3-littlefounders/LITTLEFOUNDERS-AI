import { app } from './helpers.mjs';

/*
 * Lane 5 (profile): profile, social, settings and the account.
 */
export const lane = 'profile';

export const states = [
  // A panel embedded in a legacy page: per-string budgets, text fit and tap gaps apply; the one-screen
  // rules (one h1, heading ratio, type-size count, first-view total) belong to the page around it.
  // Every rebuilt root on the page is measured: the analytics choice (S01) and the Mentor-memory self-review (OD-18).
  app('/profile/settings@teen', '/profile/settings', 'settings-teen', '.lf-analytics-choice [role="switch"]', {
    firstView: false, catalogue: true, embedded: true, readyAlso: '.lf-memory-self-review .lf-memory-note' }),
];

export const scenarios = {
  'settings-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17' },
};

const MEMORY_NOTE = { 'en-US': 'Saving for a bike.', 'es-MX': 'Ahorra para una bici.', 'pt-BR': 'Poupa para uma bicicleta.' };

export function respond({ locale, path, request, ok }) {
  // The teen's own Mentor-memory review queue (OD-18): one proposed note, so the rebuilt panel shows a real item.
  if (path === '/tutor/memory-proposals' && request.method === 'GET') return ok({
    proposals: [{ id: '55555555-5555-4555-8555-555555555555', proposed: MEMORY_NOTE[locale], expectedBefore: null, sessionId: null, createdAt: '2026-09-20T10:00:00Z' }],
    current: null,
  });
  return undefined;
}
