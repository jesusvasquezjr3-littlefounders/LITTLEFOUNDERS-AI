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
        // GAP-FIX-R5: the approach choice (10+) and optional enrichment (13+).
        { lever: 'approach' as const, offered: 60, exercised: 21, adoption_rate: 0.35 },
        { lever: 'enrichment' as const, offered: 30, exercised: 12, adoption_rate: 0.4 },
        { lever: 'pace' as const, offered: 80, exercised: 22, adoption_rate: 0.275 },
        { lever: 'mentor' as const, offered: 80, exercised: 51, adoption_rate: 0.6375 },
      ],
    },
    // GAP-FIX-R2 QA signals, with the gap-fix round 7 gate-effectiveness reviews (one overdue, one fresh).
    qaSignals: {
      scorerParity: { graded: 40, reported: 38, agreed: 38, agreement_share: 1, refusedButClientValid: 0, target: 1 },
      detectionByPhase: [], cueHits: { responses: 0, hits: 0, missed: 0, false_ticks: 0, diagnostic: true },
      variantTransfer: { rows: [], diagnostic: true }, cpaEntryStages: { rows: [], diagnostic: true },
      placementCommit: { ok: 9, failed: 1, successRate: 0.9, byMethod: { adaptive_quiz: 9 }, target: 1 },
      prerequisiteGate: { refused: 3, passed: 5, target: 1 }, forcedUpdate: { blocked: 0, target: 1 },
      defectEscapes: { escapes: 2, publishedVersions: 30, byGate: [{ gateId: 'forge.gate.12.tone', escapes: 1 }, { gateId: 'forge.release.locales-complete', escapes: 1 }], target: 0 },
      gateReviews: {
        open: [
          { reviewId: 'cccccccc-0000-4000-8000-000000000001', escapeId: 'eeeeeeee-0000-4000-8000-000000000001', lessonId: 'aaaaaaaa-0000-4000-8000-000000000001',
            gateId: 'forge.gate.12.tone', gateDescription: 'Gate 12: Law 2 tone', ownerRole: 'pedagogical_lead', defectKind: 'pedagogical',
            openedAt: '2026-06-10T12:00:00.000Z', ageDays: 106, overdue: true },
          { reviewId: 'cccccccc-0000-4000-8000-000000000002', escapeId: 'eeeeeeee-0000-4000-8000-000000000002', lessonId: 'aaaaaaaa-0000-4000-8000-000000000002',
            gateId: 'forge.release.locales-complete', gateDescription: 'Every release-ready lesson has all three locales', ownerRole: 'content_engineering', defectKind: 'copy',
            openedAt: '2026-09-20T12:00:00.000Z', ageDays: 4, overdue: false },
        ],
        overdue: 1, maxOpenDays: 90,
      },
      coverage: null,
    },
  };
}
