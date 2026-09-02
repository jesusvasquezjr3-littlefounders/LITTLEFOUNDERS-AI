import { getConfig } from '../env.js';

/*
 * THE PLATFORM-WIDE SPEND CIRCUIT BREAKER (/ORACLE.md §15.2 item 1).
 *
 * Every cost control that existed before this one bounds a SINGLE session or
 * a single learner (the turn cap, the budget clocks, `MAX_SESSIONS_PER_DAY`
 * in Core). None of them notices that the PROCESS, across every session it is
 * currently holding, is spending an abnormal total — a provider incident that
 * makes retries pile up everywhere at once, or a bug that silently doubles a
 * call site, looks identical to ordinary load from inside any one session's
 * own ledger. This is the thing that watches the total instead.
 *
 * IN-PROCESS AND ROLLING, on purpose — and the reason is INDEPENDENCE, not
 * convenience. A shared store (Redis, Postgres) would couple this breaker to
 * infrastructure it exists to survive, and a circuit breaker that goes down
 * WITH the thing it is supposed to protect is worse than none at all (§1.14,
 * liveness must not depend on optional infrastructure — the same reasoning
 * extended to spend safety). A process restart forgets the running total; the
 * worst that allows is one extra window at full exposure on the day of a
 * deploy, which is a fair trade against a store outage silently disabling the
 * breaker.
 *
 * ── THIS CEILING IS PER REPLICA, AND THAT IS AN OPERATOR'S PROBLEM ──────────
 *
 * This comment used to justify itself with "Oracle is explicitly
 * single-replica today", alongside the nonce ledger and `parkedSessions`.
 * BOTH of those have since moved to shared state and Oracle no longer requires
 * one replica (/ORACLE.md §16, `RUNBOOK.md` Round 143) — so that premise is
 * gone, while the independence argument above survives it intact and is why
 * this one deliberately did NOT move with them.
 *
 * The consequence has to be said out loud rather than left to be discovered
 * on an invoice: at N replicas the effective daily ceiling is
 * `DAILY_SPEND_CEILING_USD * N`, because each process watches only its own
 * total. Scaling out therefore requires DIVIDING the configured ceiling by the
 * replica count, and it is the one cost control that does not scale itself.
 * The breaker still does its real job at any N — each instance stops its OWN
 * runaway multiplier, which is the shape of bug it was built for (§15.2 item
 * 1) — but the platform-wide dollar figure is only as true as that division.
 *
 * WHAT COUNTS: every real, already-incurred cost this process knows about —
 * the model call inside `TutorOrchestrator.produce()`, tier-3 live-generation
 * cost (`noteGenerationCost`), synthesized speech, and the post-session
 * review's own paid call (`session/review.ts`). All four record here at the
 * SAME moment they add to their own session's ledger, not at session close —
 * a session can run for up to `SESSION_HARD_BUDGET_MS`, and waiting for
 * `finish()`/`finalizeParked()` to flush would let a whole extra generation of
 * concurrent sessions start before the total ever caught up with what had
 * actually been spent.
 *
 * WHAT ADMISSION CONTROLS: nothing about who a caller is — only whether a
 * NEW session may open at all. Refusing at the socket, before a single call
 * is made on its behalf, is the only enforcement point that costs nothing to
 * apply: it does not interrupt a session already running (§1.0's "money
 * leaves in the owner's hours" applies equally to a support conversation
 * about a tutor that hung up on a child mid-sentence), and it turns away
 * exactly the load that would otherwise keep the total climbing.
 */

/** What a health check or a log line needs to describe the current state. */
export interface SpendSnapshot {
  spentUsd: number;
  ceilingUsd: number;
  /** Whether a NEW session may open right now. */
  admitting: boolean;
  /** When the current rolling window started (Unix ms). */
  windowStartedAtMs: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

class SpendGuard {
  private spentUsd = 0;
  private windowStartedAtMs = Date.now();
  /** So the alert fires once per window, not once per call site over threshold. */
  private alerted = false;

  /**
   * Adds a real, already-incurred cost to the running total.
   *
   * Never rejects and never throws: the money is spent whatever this function
   * does with the number (the same principle `session/review.ts`'s own cost
   * reporting already states), so recording it can only ever be additive.
   * `usd <= 0` is silently ignored rather than corrupting the ledger — the
   * four call sites already guard their own `estimateCostUsd`/
   * `estimateVoiceCostUsd` results, but a guard that trusts its callers to
   * have gotten that right everywhere, forever, is the same mistake §1.14
   * keeps naming under a different call site.
   */
  record(usd: number, now = Date.now()): void {
    this.rollWindowIfNeeded(now);
    if (!(usd > 0)) return;
    this.spentUsd += usd;
    this.maybeAlert();
  }

  /** Whether a new session may open right now, and the numbers behind that answer. */
  check(now = Date.now()): SpendSnapshot {
    this.rollWindowIfNeeded(now);
    return this.snapshotLocked();
  }

  /** Read-only view for `/health` and admin-facing logs — never mutates the alert latch. */
  snapshot(now = Date.now()): SpendSnapshot {
    this.rollWindowIfNeeded(now);
    return this.snapshotLocked();
  }

  private snapshotLocked(): SpendSnapshot {
    const ceilingUsd = getConfig().DAILY_SPEND_CEILING_USD;
    return {
      spentUsd: this.spentUsd,
      ceilingUsd,
      admitting: this.spentUsd < ceilingUsd,
      windowStartedAtMs: this.windowStartedAtMs,
    };
  }

  private rollWindowIfNeeded(now: number): void {
    if (now - this.windowStartedAtMs < WINDOW_MS) return;
    // Named on its way out, not just silently zeroed — this is the one place
    // a human can read "what did yesterday's window actually cost" without a
    // separate analytics pipeline.
    if (this.spentUsd > 0) {
      console.log(
        `[oracle] spend window closed: $${this.spentUsd.toFixed(4)} over the last 24h ` +
          `(ceiling was $${getConfig().DAILY_SPEND_CEILING_USD.toFixed(2)})`,
      );
    }
    this.spentUsd = 0;
    this.windowStartedAtMs = now;
    this.alerted = false;
  }

  private maybeAlert(): void {
    const config = getConfig();
    const alertAtUsd = config.DAILY_SPEND_CEILING_USD * config.DAILY_SPEND_ALERT_FRACTION;
    if (this.alerted || this.spentUsd < alertAtUsd) return;
    this.alerted = true;
    console.warn(
      `[oracle] platform spend at $${this.spentUsd.toFixed(4)} — ` +
        `${(config.DAILY_SPEND_ALERT_FRACTION * 100).toFixed(0)}% of today's $${config.DAILY_SPEND_CEILING_USD.toFixed(2)} ceiling. ` +
        `New sessions stop being admitted at $${config.DAILY_SPEND_CEILING_USD.toFixed(2)}.`,
    );
  }

  /** Test seam. */
  reset(now = Date.now()): void {
    this.spentUsd = 0;
    this.windowStartedAtMs = now;
    this.alerted = false;
  }
}

export const spendGuard = new SpendGuard();
