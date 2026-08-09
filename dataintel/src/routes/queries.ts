import { z } from 'zod';
import { Router } from 'express';
import { ok, fail } from '../lib/http.js';
import * as metrics from '../services/metrics.js';
import * as funnels from '../services/funnel.js';
import * as retention from '../services/retention.js';
import * as segments from '../services/segments.js';
import * as exports_ from '../services/exports.js';
import * as anomalies from '../services/anomalies.js';
import * as churn from '../services/churn.js';
import * as forecasting from '../services/forecasting.js';
import * as paths from '../services/paths.js';
import * as experiments from '../services/experiments.js';
import * as alerts from '../services/alerts.js';
import * as lessons from '../services/lessons.js';
import * as sessions from '../services/sessions.js';
import * as learning from '../services/learning.js';
import * as dataQuality from '../services/dataQuality.js';

// ── Reusable Zod schemas ─────────────────────────────────────────────

const daysSchema = z.coerce.number().int().min(1).max(365).default(30);
const limitSchema = z.coerce.number().int().min(1).max(1000);
// Flat time-series features only accept metrics that have an exact event-fact
// definition. Retention, activation and completions have different cohorts or
// denominators, so silently mapping them to users/events would be false.
const metricSchema = z.enum(['events', 'dau', 'users', 'sessions']);
// Anomaly detection, forecasting and period-comparison run off a flat
// per-bucket (hour/day) rollup of fact_events — only these four metrics
// have a column in that rollup. wau/mau/retention/activation/completions
// need a dedicated cohort/window query, not a bucket aggregate, so they're
// rejected here at the edge (400) rather than failing deep inside DuckDB.
const bucketMetricSchema = z.enum(['events', 'dau', 'users', 'sessions']);
const granularitySchema = z.enum(['hour', 'day', 'week', 'month']).default('day');

const customFunnelSchema = z.object({
  steps: z.array(z.string().min(1)).min(2).max(10),
  windowDays: z.number().int().min(1).max(365),
});

const retentionCurvesSchema = z.object({
  cohorts: z.array(z.string().min(1)).min(1).max(50),
});

const compareSegmentsSchema = z.object({
  segmentA: z.string().uuid(),
  segmentB: z.string().uuid(),
});

const exportFiltersSchema = z.object({
  event_type: z.union([z.string(), z.array(z.string())]).optional(),
  role: z.union([z.string(), z.array(z.string())]).optional(),
  route_class: z.union([z.string(), z.array(z.string())]).optional(),
  device: z.union([z.string(), z.array(z.string())]).optional(),
  locale: z.union([z.string(), z.array(z.string())]).optional(),
  lesson_id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
  segment_id: z.union([z.string(), z.array(z.string())]).optional(),
}).strict();

const exportJobSchema = z.object({
  filters: exportFiltersSchema,
  format: z.enum(['csv', 'json', 'parquet']).default('json'),
});

const exportEventsSchema = z.object({
  filters: exportFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(10000).default(1000),
  offset: z.number().int().min(0).default(0),
});

const sankeySchema = z.object({
  funnelSteps: z.array(z.string().min(1)).min(2).max(20),
  windowDays: z.number().int().min(1).max(365),
});

const experimentSchema = z.object({
  name: z.string().min(1).max(200),
  metric: metricSchema,
  variantA: z.string().min(1).max(100),
  variantB: z.string().min(1).max(100),
  surface: z.enum(['learn', 'tasks', 'profile', 'tutor']).default('learn'),
  target: z.string().regex(/^[a-z0-9._-]{1,64}$/).default('default'),
});

const runtimeAssignmentSchema = z.object({
  userId: z.string().uuid(),
  surface: z.enum(['learn', 'tasks', 'profile', 'tutor']),
  target: z.string().regex(/^[a-z0-9._-]{1,64}$/),
});

const runtimeExposureSchema = runtimeAssignmentSchema.extend({ experimentId: z.string().uuid() });

const alertSchema = z.object({
  name: z.string().min(1).max(200),
  metric: metricSchema,
  condition: z.enum(['above', 'below', 'change_pct']),
  threshold: z.number().min(0).max(1000000),
  channel: z.enum(['webhook', 'email']),
  cooldownMinutes: z.coerce.number().int().min(1).max(1440).default(60),
});

const alertPatchSchema = z.object({
  status: z.enum(['active', 'paused']),
});

const segmentFilterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'in']),
  value: z.union([z.string(), z.array(z.string())]),
});

const segmentDefSchema = z.object({
  name: z.string().min(1).max(200),
  filters: z.array(segmentFilterSchema).min(1).max(20),
});

const userIdParamSchema = z.object({ userId: z.string().uuid() });

// ── Router ───────────────────────────────────────────────────────────

export function intelRouter(): Router {
  const router = Router();

  // ═══ Core Metrics ═════════════════════════════════════════════════

  router.get('/metrics/summary', async (req, res) => {
    try {
      const days = daysSchema.parse(req.query.days ?? '30');
      const result = await metrics.getMetricsSummary(days);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Metrics unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/metrics/trends', async (req, res) => {
    try {
      const metric = metricSchema.parse(req.query.metric);
      const granularity = granularitySchema.parse(req.query.granularity ?? 'day');
      const days = daysSchema.parse(req.query.days ?? '30');
      const result = await metrics.getTrend(metric, granularity, days);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Trend data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/metrics/compare', async (req, res) => {
    try {
      const metric = metricSchema.parse(req.query.metric);
      const currentStart = z.string().datetime().parse(req.query.currentStart);
      const currentEnd = z.string().datetime().parse(req.query.currentEnd);
      const previousStart = z.string().datetime().parse(req.query.previousStart);
      const previousEnd = z.string().datetime().parse(req.query.previousEnd);
      const result = await metrics.getComparison(metric, currentStart, currentEnd, previousStart, previousEnd);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Comparison data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/engagement/leaderboard', async (req, res) => {
    try {
      const limit = limitSchema.default(50).parse(req.query.limit ?? '50');
      const result = await metrics.getEngagement(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Engagement data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/metrics/timetovalue', async (req, res) => {
    try {
      const limit = limitSchema.default(500).parse(req.query.limit ?? '500');
      const result = await metrics.getTimeToValue(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Time-to-value data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Lessons ═══════════════════════════════════════════════════════

  router.get('/lessons/dropoff', async (req, res) => {
    try {
      const limit = limitSchema.default(25).parse(req.query.limit ?? '25');
      const result = await lessons.getLessonDropoff(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Lesson dropoff data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/lessons/calibration', async (req, res) => {
    try {
      const minLearners = z.coerce.number().int().min(1).default(2).parse(req.query.minLearners ?? '2');
      const limit = limitSchema.default(50).parse(req.query.limit ?? '50');
      const result = await lessons.getSegmentCalibration(minLearners, limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Calibration data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Sessions ══════════════════════════════════════════════════════

  router.get('/sessions/depth', async (req, res) => {
    try {
      const days = daysSchema.parse(req.query.days ?? '30');
      const limit = limitSchema.default(200).parse(req.query.limit ?? '200');
      const result = await sessions.getSessionDepth(days, limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Session depth data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Funnels ═══════════════════════════════════════════════════════

  router.get('/funnels/activation', async (_req, res) => {
    try {
      const result = await funnels.getActivationFunnel();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Activation funnel unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/funnels/custom', async (req, res) => {
    try {
      const parsed = customFunnelSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { steps, windowDays } = parsed.data;
      const result = await funnels.getCustomFunnel(steps, windowDays);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Custom funnel unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Retention ═════════════════════════════════════════════════════

  router.get('/retention/cohorts', async (req, res) => {
    try {
      const weeks = z.coerce.number().int().min(2).max(104).default(12).parse(req.query.weeks ?? '12');
      const result = await retention.getCohortRetention(weeks);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Cohort retention unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/retention/curves', async (req, res) => {
    try {
      const parsed = retentionCurvesSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { cohorts } = parsed.data;
      const result = await retention.getRetentionCurves(cohorts);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Retention curves unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Segments ══════════════════════════════════════════════════════

  router.post('/segments', async (req, res) => {
    try {
      const parsed = segmentDefSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const result = await segments.createSegment(parsed.data);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Failed to create segment');
      return ok(res, result, 201);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/segments', async (_req, res) => {
    try {
      const result = await segments.listSegments();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Segments list unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/segments/:id/metrics', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await segments.getSegmentMetrics(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Segment not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/segments/compare', async (req, res) => {
    try {
      const parsed = compareSegmentsSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { segmentA, segmentB } = parsed.data;
      const result = await segments.compareSegments(segmentA, segmentB);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Segment comparison unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.delete('/segments/:id', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await segments.deleteSegment(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Segment not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Exports ═══════════════════════════════════════════════════════

  router.post('/export/jobs', async (req, res) => {
    try {
      const parsed = exportJobSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { filters, format } = parsed.data;
      const result = await exports_.createExportJob(filters, format);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Failed to create export job');
      return ok(res, result, 201);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/export/jobs/:jobId', async (req, res) => {
    try {
      const jobId = z.string().uuid().parse(req.params.jobId);
      const result = await exports_.getExportJob(jobId);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Export job not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/export/jobs', async (req, res) => {
    try {
      const limit = z.coerce.number().int().min(1).max(100).default(10).parse(req.query.limit ?? '10');
      const result = await exports_.listExportJobs(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Export jobs list unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/export/events', async (req, res) => {
    try {
      const parsed = exportEventsSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { filters, limit, offset } = parsed.data;
      const result = await exports_.exportEvents(filters, limit, offset);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Events export unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Anomalies ═════════════════════════════════════════════════════

  router.get('/anomalies', async (req, res) => {
    try {
      const metric = bucketMetricSchema.parse(req.query.metric);
      const days = daysSchema.parse(req.query.days ?? '30');
      const threshold = z.coerce.number().min(0.5).max(10).default(2.0).parse(req.query.threshold ?? '2.0');
      const result = await anomalies.detectAnomalies(metric, days, threshold);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Anomaly detection unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/anomalies/active', async (_req, res) => {
    try {
      const result = await anomalies.getActiveAnomalies();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Active anomalies unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/anomalies/:date/resolve', async (req, res) => {
    try {
      const date = z.string().date().parse(req.params.date);
      const metric = bucketMetricSchema.parse(req.query.metric);
      const result = await anomalies.resolveAnomaly(date, metric);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Anomaly not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/anomalies/history', async (req, res) => {
    try {
      const limit = limitSchema.default(50).parse(req.query.limit ?? '50');
      const result = await anomalies.getAnomalyHistory(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Anomaly history unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Churn ═════════════════════════════════════════════════════════

  router.get('/churn/risk', async (req, res) => {
    try {
      const limit = limitSchema.default(100).parse(req.query.limit ?? '100');
      const result = await churn.getChurnRisk(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Churn risk data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/churn/factors', async (_req, res) => {
    try {
      const result = await churn.getChurnFactors();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Churn factors unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Forecasting ═══════════════════════════════════════════════════

  router.get('/forecast', async (req, res) => {
    try {
      const metric = bucketMetricSchema.parse(req.query.metric);
      const daysHistory = z.coerce.number().int().min(7).max(365).default(90).parse(req.query.daysHistory ?? '90');
      const daysForecast = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.daysForecast ?? '30');
      const result = await forecasting.getForecast(metric, daysHistory, daysForecast);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Forecast unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Paths ═════════════════════════════════════════════════════════

  router.get('/paths/top', async (req, res) => {
    try {
      const fromEvent = z.string().min(1).max(100).parse(req.query.fromEvent);
      const limit = limitSchema.default(10).parse(req.query.limit ?? '10');
      const result = await paths.getTopPaths(fromEvent, limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Path data unavailable');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/paths/sankey', async (req, res) => {
    try {
      const parsed = sankeySchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { funnelSteps, windowDays } = parsed.data;
      const result = await paths.getSankeyData(funnelSteps, windowDays);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Sankey data unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Learning intelligence and data quality ════════════════════════════

  router.get('/learning/states/:userId', async (req, res) => {
    try {
      const { userId } = userIdParamSchema.parse(req.params);
      const result = await learning.getLearnerSkillStates(userId);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Learning state unavailable');
      return ok(res, { states: result });
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/learning/recommendation/:userId', async (req, res) => {
    try {
      const { userId } = userIdParamSchema.parse(req.params);
      const result = await learning.getLearnerRecommendation(userId);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Learning recommendation unavailable');
      return ok(res, { recommendation: result ?? null });
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/learning/content-health', async (req, res) => {
    try {
      const limit = limitSchema.default(50).parse(req.query.limit ?? '50');
      const result = await learning.getSkillHealth(limit);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Content health unavailable');
      return ok(res, { skills: result });
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/quality', async (_req, res) => {
    try {
      const result = await dataQuality.getDataQualityReport();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Data quality unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Experiments ═══════════════════════════════════════════════════

  router.post('/experiments', async (req, res) => {
    try {
      const parsed = experimentSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { name, metric, variantA, variantB, surface, target } = parsed.data;
      const result = await experiments.createExperiment(name, metric, variantA, variantB, surface, target);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Failed to create experiment');
      return ok(res, result, 201);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/experiments/:id/start', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await experiments.startExperiment(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Experiment not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/experiments/:id/results', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await experiments.getExperimentResults(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Experiment not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/experiments/:id/conclude', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await experiments.concludeExperiment(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Experiment not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/experiments', async (_req, res) => {
    try {
      const result = await experiments.listExperiments();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Experiments list unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // Core only. Product code requests an assignment before rendering a test,
  // then records exposure after the treatment exists on screen.
  router.post('/runtime/experiments/assignments', async (req, res) => {
    try {
      const parsed = runtimeAssignmentSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const result = await experiments.getRuntimeAssignments(parsed.data.userId, parsed.data.surface, parsed.data.target);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Experiment assignment unavailable');
      return ok(res, { assignments: result });
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.post('/runtime/experiments/exposure', async (req, res) => {
    try {
      const parsed = runtimeExposureSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const result = await experiments.recordRuntimeExposure(
        parsed.data.userId,
        parsed.data.experimentId,
        parsed.data.surface,
        parsed.data.target,
      );
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Running experiment assignment not found');
      return ok(res, { assignment: result });
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  // ═══ Alerts ════════════════════════════════════════════════════════

  router.post('/alerts', async (req, res) => {
    try {
      const parsed = alertSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const result = await alerts.createAlert(parsed.data);
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Failed to create alert');
      return ok(res, result, 201);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/alerts', async (_req, res) => {
    try {
      const result = await alerts.listAlerts();
      if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Alerts list unavailable');
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.patch('/alerts/:id', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const parsed = alertPatchSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.message);
      const { status } = parsed.data;
      const result = await alerts.updateAlertStatus(id, status);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Alert not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.delete('/alerts/:id', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await alerts.deleteAlert(id);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Alert not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  router.get('/alerts/:id/history', async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const limit = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit ?? '20');
      const result = await alerts.getAlertHistory(id, limit);
      if (result === null) return fail(res, 404, 'NOT_FOUND', 'Alert not found');
      return ok(res, result);
    } catch (err) {
      if (err instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
      return fail(res, 500, 'INTERNAL', (err as Error).message);
    }
  });

  return router;
}
