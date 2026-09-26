/** Preview and test fixture for the staff learning-quality panel. Synthetic lessons; no learner data. */
export function learningQualityFixture(): Record<string, unknown> {
  const at = '2026-09-24T12:00:00.000Z';
  return {
    window: { since: '2026-08-27T12:00:00.000Z', until: at, days: 28 },
    defaultBand: { lower_pct: 70, upper_pct: 85, min_sample: 30, rationale: 'Starting hypothesis from Product 10 B.19.', set_at: at, reviewDue: false },
    lessons: [
      { lesson_id: 'aaaaaaaa-0000-4000-8000-000000000001', lesson_slug: 'saving-first',
        lesson_title: { 'en-US': 'Saving first', 'es-MX': 'Ahorrar primero', 'pt-BR': 'Poupar primeiro' },
        first_attempts: 120, successes: 114, assisted: 3, success_pct: 95, lower_pct: 70, upper_pct: 85, min_sample: 30, band_scope: 'default', status: 'above_band',
        families: [{ family: 'legacy', first_attempts: 120, successes: 114 }] },
      { lesson_id: 'aaaaaaaa-0000-4000-8000-000000000002', lesson_slug: 'needs-and-wants',
        lesson_title: { 'en-US': 'Needs and wants', 'es-MX': 'Necesidades y deseos', 'pt-BR': 'Necessidades e desejos' },
        first_attempts: 80, successes: 62, assisted: 5, success_pct: 77.5, lower_pct: 70, upper_pct: 85, min_sample: 30, band_scope: 'default', status: 'in_band', families: null },
      { lesson_id: 'aaaaaaaa-0000-4000-8000-000000000003', lesson_slug: 'growth-over-time',
        lesson_title: { 'en-US': 'Growth over time', 'es-MX': 'Crecer con el tiempo', 'pt-BR': 'Crescer com o tempo' },
        first_attempts: 12, successes: 5, assisted: 1, success_pct: 41.7, lower_pct: 65, upper_pct: 80, min_sample: 30, band_scope: 'lesson', status: 'insufficient_sample', families: null },
    ],
    reviews: [{ id: 'bbbbbbbb-0000-4000-8000-000000000001', lesson_id: 'aaaaaaaa-0000-4000-8000-000000000001', direction: 'above_band', window_days: 28,
      evidence: { current: { success_pct: 95 }, previous: { success_pct: 93.3 } }, status: 'open', decision: null, decision_note: null, opened_at: at, resolved_at: null }],
    bandLog: [],
    judgment: [
      { lesson_id: 'aaaaaaaa-0000-4000-8000-000000000001', attempts: 40, correct_sound: 36, correct_not_sound: 1, incorrect_sound: 1, incorrect_not_sound: 2,
        divergent_share: 0.05, correlation: 0.8, status: 'tracks_correctness' },
      { lesson_id: 'aaaaaaaa-0000-4000-8000-000000000002', attempts: 44, correct_sound: 20, correct_not_sound: 8, incorrect_sound: 6, incorrect_not_sound: 10,
        divergent_share: 0.318, correlation: 0.31, status: 'distinct' },
    ],
    replayNotice: { below_best: 10, shown: 9, display_rate: 0.9, target: 1, belowTarget: true },
    thresholds: { judgmentDivergenceFloor: 0.1, judgmentMinAttempts: 30, replayNoticeTarget: 1, bandReviewCadenceDays: 90 },
    // S05.3e: rest-day utilization (B.21) and autonomy adoption (B.24).
    motivation: {
      restDays: { learners_with_lapse: 40, kept_by_rest_days: 31, restarted: 12, utilization_rate: 0.775, rest_days_used: 52 },
      autonomy: [
        { lever: 'path' as const, offered: 120, exercised: 34, adoption_rate: 0.2833 },
        { lever: 'pace' as const, offered: 80, exercised: 22, adoption_rate: 0.275 },
        { lever: 'mentor' as const, offered: 80, exercised: 51, adoption_rate: 0.6375 },
      ],
    },
  };
}
