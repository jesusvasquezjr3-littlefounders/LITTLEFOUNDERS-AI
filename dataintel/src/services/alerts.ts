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
}

/**
 * H.3 / Appendix O 1.3 (Alert-to-Notification Delivery Rate): the outcome of
 * the one delivery attempt a trigger gets. `null` only while the attempt is in
 * flight, or for a trigger recorded before delivery was tracked.
 */
export type AlertDeliveryStatus = 'delivered' | 'failed' | 'unconfigured';

export interface AlertDelivery {
  status: AlertDeliveryStatus;
  channel: 'webhook' | 'email';
  /** Short reason, never a payload or a secret (an HTTP status or an error class). */
  error: string | null;
}

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
  delivery_error TEXT
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
}

const DELIVERY_STATUSES: readonly string[] = ['delivered', 'failed', 'unconfigured'];

const VALID_METRIC = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function id(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
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

    const rows = await query<StoredAlert>(
      'SELECT * FROM alerts ORDER BY created_at DESC',
    );

    return rows.map(rowToAlert);
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
      deliveryStatus: r.delivery_status && DELIVERY_STATUSES.includes(r.delivery_status) ? r.delivery_status as AlertDeliveryStatus : null,
      deliveryChannel: r.delivery_channel ?? null,
      deliveredAt: r.delivered_at ? String(r.delivered_at) : null,
      deliveryError: r.delivery_error ?? null,
    }));
  } catch (err) {
    console.error('[dataintel][alerts] getHistory failed:', err);
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
        // through the alert's configured channel; a delivery failure is
        // logged loudly, never silent — the trigger row is already durable —
        // and its outcome is written back to that row (Appendix O 1.3).
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
      `UPDATE alert_history SET delivery_status = ?, delivery_channel = ?, delivered_at = ?, delivery_error = ?
       WHERE alert_id = ? AND triggered_at = ?`,
      delivery.status,
      delivery.channel,
      delivery.status === 'delivered' ? now() : null,
      delivery.error,
      alertId,
      triggeredAt,
    );
  } catch (err) {
    console.error('[dataintel][alerts] recording the delivery outcome failed:', err);
  }
}

/**
 * H.3's notification channel. `webhook` alerts POST the trigger payload to
 * the configured URL; `email` alerts POST a plain-text internal email through
 * the email-server's `/api/v1/send`, in the body that endpoint accepts
 * (alertEmail.ts, contract-tested against the email-server's own route).
 * Both are bounded by a timeout so a hanging channel cannot stall the
 * evaluation loop, and both return their outcome for the trigger row:
 * delivered, failed (with a short reason) or unconfigured (no human could be
 * notified). The trigger row is written BEFORE delivery, so a failed delivery
 * is a visible gap, not a lost alert.
 */
async function deliverAlert(
  alert: Alert,
  trigger: { value: number; triggeredAt: string },
): Promise<AlertDelivery> {
  const { ALERT_WEBHOOK_URL, ALERT_EMAIL_SERVER_URL, ALERT_EMAIL_INTERNAL_KEY, ALERT_EMAIL_TO } = getConfig();
  const failed = (channel: AlertDelivery['channel'], error: string): AlertDelivery => {
    console.error(`[dataintel][alerts] ${channel} delivery failed for "${alert.name}": ${error}`);
    return { status: 'failed', channel, error };
  };
  const reason = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : 'Error').slice(0, 200);
  if (alert.channel === 'webhook') {
    if (!ALERT_WEBHOOK_URL) {
      console.warn(`[dataintel][alerts] alert "${alert.name}" triggered but ALERT_WEBHOOK_URL is not configured — no human was notified`);
      return { status: 'unconfigured', channel: 'webhook', error: null };
    }
    try {
      const res = await fetch(ALERT_WEBHOOK_URL, {
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
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { status: 'delivered', channel: 'webhook', error: null } : failed('webhook', `HTTP ${res.status}`);
    } catch (err) {
      return failed('webhook', reason(err));
    }
  }
  if (!ALERT_EMAIL_SERVER_URL || !ALERT_EMAIL_INTERNAL_KEY || !ALERT_EMAIL_TO) {
    console.warn(`[dataintel][alerts] alert "${alert.name}" triggered but the email channel is not configured — no human was notified`);
    return { status: 'unconfigured', channel: 'email', error: null };
  }
  try {
    const res = await fetch(`${ALERT_EMAIL_SERVER_URL}/api/v1/send`, {
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
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { status: 'delivered', channel: 'email', error: null } : failed('email', `HTTP ${res.status}`);
  } catch (err) {
    return failed('email', reason(err));
  }
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
