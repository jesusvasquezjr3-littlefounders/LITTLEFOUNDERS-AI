import { query, execute } from '../db/duckdb.js';
import { getConfig } from '../env.js';
import crypto from 'crypto';
import { alertEmailBody } from './alertEmail.js';

export interface Alert {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'change_pct';
  threshold: number;
  channel: 'webhook' | 'email';
  cooldownMinutes: number;
  status: 'active' | 'paused';
  lastTriggeredAt?: string;
  createdAt: string;
  /**
   * H.3: the outcome of the latest trigger's delivery, so staff see an alert
   * that fired and notified nobody. `null` when the alert never fired, or the
   * latest trigger is still in flight or predates delivery tracking.
   */
  lastDeliveryStatus?: AlertDeliveryStatus | null;
  lastDeliveryError?: string | null;
}

export type AlertChannel = Alert['channel'];

/**
 * Appendix O 1.3 (Alert-to-Notification Delivery Rate): every trigger in the
 * window against the ones that reached a human. `pending` counts triggers
 * with no recorded outcome (in flight, or recorded before delivery was
 * tracked). `rate` is delivered / triggered, `null` when nothing fired.
 * Target: 100% (an alert that fires but notifies nobody counts as no alert).
 */
export interface AlertDeliveryRate {
  days: number;
  triggered: number;
  delivered: number;
  failed: number;
  unconfigured: number;
  pending: number;
  rate: number | null;
  target: 1;
}

/**
 * H.3 / Appendix O 1.3 (Alert-to-Notification Delivery Rate): the final
 * outcome of a trigger's delivery, after its bounded retries (each attempt is
 * its own row in alert_delivery_attempts). `null` only while delivery is in
 * flight, or for a trigger recorded before delivery was tracked.
 */
export type AlertDeliveryStatus = 'delivered' | 'failed' | 'unconfigured';

export interface AlertDelivery {
  status: AlertDeliveryStatus;
  channel: 'webhook' | 'email';
  /** Short reason, never a payload or a secret (an HTTP status or an error class). */
  error: string | null;
  /** Sends made (0 for an unconfigured channel, which is never attempted). */
  attempts: number;
}

/**
 * H.3 (GAP-FIX-R6): a failed send is retried a bounded number of times and
 * every attempt is recorded. A network error, a timeout, 408, 425, 429 and any
 * 5xx are worth another try; any other 4xx is the receiver refusing the
 * payload and is not retried. `delaysMs[i]` is the wait before attempt i + 2.
 */
export const ALERT_DELIVERY_ATTEMPTS = 3;
export const alertRetry: { delaysMs: number[] } = { delaysMs: [2_000, 8_000] };

/**
 * H.3 (GAP-FIX-R6): a trigger whose delivery reached nobody. `unrecorded` is a
 * trigger with no outcome well after its send window (the process stopped
 * mid-delivery): nobody was told about it either.
 */
export type UndeliveredStatus = 'failed' | 'unconfigured' | 'unrecorded';
export interface UndeliveredAlert {
  alertId: string;
  name: string | null;
  channel: string | null;
  triggeredAt: string;
  status: UndeliveredStatus;
  error: string | null;
  attempts: number | null;
}
export interface UndeliveredAlerts { hours: number; count: number; alerts: UndeliveredAlert[] }
/** The most rows an undelivered read lists; `count` is always the full number. */
export const UNDELIVERED_LIST_LIMIT = 50;

export interface AlertHistory {
  alertId: string;
  triggeredAt: string;
  metric: string;
  value: number;
  threshold: number;
  condition: string;
  deliveryStatus: AlertDeliveryStatus | null;
  deliveryChannel: string | null;
  deliveredAt: string | null;
  deliveryError: string | null;
  deliveryAttempts: number | null;
}

type StoredAlert = {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  channel: string;
  cooldown_minutes: number;
  status: string;
  last_triggered_at: string | null;
  created_at: string;
};

type StoredAlertWithDelivery = StoredAlert & {
  last_delivery_status?: string | null;
  last_delivery_error?: string | null;
};

type DeliveryCountRow = {
  triggered: number | bigint;
  delivered: number | bigint;
  failed: number | bigint;
  unconfigured: number | bigint;
};

type StoredHistory = {
  alert_id: string;
  triggered_at: string;
  metric: string;
  value: number;
  threshold: number;
  condition: string;
  delivery_status?: string | null;
  delivery_channel?: string | null;
  delivered_at?: string | null;
  delivery_error?: string | null;
  delivery_attempts?: number | bigint | null;
};

type StoredUndelivered = {
  alert_id: string;
  name: string | null;
  channel: string | null;
  triggered_at: string;
  delivery_status: string | null;
  delivery_error: string | null;
  delivery_attempts: number | bigint | null;
};

type MetricValueRow = {
  metric_value: number;
};

type ChangePctRow = {
  current: number;
  previous: number;
};

const ENSURE_ALERTS = `\
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold DOUBLE NOT NULL,
  channel TEXT NOT NULL,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active',
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const ENSURE_HISTORY = `\
CREATE TABLE IF NOT EXISTS alert_history (
  alert_id TEXT NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metric TEXT NOT NULL,
  value DOUBLE NOT NULL,
  threshold DOUBLE NOT NULL,
  condition TEXT NOT NULL,
  delivery_status TEXT,
  delivery_channel TEXT,
  delivered_at TIMESTAMP,
  delivery_error TEXT,
  delivery_attempts INTEGER
)`;

/** H.3 (GAP-FIX-R6): one row per send, so a retried delivery shows each try. */
const ENSURE_ATTEMPTS = `\
CREATE TABLE IF NOT EXISTS alert_delivery_attempts (
  alert_id TEXT NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  attempt INTEGER NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/**
 * Creates alert_history, and gives a file created before delivery tracking
 * its delivery columns (DuckDB adds only nullable columns to an existing table).
 */
async function ensureHistorySchema(): Promise<void> {
  await execute(ENSURE_HISTORY);
  await execute('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivery_status TEXT');
  await execute('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivery_channel TEXT');
  await execute('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP');
  await execute('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivery_error TEXT');
  await execute('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER');
  await execute(ENSURE_ATTEMPTS);
}

const DELIVERY_STATUSES: readonly string[] = ['delivered', 'failed', 'unconfigured'];

const VALID_METRIC = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function id(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function deliveryStatusOf(value: string | null | undefined): AlertDeliveryStatus | null {
  return value && DELIVERY_STATUSES.includes(value) ? value as AlertDeliveryStatus : null;
}

function rowToAlert(r: StoredAlert): Alert {
  return {
    id: r.id,
    name: r.name,
    metric: r.metric,
    condition: r.condition as 'above' | 'below' | 'change_pct',
    threshold: Number(r.threshold),
    channel: r.channel as 'webhook' | 'email',
    cooldownMinutes: Number(r.cooldown_minutes),
    status: r.status as 'active' | 'paused',
    lastTriggeredAt: r.last_triggered_at ?? undefined,
    createdAt: r.created_at,
  };
}

/**
 * H.3 (GAP-FIX-R6): the channels this deployment can deliver through. An alert
 * may only be created, or made active, on one of them: an alert that can only
 * ever record `unconfigured` is the un-completable object Block H forbids.
 */
export function configuredChannels(): Record<AlertChannel, boolean> {
  const { ALERT_WEBHOOK_URL, ALERT_EMAIL_SERVER_URL, ALERT_EMAIL_INTERNAL_KEY, ALERT_EMAIL_TO } = getConfig();
  return { webhook: !!ALERT_WEBHOOK_URL, email: !!(ALERT_EMAIL_SERVER_URL && ALERT_EMAIL_INTERNAL_KEY && ALERT_EMAIL_TO) };
}

export function isChannelConfigured(channel: string): boolean {
  const channels = configuredChannels();
  return channel === 'webhook' || channel === 'email' ? channels[channel] : false;
}

/** One alert, `null` when there is none, `undefined` when the read failed. */
export async function getAlert(alertId: string): Promise<Alert | null | undefined> {
  try {
    await execute(ENSURE_ALERTS);
    const rows = await query<StoredAlert>('SELECT * FROM alerts WHERE id = ?', alertId);
    return rows[0] ? rowToAlert(rows[0]) : null;
  } catch (err) {
    console.error('[dataintel][alerts] get failed:', err);
    return undefined;
  }
}

export async function createAlert(
  def: Omit<Alert, 'id' | 'status' | 'createdAt'>,
): Promise<Alert | null> {
  try {
    await execute(ENSURE_ALERTS);

    const alertId = id();
    const createdAt = now();

    await execute(
      `INSERT INTO alerts (id, name, metric, condition, threshold, channel, cooldown_minutes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      alertId,
      def.name,
      def.metric,
      def.condition,
      def.threshold,
      def.channel,
      def.cooldownMinutes,
      createdAt,
    );

    return {
      id: alertId,
      name: def.name,
      metric: def.metric,
      condition: def.condition,
      threshold: def.threshold,
      channel: def.channel,
      cooldownMinutes: def.cooldownMinutes,
      status: 'active',
      createdAt,
    };
  } catch (err) {
    console.error('[dataintel][alerts] create failed:', err);
    return null;
  }
}

export async function listAlerts(): Promise<Alert[] | null> {
  try {
    await execute(ENSURE_ALERTS);

    await ensureHistorySchema();

    // H.3: each alert with the delivery outcome of its latest trigger.
    const rows = await query<StoredAlertWithDelivery>(
      `SELECT a.*, h.delivery_status AS last_delivery_status, h.delivery_error AS last_delivery_error
       FROM alerts a
       LEFT JOIN (
         SELECT alert_id, delivery_status, delivery_error,
                ROW_NUMBER() OVER (PARTITION BY alert_id ORDER BY triggered_at DESC) AS rn
         FROM alert_history
       ) h ON h.alert_id = a.id AND h.rn = 1
       ORDER BY a.created_at DESC`,
    );

    return rows.map((r) => ({
      ...rowToAlert(r),
      lastDeliveryStatus: deliveryStatusOf(r.last_delivery_status),
      lastDeliveryError: r.last_delivery_error ?? null,
    }));
  } catch (err) {
    console.error('[dataintel][alerts] list failed:', err);
    return null;
  }
}

export async function updateAlertStatus(
  id: string,
  status: 'active' | 'paused',
): Promise<boolean> {
  try {
    await execute(ENSURE_ALERTS);

    await execute('UPDATE alerts SET status = ? WHERE id = ?', status, id);

    return true;
  } catch (err) {
    console.error('[dataintel][alerts] updateStatus failed:', err);
    return false;
  }
}

export async function deleteAlert(id: string): Promise<boolean> {
  try {
    await execute(ENSURE_ALERTS);

    await execute('DELETE FROM alerts WHERE id = ?', id);

    return true;
  } catch (err) {
    console.error('[dataintel][alerts] delete failed:', err);
    return false;
  }
}

export async function getAlertHistory(
  alertId: string,
  limit: number,
): Promise<AlertHistory[] | null> {
  try {
    await ensureHistorySchema();

    const rows = await query<StoredHistory>(
      'SELECT * FROM alert_history WHERE alert_id = ? ORDER BY triggered_at DESC LIMIT ?',
      alertId,
      limit,
    );

    return rows.map((r) => ({
      alertId: r.alert_id,
      triggeredAt: r.triggered_at,
      metric: r.metric,
      value: Number(r.value),
      threshold: Number(r.threshold),
      condition: r.condition,
      deliveryStatus: deliveryStatusOf(r.delivery_status),
      deliveryChannel: r.delivery_channel ?? null,
      deliveredAt: r.delivered_at ? String(r.delivered_at) : null,
      deliveryError: r.delivery_error ?? null,
      deliveryAttempts: r.delivery_attempts === null || r.delivery_attempts === undefined ? null : Number(r.delivery_attempts),
    }));
  } catch (err) {
    console.error('[dataintel][alerts] getHistory failed:', err);
    return null;
  }
}

/**
 * Appendix O 1.3: the delivery rate of every trigger in the last `days`
 * (1-365). A read failure answers null, never zeros.
 */
export async function alertDeliveryRate(days: number): Promise<AlertDeliveryRate | null> {
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;
  try {
    await ensureHistorySchema();
    const rows = await query<DeliveryCountRow>(
      `SELECT COUNT(*) AS triggered,
              COUNT(*) FILTER (WHERE delivery_status = 'delivered') AS delivered,
              COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed,
              COUNT(*) FILTER (WHERE delivery_status = 'unconfigured') AS unconfigured
       FROM alert_history
       WHERE triggered_at >= CURRENT_TIMESTAMP - to_days(CAST(? AS INTEGER))`,
      days,
    );
    const row = rows[0];
    if (!row) return null;
    const triggered = Number(row.triggered);
    const delivered = Number(row.delivered);
    const failed = Number(row.failed);
    const unconfigured = Number(row.unconfigured);
    return {
      days,
      triggered,
      delivered,
      failed,
      unconfigured,
      pending: Math.max(0, triggered - delivered - failed - unconfigured),
      rate: triggered === 0 ? null : delivered / triggered,
      target: 1,
    };
  } catch (err) {
    console.error('[dataintel][alerts] deliveryRate failed:', err);
    return null;
  }
}

/**
 * H.3 (GAP-FIX-R6): every trigger in the last `hours` (1-168) that notified
 * nobody: delivery failed after its retries, the channel is not configured,
 * or no outcome was recorded 15 minutes after the trigger. Core's
 * GET /internal/ops/job-status carries the count as `alerts.undelivered`, and
 * ops-job-watch fails and names them on the ops-watchdog issue, the
 * escalation channel. A read failure answers null, never zero.
 */
export async function undeliveredAlerts(hours: number): Promise<UndeliveredAlerts | null> {
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) return null;
  const where = `h.triggered_at >= CURRENT_TIMESTAMP - to_hours(CAST(? AS INTEGER))
       AND (h.delivery_status IN ('failed', 'unconfigured')
            OR (h.delivery_status IS NULL AND h.triggered_at < CURRENT_TIMESTAMP - INTERVAL 15 MINUTE))`;
  try {
    await execute(ENSURE_ALERTS);
    await ensureHistorySchema();
    const counted = await query<{ total: number | bigint }>(`SELECT COUNT(*) AS total FROM alert_history h WHERE ${where}`, hours);
    const rows = await query<StoredUndelivered>(
      `SELECT h.alert_id, a.name, COALESCE(h.delivery_channel, a.channel) AS channel, h.triggered_at,
              h.delivery_status, h.delivery_error, h.delivery_attempts
       FROM alert_history h LEFT JOIN alerts a ON a.id = h.alert_id
       WHERE ${where}
       ORDER BY h.triggered_at DESC
       LIMIT ${UNDELIVERED_LIST_LIMIT}`,
      hours,
    );
    return {
      hours,
      count: Number(counted[0]?.total ?? 0),
      alerts: rows.map((r) => ({
        alertId: r.alert_id,
        name: r.name ?? null,
        channel: r.channel ?? null,
        triggeredAt: String(r.triggered_at),
        status: r.delivery_status === 'failed' || r.delivery_status === 'unconfigured' ? r.delivery_status : 'unrecorded',
        error: r.delivery_error ?? null,
        attempts: r.delivery_attempts === null || r.delivery_attempts === undefined ? null : Number(r.delivery_attempts),
      })),
    };
  } catch (err) {
    console.error('[dataintel][alerts] undelivered read failed:', err);
    return null;
  }
}

export async function evaluateAlerts(): Promise<{ triggered: number }> {
  let triggered = 0;

  try {
    await execute(ENSURE_ALERTS);
    await ensureHistorySchema();

    const rows = await query<StoredAlert>(
      "SELECT * FROM alerts WHERE status = 'active'",
    );

    for (const alert of rows) {
      const alertObj = rowToAlert(alert);

      const canTrigger = await checkCooldown(
        alertObj.id,
        alertObj.cooldownMinutes,
      );
      if (!canTrigger) continue;

      const currentValue = await getCurrentMetricValue(alertObj.metric);

      if (currentValue === null) continue;

      let shouldTrigger = false;

      switch (alertObj.condition) {
        case 'above':
          shouldTrigger = currentValue > alertObj.threshold;
          break;
        case 'below':
          shouldTrigger = currentValue < alertObj.threshold;
          break;
        case 'change_pct': {
          const changePct = await getMetricChangePct(alertObj.metric);
          if (changePct !== null) {
            shouldTrigger = Math.abs(changePct) > alertObj.threshold;
          }
          break;
        }
      }

      if (shouldTrigger) {
        const triggeredAt = now();

        await execute(
          `INSERT INTO alert_history (alert_id, triggered_at, metric, value, threshold, condition)
           VALUES (?, ?, ?, ?, ?, ?)`,
          alertObj.id,
          triggeredAt,
          alertObj.metric,
          currentValue,
          alertObj.threshold,
          alertObj.condition,
        );

        await execute(
          'UPDATE alerts SET last_triggered_at = ? WHERE id = ?',
          triggeredAt,
          alertObj.id,
        );

        // H.3: a recorded trigger with no consumer is not alerting. Deliver
        // through the alert's configured channel, retrying a failed send a
        // bounded number of times; the trigger row is already durable and its
        // final outcome is written back to it (Appendix O 1.3). A trigger that
        // still reached nobody surfaces in undeliveredAlerts() and fails the
        // operations watchdog.
        const delivery = await deliverAlert(alertObj, { value: currentValue, triggeredAt });
        await recordDelivery(alertObj.id, triggeredAt, delivery);

        triggered++;
      }
    }
  } catch (err) {
    console.error('[dataintel][alerts] evaluate failed:', err);
  }

  return { triggered };
}

/** Writes a delivery outcome back to its trigger row. A failed write is logged, never thrown. */
async function recordDelivery(alertId: string, triggeredAt: string, delivery: AlertDelivery): Promise<void> {
  try {
    await execute(
      `UPDATE alert_history SET delivery_status = ?, delivery_channel = ?, delivered_at = ?, delivery_error = ?, delivery_attempts = ?
       WHERE alert_id = ? AND triggered_at = ?`,
      delivery.status,
      delivery.channel,
      delivery.status === 'delivered' ? now() : null,
      delivery.error,
      delivery.attempts,
      alertId,
      triggeredAt,
    );
  } catch (err) {
    console.error('[dataintel][alerts] recording the delivery outcome failed:', err);
  }
}

type SendOutcome = { delivered: boolean; error: string | null; retryable: boolean };

/** Records one send. A failed write is logged, never thrown: the send already happened. */
async function recordAttempt(alertId: string, triggeredAt: string, attempt: number, channel: AlertChannel, outcome: SendOutcome): Promise<void> {
  try {
    await execute(
      `INSERT INTO alert_delivery_attempts (alert_id, triggered_at, attempt, channel, status, error, attempted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      alertId,
      triggeredAt,
      attempt,
      channel,
      outcome.delivered ? 'delivered' : 'failed',
      outcome.error,
      now(),
    );
  } catch (err) {
    console.error('[dataintel][alerts] recording a delivery attempt failed:', err);
  }
}

const retryableStatus = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;
const reasonOf = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : 'Error').slice(0, 200);
const sleep = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/** One bounded send: delivered, or failed with a short reason and whether another try could help. */
async function send(url: string, init: RequestInit): Promise<SendOutcome> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { delivered: true, error: null, retryable: false };
    return { delivered: false, error: `HTTP ${res.status}`, retryable: retryableStatus(res.status) };
  } catch (err) {
    return { delivered: false, error: reasonOf(err), retryable: true };
  }
}

/**
 * H.3's notification channel. `webhook` alerts POST the trigger payload to
 * the configured URL; `email` alerts POST a plain-text internal email through
 * the email-server's `/api/v1/send`, in the body that endpoint accepts
 * (alertEmail.ts, contract-tested against the email-server's own route).
 * Each send is bounded by a timeout so a hanging channel cannot stall the
 * evaluation loop; a failed send is retried up to ALERT_DELIVERY_ATTEMPTS
 * times (alertRetry), each attempt recorded in alert_delivery_attempts. The
 * outcome is delivered, failed (with a short reason) or unconfigured (no
 * human could be notified). The trigger row is written BEFORE delivery, so a
 * failed delivery is a visible gap, not a lost alert.
 */
async function deliverAlert(
  alert: Alert,
  trigger: { value: number; triggeredAt: string },
): Promise<AlertDelivery> {
  const { ALERT_WEBHOOK_URL, ALERT_EMAIL_SERVER_URL, ALERT_EMAIL_INTERNAL_KEY, ALERT_EMAIL_TO } = getConfig();
  const channel = alert.channel;
  let target: { url: string; init: RequestInit } | null = null;
  if (channel === 'webhook' && ALERT_WEBHOOK_URL) {
    target = {
      url: ALERT_WEBHOOK_URL,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          name: alert.name,
          metric: alert.metric,
          condition: alert.condition,
          threshold: alert.threshold,
          value: trigger.value,
          triggeredAt: trigger.triggeredAt,
        }),
      },
    };
  } else if (channel === 'email' && ALERT_EMAIL_SERVER_URL && ALERT_EMAIL_INTERNAL_KEY && ALERT_EMAIL_TO) {
    target = {
      url: `${ALERT_EMAIL_SERVER_URL}/api/v1/send`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': ALERT_EMAIL_INTERNAL_KEY,
        },
        body: JSON.stringify(alertEmailBody(ALERT_EMAIL_TO, {
          name: alert.name,
          metric: alert.metric,
          condition: alert.condition,
          threshold: alert.threshold,
          value: trigger.value,
          triggeredAt: trigger.triggeredAt,
        })),
      },
    };
  }
  if (!target) {
    const setting = channel === 'webhook' ? 'ALERT_WEBHOOK_URL is' : 'the email channel is';
    console.warn(`[dataintel][alerts] alert "${alert.name}" triggered but ${setting} not configured — no human was notified`);
    return { status: 'unconfigured', channel, error: null, attempts: 0 };
  }
  let last: SendOutcome = { delivered: false, error: null, retryable: true };
  let attempts = 0;
  for (let attempt = 1; attempt <= ALERT_DELIVERY_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(alertRetry.delaysMs[attempt - 2] ?? 0);
    last = await send(target.url, target.init);
    attempts = attempt;
    await recordAttempt(alert.id, trigger.triggeredAt, attempt, channel, last);
    if (last.delivered) return { status: 'delivered', channel, error: null, attempts };
    if (!last.retryable) break;
  }
  console.error(`[dataintel][alerts] ${channel} delivery failed for "${alert.name}" after ${attempts} attempt(s): ${last.error}`);
  return { status: 'failed', channel, error: last.error, attempts };
}

async function checkCooldown(
  alertId: string,
  cooldownMinutes: number,
): Promise<boolean> {
  try {
    const rows = await query<{ last_triggered_at: string | null }>(
      'SELECT last_triggered_at FROM alerts WHERE id = ?',
      alertId,
    );

    if (rows.length === 0) return true;

    const lastTriggered = rows[0]!.last_triggered_at;

    if (!lastTriggered) return true;

    const elapsed =
      (Date.now() - new Date(lastTriggered).getTime()) / (60 * 1000);

    return elapsed >= cooldownMinutes;
  } catch (err) {
    console.error('[dataintel][alerts] checkCooldown failed:', err);
    return true;
  }
}

async function getCurrentMetricValue(
  metric: string,
): Promise<number | null> {
  try {
    if (!VALID_METRIC.test(metric)) {
      return null;
    }

    let aggExpression: string;
    switch (metric) {
      case 'dau':
      case 'users':
        aggExpression = 'COUNT(DISTINCT user_id)';
        break;
      case 'sessions':
        aggExpression = 'COUNT(DISTINCT session_id)';
        break;
      case 'events':
      default:
        aggExpression = 'COUNT(*)';
        break;
    }

    const rows = await query<MetricValueRow>(
      `SELECT ${aggExpression} AS metric_value FROM fact_events WHERE created_at >= CURRENT_DATE - INTERVAL '5' MINUTE`,
    );

    if (rows.length === 0) return null;

    return Number(rows[0]!.metric_value);
  } catch (err) {
    console.error('[dataintel][alerts] getCurrentMetricValue failed:', err);
    return null;
  }
}

async function getMetricChangePct(
  metric: string,
): Promise<number | null> {
  try {
    if (!VALID_METRIC.test(metric)) {
      return null;
    }

    let aggExpression: string;
    switch (metric) {
      case 'dau':
      case 'users':
        aggExpression = 'COUNT(DISTINCT user_id)';
        break;
      case 'sessions':
        aggExpression = 'COUNT(DISTINCT session_id)';
        break;
      case 'events':
      default:
        aggExpression = 'COUNT(*)';
        break;
    }

    const rows = await query<ChangePctRow>(
      `SELECT
         ${aggExpression} FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR) AS current,
         ${aggExpression} FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '2' HOUR AND created_at < CURRENT_TIMESTAMP - INTERVAL '1' HOUR) AS previous
       FROM fact_events`,
    );

    if (rows.length === 0) return null;

    const current = Number(rows[0]!.current);
    const previous = Number(rows[0]!.previous);

    if (previous === 0) return current > 0 ? 100 : 0;

    return ((current - previous) / previous) * 100;
  } catch (err) {
    console.error('[dataintel][alerts] getMetricChangePct failed:', err);
    return null;
  }
}
