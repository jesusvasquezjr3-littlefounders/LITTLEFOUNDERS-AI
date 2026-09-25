import { z } from 'zod';
import { getConfig } from '../config.js';

const ActionSchema = z.enum(['remediate', 'practice', 'retrieve', 'continue']);
const StateSchema = z.object({
  skillKey: z.string().min(1).max(128),
  courseId: z.string().uuid().nullable(),
  topicId: z.string().uuid().nullable(),
  masteryProbability: z.number().min(0).max(1),
  uncertainty: z.number().min(0).max(1),
  evidenceCount: z.number().int().nonnegative(),
  firstPracticedAt: z.string().datetime().nullable(),
  lastPracticedAt: z.string().datetime().nullable(),
  reviewDueAt: z.string().datetime().nullable(),
  recommendedAction: ActionSchema,
  reasonCode: z.string().min(1).max(64),
});

const IntelligenceEnvelope = z.object({
  data: z.object({
    states: z.array(StateSchema),
  }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

export type LearnerIntelligence = z.infer<typeof StateSchema>;

/**
 * Reads only a learner's derived, explainable state from the internal
 * warehouse. The future Tutor gets a ready-made Core boundary and never needs
 * direct DuckDB access or raw behavioural history.
 */
export async function getOwnLearnerIntelligence(userId: string): Promise<LearnerIntelligence[] | null> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/learning/states/${encodeURIComponent(userId)}`, {
      headers: { 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
      signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
    });
    const parsed = IntelligenceEnvelope.safeParse(await res.json());
    if (!res.ok || !parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data.states;
  } catch {
    return null;
  }
}

const ExposureEnvelope = z.object({
  data: z.object({
    assignment: z.object({
      experimentId: z.string().uuid(),
      variant: z.enum(['A', 'B']),
      surface: z.enum(['learn', 'tasks', 'profile', 'tutor']),
      target: z.string().regex(/^[a-z0-9._-]{1,64}$/),
    }),
  }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

/** Records an actual, already-rendered product treatment for causal analysis. */
export async function recordExperimentExposure(input: {
  userId: string;
  experimentId: string;
  surface: 'learn' | 'tasks' | 'profile' | 'tutor';
  target: string;
  /** H.7: the learner's derived age, or null when the evidence is
   * unavailable — dataintel refuses bounded experiments for unknown ages. */
  age?: number | null;
}): Promise<{ experimentId: string; variant: 'A' | 'B' } | null> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/runtime/experiments/exposure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': DATAINTEL_INTERNAL_KEY,
      },
      body: JSON.stringify({ ...input, age: input.age ?? null }),
      signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
    });
    const parsed = ExposureEnvelope.safeParse(await res.json());
    if (!res.ok || !parsed.success || parsed.data.error || !parsed.data.data) return null;
    return {
      experimentId: parsed.data.data.assignment.experimentId,
      variant: parsed.data.data.assignment.variant,
    };
  } catch {
    return null;
  }
}

const AssignmentsEnvelope = z.object({
  data: z
    .object({
      assignments: z.array(
        z.object({
          experimentId: z.string().uuid(),
          variant: z.enum(['A', 'B']),
          surface: z.enum(['learn', 'tasks', 'profile', 'tutor']),
          target: z.string().regex(/^[a-z0-9._-]{1,64}$/),
        }),
      ),
    })
    .nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

/**
 * H.7 runtime assignments for one product surface and target (C.17: the
 * Mentor's dialogue-register experiment). Deterministic per learner; an
 * age-bounded experiment never assigns an unknown or out-of-range age. Null
 * when the runtime could not answer — never an empty list standing in for a
 * failure (§1.14).
 */
export async function getExperimentAssignments(input: {
  userId: string;
  surface: 'learn' | 'tasks' | 'profile' | 'tutor';
  target: string;
  age?: number | null;
}): Promise<{ experimentId: string; variant: 'A' | 'B' }[] | null> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/runtime/experiments/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
      body: JSON.stringify({ ...input, age: input.age ?? null }),
      signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
    });
    const parsed = AssignmentsEnvelope.safeParse(await res.json());
    if (!res.ok || !parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data.assignments
      .filter((a) => a.surface === input.surface && a.target === input.target)
      .map((a) => ({ experimentId: a.experimentId, variant: a.variant }));
  } catch {
    return null;
  }
}
