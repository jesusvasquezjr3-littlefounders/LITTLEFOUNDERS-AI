import { query } from '../db/duckdb.js';
import {
  lessonDropoffQuery,
  segmentCalibrationQuery,
  type AnalyticsWindow,
} from '../db/queries.js';

export interface DropoffEntry {
  lesson_id: string;
  lesson_slug: string;
  title_en: string;
  starts: number;
  completions: number;
  abandon_rate: number;
  avg_seconds_before_abandon: number | null;
}

export interface CalibrationEntry {
  lesson_id: string;
  lesson_slug: string;
  segment_id: string;
  attempts: number;
  learners: number;
  avg_score: number;
  avg_attempts_per_learner: number;
  hint_rate: number | null;
  first_try_avg_score: number | null;
  calibration: 'mastery' | 'proficient' | 'developing' | 'needs_revision';
}

interface DropoffRow {
  lesson_id: string;
  slug: string;
  title_en: string;
  starts: number;
  abandons: number;
  completes: number;
  dropoff_pct: number | null;
  avg_seconds_before_abandon: number | null;
}

interface CalibrationRow {
  lesson_id: string;
  lesson_slug: string;
  lesson_title: string;
  segment_id: string;
  learners: number;
  attempts: number;
  avg_score: number;
  avg_attempts_per_learner: number;
  hint_rate: number | null;
  first_try_avg_score: number | null;
  calibration: CalibrationEntry['calibration'];
}

export async function getLessonDropoff(
  limit: number,
  window: AnalyticsWindow,
): Promise<DropoffEntry[] | null> {
  try {
    const { sql, params } = lessonDropoffQuery(limit, window);
    const rows = await query<DropoffRow>(sql, ...params);

    return rows.map((r) => ({
      lesson_id: r.lesson_id,
      lesson_slug: r.slug,
      title_en: r.title_en,
      starts: Number(r.starts),
      completions: Number(r.completes),
      abandon_rate: r.dropoff_pct !== null ? Number(r.dropoff_pct) : 0,
      avg_seconds_before_abandon: r.avg_seconds_before_abandon !== null ? Number(r.avg_seconds_before_abandon) : null,
    }));
  } catch (err) {
    console.error('[dataintel][lessons] getLessonDropoff failed:', err);
    return null;
  }
}

export async function getSegmentCalibration(
  minLearners: number,
  limit: number,
  window: AnalyticsWindow,
): Promise<CalibrationEntry[] | null> {
  try {
    const { sql, params } = segmentCalibrationQuery(minLearners, limit, window);
    const rows = await query<CalibrationRow>(sql, ...params);

    return rows.map((r) => ({
      lesson_id: r.lesson_id,
      lesson_slug: r.lesson_slug,
      segment_id: r.segment_id,
      attempts: Number(r.attempts),
      learners: Number(r.learners),
      avg_score: Number(r.avg_score),
      avg_attempts_per_learner: Number(r.avg_attempts_per_learner),
      hint_rate: r.hint_rate !== null ? Number(r.hint_rate) : null,
      first_try_avg_score: r.first_try_avg_score !== null ? Number(r.first_try_avg_score) : null,
      calibration: r.calibration,
    }));
  } catch (err) {
    console.error('[dataintel][lessons] getSegmentCalibration failed:', err);
    return null;
  }
}
