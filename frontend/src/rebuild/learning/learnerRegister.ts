import { z } from 'zod';
import type { AgeBand } from '../design/copyBudget';
import {
  LEARNER_REGISTERS, LEARNER_REGISTER_POLICY_VERSION, REGISTERS, registerForCopyBand,
  type LearnerRegister, type RegisterSpec,
} from '../design/learnerRegisterPolicy.generated';

/*
 * B.23 (S05.3f): the learner's age register, as Core resolved it.
 *
 *   GET  /learn/register             { register, copy_band, policy_version, graduation }
 *   POST /learn/register/graduation  { register }  (the learner saw the graduation)
 *
 * The rules themselves (tone, the Mentor's presence, reward framing, social
 * mechanics) come from the one register policy Core owns; this UI reads a
 * byte-identical generated copy. Core decides which register applies from its
 * own age evidence: the client never states an age or a band. A malformed
 * payload, or a policy version the UI does not know, is unavailable, and the
 * surfaces fall back to the youngest register (the most protective reading).
 * Transport is injected: this module imports nothing from the legacy app.
 */

const register = z.enum(LEARNER_REGISTERS as [LearnerRegister, ...LearnerRegister[]]);
const registerStatusSchema = z.object({
  register,
  copy_band: z.enum(['6-9', '10-12', '13-17', 'adult']),
  policy_version: z.literal(LEARNER_REGISTER_POLICY_VERSION),
  graduation: z.object({ from: register, to: z.enum(['transition', 'teen']) }).strict().nullable(),
}).strict().refine((value) => REGISTERS[value.register].copyBand === value.copy_band, 'band and register disagree');
export type RegisterStatus = z.infer<typeof registerStatusSchema>;

export interface RegisterTransport {
  (path: string, init?: { method: 'GET' | 'POST'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

async function call(request: RegisterTransport, path: string, init?: Parameters<RegisterTransport>[1]) {
  try {
    return await request(path, init);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

export type RegisterState = { status: 'loading' } | { status: 'ready'; value: RegisterStatus } | { status: 'error' };

export async function fetchLearnerRegister(request: RegisterTransport): Promise<RegisterState> {
  const response = await call(request, '/learn/register');
  if (response.error) return { status: 'error' };
  const parsed = registerStatusSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', value: parsed.data } : { status: 'error' };
}

/** True once Core recorded that the learner saw the graduation. */
export async function acknowledgeGraduation(request: RegisterTransport, into: 'transition' | 'teen'): Promise<boolean> {
  const response = await call(request, '/learn/register/graduation', { method: 'POST', body: { register: into } });
  return !response.error && z.object({ acknowledged: z.literal(true) }).passthrough().safeParse(response.data).success;
}

/** The register a surface reads in: Core's, or the youngest while it is unknown. */
export function registerOf(state: RegisterState): LearnerRegister {
  return state.status === 'ready' ? state.value.register : 'young';
}

export function specFor(value: LearnerRegister): RegisterSpec {
  return REGISTERS[value];
}

/** A lesson document's declared band read as a register (the lesson declares its audience). */
export function registerForBand(band: AgeBand): LearnerRegister {
  return registerForCopyBand(band);
}
