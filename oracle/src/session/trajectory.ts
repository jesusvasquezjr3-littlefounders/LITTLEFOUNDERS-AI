import { persistTutorTrajectory, type TrajectoryStepInput } from '../core/client.js';

/*
 * TRAJECTORY EMISSION — the V4 harness backlog's first slice (ROADMAP.md
 * "Remaining harness phases", /ORACLE.md §20).
 *
 * WHAT THIS IS. A durable, queryable record of what
 * `PedagogicalController.decide()` actually chose across a real session —
 * which strategy fired, on which mastery estimate, which skill delivered it,
 * which knowledge component it was about — so the Tutor's own pedagogy can
 * be studied OFFLINE. This is the sibling of `session/review.ts`: that organ
 * writes what a session taught US about the LEARNER; this one writes what it
 * taught us about the CONTROLLER.
 *
 * WHY THIS IS BACKSTAGE-ONLY, BY CONSTRUCTION. Governance (the harness doc's
 * own §15.1, quoted in ORACLE.md §20.1): "nothing autonomous reaches a
 * child." This module only ever WRITES a record of a decision that already
 * happened; it reads nothing back into a session, changes no turn, and adds
 * no field to the sealed model context (§4.1). There is no read path here at
 * all — a future consumer (a researcher's own query, a training pipeline)
 * reads the table Core owns directly, never through this service.
 *
 * WHY FIRE-AND-FORGET, AFTER THE SESSION ENDS, NOT DURING IT. The controller
 * decides on every ordinary turn, and a network call on that path is exactly
 * the class of mistake oracle/AGENTS.md §2.7 already exists to prevent — an
 * unbounded number of extra round trips on the one path where latency IS the
 * product. `TutorOrchestrator` accumulates each decision as a plain in-memory
 * push (`recordTrajectoryStep`, no I/O, microseconds) and this module flushes
 * the WHOLE batch in one call, from the exact same seam `runPostSessionReview`
 * already uses (`ws/server.ts`'s `finish()` and `finalizeParked()`). A session
 * whose controller never activated (no session plan; V4 dormant) accumulates
 * zero steps, and flushing zero steps is a no-op rather than an empty POST.
 *
 * NEVER THROWS, NEVER RETRIES. A lost trajectory batch costs the harness one
 * session's worth of offline analysis, never the session itself — the same
 * failure posture `addSessionCost`/`updateLearnerMemory` already have for the
 * identical reason.
 */

export async function emitTutorTrajectory(input: {
  sessionId: string;
  userId: string;
  steps: readonly TrajectoryStepInput[];
}): Promise<boolean> {
  // Nothing to record is not a failure — most of a session's turns are
  // conversational, and a session with the V4 brain dormant (no plan seeded)
  // never calls `decide()` at all.
  if (input.steps.length === 0) return true;
  const recorded = await persistTutorTrajectory(input);
  if (!recorded) {
    console.warn(
      `[oracle] trajectory batch for session ${input.sessionId} (${input.steps.length} step(s)) did not land — uncounted for offline pedagogy analysis`,
    );
  }
  return recorded;
}
