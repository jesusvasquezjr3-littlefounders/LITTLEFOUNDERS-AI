import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import { globeKey, readGlobePayload } from './globe.js';
import { readSurfacePayload, surfaceKey } from './surface.js';

type Segment = { payload: unknown };

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const review = (diagnostic: 'partial' | 'miss' | 'value' | 'false_alarm' | 'structure'): V2Grade => ({ verdict: 'review', diagnostic });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

/**
 * Both graded kinds answer one choice from a short list, so they share one ladder. invalid: malformed, a choice the question
 * does not list, or a rubric that is not the one clear answer. valid: nothing chosen yet, and every well-formed response
 * when there is no rubric. met: the key. review: any other listed choice (the value was read wrongly).
 */
function choiceGrade(ids: readonly string[], key: string | null, response: unknown, rubric: unknown): V2Grade {
  if (!isRecord(response) || !hasKeys(response, ['choice'])) return INVALID;
  const { choice } = response;
  if (typeof choice !== 'string' || (choice !== '' && !ids.includes(choice))) return INVALID;
  if (rubric === undefined) return VALID;
  if (key === null || !isRecord(rubric) || !hasKeys(rubric, ['choice']) || rubric.choice !== key) return INVALID;
  if (choice === '') return VALID;
  return choice === key ? MET : review('value');
}

function surfaceGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const payload = readSurfacePayload(segment?.payload);
  if (!payload) return INVALID;
  return choiceGrade(payload.options.map((option) => option.id), surfaceKey(payload), response, rubric);
}

function globeGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const payload = readGlobePayload(segment?.payload);
  if (!payload) return INVALID;
  return choiceGrade(payload.routes.map((route) => route.id), globeKey(payload), response, rubric);
}

const BLANK = (() => ({ choice: '' })) as HorizonteScorer['sample'];

/** The AR step is not scored, so it has no scorer here: Core keys and grades only `grading: server` segments. */
export const SPACE2_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.surface.v2': { grade: surfaceGrade as HorizonteScorer['grade'], sample: BLANK },
  'geography.globe-route.v2': { grade: globeGrade as HorizonteScorer['grade'], sample: BLANK },
};
