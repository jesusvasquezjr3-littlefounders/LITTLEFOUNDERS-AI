import { query } from '../db/duckdb.js';
import {
  lessonDropoffQuery,
  segmentCalibrationQuery,
} from '../db/queries.js';

export interface DropoffEntry {
  lesson_id: string;
  lesson_slug: string;
  title_en: string;
  starts: number;
  completions: number;
  abandon_rate: number;
  avg_seconds_before_abandon: number;
}

export interface CalibrationEntry {
  lesson_id: string;
  lesson_slug: string;
  segment_id: string;
  attempts: number;
  learners: number;
  avg_score: number;
  avg_attempts_per_learner: number;
  hint_rate: number;
  first_try_avg_score: number;
}

interface DropoffRow {
  slug: string;
  title_en: string;
  starts: number;
  completes: number;
  dropoff_pct: number | null;
  dropped_users: number;
}

interface CalibrationRow {
  lesson_slug: string;
  lesson_title: string;
  segment_id: string;
  learners: number;
  attempts: number;
  avg_score: number;
  success_rate: number;
  calibration: string;
}

export async function getLessonDropoff(
  limit: number,
): Promise<DropoffEntry[] | null> {
  try {
    const { sql, params } = lessonDropoffQuery(limit);
    const rows = await query<DropoffRow>(sql, ...params);

    return rows.map((r) => ({
      lesson_id: r.slug,
      lesson_slug: r.slug,
      title_en: r.title_en,
      starts: Number(r.starts),
      completions: Number(r.completes),
      abandon_rate: r.dropoff_pct !== null ? Number(r.dropoff_pct) : 0,
      avg_seconds_before_abandon: 0,
    }));
  } catch (err) {
    console.error('[dataintel][lessons] getLessonDropoff failed:', err);
    return null;
  }
}

export async function getSegmentCalibration(
  minLearners: number,
  limit: number,
): Promise<CalibrationEntry[] | null> {
  try {
    const { sql, params } = segmentCalibrationQuery(minLearners, limit);
    const rows = await query<CalibrationRow>(sql, ...params);

    return rows.map((r) => ({
      lesson_id: r.lesson_slug,
      lesson_slug: r.lesson_slug,
      segment_id: r.segment_id,
      attempts: Number(r.attempts),
      learners: Number(r.learners),
      avg_score: Number(r.avg_score),
      avg_attempts_per_learner:
        Number(r.learners) > 0
          ? Math.round((Number(r.attempts) / Number(r.learners)) * 100) / 100
          : 0,
      hint_rate: 0,
      first_try_avg_score: 0,
    }));
  } catch (err) {
    console.error('[dataintel][lessons] getSegmentCalibration failed:', err);
    return null;
  }
}
