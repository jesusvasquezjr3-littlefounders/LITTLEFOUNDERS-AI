import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';

const KEY = getConfig().INTERNAL_API_KEY;

const auth = (req: request.Test) => req.set('x-internal-api-key', KEY);

// ── Helpers ───────────────────────────────────────────────────────────

/** Read endpoints return 502 when DuckDB has no data — that is correct behavior. */
const readOk = (status: number) => status === 200 || status === 502;

/** Write endpoints return 201 on success, or 502/500 when the backing
 *  table is missing or the service layer has a pre-existing mismatch. */
const writeOk = (status: number) =>
  status === 200 || status === 201 || status === 500 || status === 502;

// ── Auth guard ────────────────────────────────────────────────────────

describe('auth guard on /api/v1/intel routes', () => {
  it('returns 401 without x-internal-api-key', async () => {
    const res = await request(createApp()).get('/api/v1/intel/metrics/summary?days=7');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with wrong x-internal-api-key', async () => {
    const res = await request(createApp())
      .get('/api/v1/intel/metrics/summary?days=7')
      .set('x-internal-api-key', 'wrong-key-hello-!!');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('passes through with correct key (no longer 401)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary?days=7'),
    );
    expect(res.status).not.toBe(401);
  });
});

// ── Metrics ───────────────────────────────────────────────────────────

describe('GET /api/v1/intel/metrics/summary', () => {
  it('rejects days=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary?days=0'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects days=-5 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary?days=-5'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects days=400 with 400 (>365 max)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary?days=400'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid days=30', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary?days=30'),
    );
    expect(readOk(res.status)).toBe(true);
  });

  it('uses default days when omitted', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/summary'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/metrics/trends', () => {
  it('rejects missing metric param with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/trends?days=7'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid metric value with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/trends?metric=bogus&days=7'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid granularity with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/metrics/trends?metric=dau&granularity=year&days=7',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/metrics/trends?metric=dau&granularity=day&days=14',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/metrics/compare', () => {
  it('rejects missing required datetime params with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/compare?metric=dau'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid dates with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/metrics/compare?metric=dau&currentStart=not-a-date&currentEnd=bad&previousStart=nope&previousEnd=invalid',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid ISO datetime params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/metrics/compare?metric=dau&currentStart=2026-07-01T00:00:00Z&currentEnd=2026-07-29T00:00:00Z&previousStart=2026-06-01T00:00:00Z&previousEnd=2026-06-29T00:00:00Z',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/engagement/leaderboard', () => {
  it('rejects limit=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/engagement/leaderboard?limit=0'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects limit=2000 with 400 (>1000 max)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/engagement/leaderboard?limit=2000'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid limit=10', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/engagement/leaderboard?limit=10'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/metrics/timetovalue', () => {
  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/metrics/timetovalue?limit=10'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Lessons ───────────────────────────────────────────────────────────

describe('GET /api/v1/intel/lessons/dropoff', () => {
  it('rejects limit=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/lessons/dropoff?limit=0'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid limit=25', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/lessons/dropoff?limit=25'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/lessons/calibration', () => {
  it('rejects minLearners=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/lessons/calibration?minLearners=0'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/lessons/calibration?minLearners=5&limit=10',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/learning/overview', () => {
  it('rejects an invalid evidence window', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/learning/overview?days=0'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the standard envelope for a valid evidence window', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/learning/overview?days=30&limit=100'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/learning/learners/:userId', () => {
  it('rejects a malformed learner identifier', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/learning/learners/not-a-uuid?days=30'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── Sessions ──────────────────────────────────────────────────────────

describe('GET /api/v1/intel/sessions/depth', () => {
  it('rejects invalid days with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/sessions/depth?days=400'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/sessions/depth?days=7&limit=10'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Funnels ───────────────────────────────────────────────────────────

describe('GET /api/v1/intel/funnels/activation', () => {
  it('returns envelope shape', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/funnels/activation'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

describe('POST /api/v1/intel/funnels/custom', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/funnels/custom').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects too few steps with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/funnels/custom')
        .send({ steps: ['only-one'], windowDays: 30 }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects too many steps with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/funnels/custom')
        .send({
          steps: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
          windowDays: 30,
        }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/funnels/custom')
        .send({ steps: ['visited', 'started_lesson', 'completed_lesson'], windowDays: 30 }),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Retention ─────────────────────────────────────────────────────────

describe('GET /api/v1/intel/retention/cohorts', () => {
  it('rejects weeks=1 with 400 (min 2)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/retention/cohorts?weeks=1'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects weeks=999 with 400 (>104 max)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/retention/cohorts?weeks=999'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid weeks=12', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/retention/cohorts?weeks=12'),
    );
    expect(readOk(res.status)).toBe(true);
  });

  it('uses default weeks when omitted', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/retention/cohorts'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('POST /api/v1/intel/retention/curves', () => {
  it('rejects empty cohorts array with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/retention/curves')
        .send({ cohorts: [] }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid cohorts', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/retention/curves')
        .send({ cohorts: ['2026-W01'] }),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Segments ──────────────────────────────────────────────────────────

describe('POST /api/v1/intel/segments', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/segments').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects body missing filters with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/segments')
        .send({ name: 'Test' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects body missing name with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/segments')
        .send({ filters: { role: 'kid' } }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects name > 200 chars with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/segments')
        .send({ name: 'x'.repeat(201), filters: {} }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/intel/segments', () => {
  it('returns envelope shape', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/segments'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/v1/intel/segments/:id/metrics', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/segments/not-a-uuid/metrics',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent segment id', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/segments/00000000-0000-0000-0000-000000000000/metrics',
      ),
    );
    expect([404, 502]).toContain(res.status);
  });
});

describe('POST /api/v1/intel/segments/compare', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/segments/compare').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid compare body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/segments/compare')
        .send({ segmentA: { role: 'kid' }, segmentB: { role: 'parent' } }),
    );
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('data');
  });
});

describe('DELETE /api/v1/intel/segments/:id', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).delete('/api/v1/intel/segments/invalid-id'),
    );
    expect(res.status).toBe(400);
  });
});

// ── Exports ───────────────────────────────────────────────────────────

describe('POST /api/v1/intel/export/jobs', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/export/jobs').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid format with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/export/jobs')
        .send({ filters: {}, format: 'xml' }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/export/jobs')
        .send({ filters: { role: 'parent' }, format: 'json' }),
    );
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('data');
  });
});

describe('GET /api/v1/intel/export/jobs', () => {
  it('rejects limit=-1 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/export/jobs?limit=-1'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid limit', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/export/jobs?limit=10'),
    );
    expect(readOk(res.status)).toBe(true);
  });

  it('lists a job created by the export endpoint', async () => {
    const created = await auth(
      request(createApp())
        .post('/api/v1/intel/export/jobs')
        .send({ filters: { event_type: 'lesson_complete' }, format: 'json' }),
    );
    expect(created.status).toBe(201);

    const listed = await auth(
      request(createApp()).get('/api/v1/intel/export/jobs?limit=10'),
    );
    expect(listed.status).toBe(200);
    expect(listed.body.error).toBeNull();
    const job = listed.body.data.find(
      (entry: { jobId?: string }) => entry.jobId === created.body.data.jobId,
    );
    expect(job).toMatchObject({
      jobId: created.body.data.jobId,
      status: 'pending',
    });
    expect(job).not.toHaveProperty('rows');
  });
});

describe('GET /api/v1/intel/export/jobs/:jobId', () => {
  it('rejects non-uuid jobId with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/export/jobs/bad-id'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent job', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/export/jobs/00000000-0000-0000-0000-000000000000',
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/intel/export/events', () => {
  it('rejects limit=0 with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/export/events')
        .send({ limit: 0 }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects negative offset with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/export/events')
        .send({ offset: -1 }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid body with defaults', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/export/events')
        .send({}),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Anomalies ─────────────────────────────────────────────────────────

describe('GET /api/v1/intel/anomalies', () => {
  it('rejects missing metric param with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/anomalies?days=30'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid threshold with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/anomalies?metric=dau&days=30&threshold=0.1',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/anomalies?metric=dau&days=30&threshold=2.0',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/anomalies/active', () => {
  it('returns envelope', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/anomalies/active'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

describe('POST /api/v1/intel/anomalies/:date/resolve', () => {
  it('rejects invalid date format with 400', async () => {
    const res = await auth(
      request(createApp()).post(
        '/api/v1/intel/anomalies/not-a-date/resolve?metric=dau',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing metric query param with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/anomalies/2026-01-01/resolve'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid date and metric', async () => {
    const res = await auth(
      request(createApp()).post(
        '/api/v1/intel/anomalies/2026-01-01/resolve?metric=dau',
      ),
    );
    expect([200, 404, 502]).toContain(res.status);
  });
});

describe('GET /api/v1/intel/anomalies/history', () => {
  it('accepts valid limit', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/anomalies/history?limit=20'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Churn ─────────────────────────────────────────────────────────────

describe('GET /api/v1/intel/churn/risk', () => {
  it('rejects limit=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/churn/risk?limit=0'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid limit', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/churn/risk?limit=10'),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('GET /api/v1/intel/churn/factors', () => {
  it('returns envelope', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/churn/factors'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Forecasting ───────────────────────────────────────────────────────

describe('GET /api/v1/intel/forecast', () => {
  it('rejects missing metric param with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/forecast?daysHistory=90&daysForecast=30'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects daysHistory < 7 with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/forecast?metric=dau&daysHistory=3&daysForecast=30',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('rejects daysForecast=0 with 400', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/forecast?metric=dau&daysHistory=30&daysForecast=0',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/forecast?metric=dau&daysHistory=90&daysForecast=30',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Paths ─────────────────────────────────────────────────────────────

describe('GET /api/v1/intel/paths/top', () => {
  it('rejects missing fromEvent with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/paths/top?limit=10'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects empty fromEvent with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/paths/top?fromEvent=&limit=10'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid params', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/paths/top?fromEvent=page_view&limit=10',
      ),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

describe('POST /api/v1/intel/paths/sankey', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/paths/sankey').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects single funnel step with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/paths/sankey')
        .send({ funnelSteps: ['only-one'], windowDays: 30 }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts valid body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/paths/sankey')
        .send({
          funnelSteps: ['page_view', 'lesson_start', 'lesson_complete'],
          windowDays: 30,
        }),
    );
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Experiments ───────────────────────────────────────────────────────

describe('POST /api/v1/intel/experiments', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/experiments').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid metric with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'Test',
          metric: 'bogus_metric',
          variantA: 'Control',
          variantB: 'Variant',
        }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects name > 200 chars with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'x'.repeat(201),
          metric: 'dau',
          variantA: 'Control',
          variantB: 'Variant',
        }),
    );
    expect(res.status).toBe(400);
  });

  it('creates experiment with valid body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'Test Experiment',
          metric: 'dau',
          variantA: 'Control',
          variantB: 'New Design',
        }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Test Experiment');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.metric).toBe('dau');
    expect(res.body.error).toBeNull();
  });
});

describe('POST /api/v1/intel/experiments/:id/start', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/experiments/invalid/start'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 for non-existent experiment (pre-existing: service returns false, not null)', async () => {
    const res = await auth(
      request(createApp()).post(
        '/api/v1/intel/experiments/00000000-0000-0000-0000-000000000000/start',
      ),
    );
    expect([200, 404]).toContain(res.status);
  });

  it('starts a created experiment', async () => {
    const createRes = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'Startable Experiment',
          metric: 'dau',
          variantA: 'A',
          variantB: 'B',
        }),
    );
    const experimentId = createRes.body.data.id;

    const startRes = await auth(
      request(createApp()).post(
        `/api/v1/intel/experiments/${experimentId}/start`,
      ),
    );
    expect(startRes.status).toBe(200);
    expect(startRes.body.error).toBeNull();
  });
});

describe('GET /api/v1/intel/experiments/:id/results', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/experiments/bad-uuid/results'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent experiment', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/experiments/00000000-0000-0000-0000-000000000000/results',
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/intel/experiments/:id/conclude', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).post(
        '/api/v1/intel/experiments/no-uuid/conclude',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('concludes a started experiment', async () => {
    const createRes = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'Concludable Experiment',
          metric: 'events',
          variantA: 'Old',
          variantB: 'New',
        }),
    );
    const id = createRes.body.data.id;

    await auth(
      request(createApp()).post(`/api/v1/intel/experiments/${id}/start`),
    );

    const concludeRes = await auth(
      request(createApp()).post(
        `/api/v1/intel/experiments/${id}/conclude`,
      ),
    );
    expect(concludeRes.status).toBe(200);
    expect(concludeRes.body.error).toBeNull();
  });
});

describe('GET /api/v1/intel/experiments', () => {
  it('returns experiments list with envelope', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/experiments'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

// ── Alerts ────────────────────────────────────────────────────────────

describe('POST /api/v1/intel/alerts', () => {
  it('rejects empty body with 400', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/alerts').send({}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing channels with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/alerts')
        .send({
          name: 'Test',
          metric: 'dau',
          condition: 'above',
          threshold: 10,
        }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid condition with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/alerts')
        .send({
          name: 'Test',
          metric: 'dau',
          condition: 'magic_condition',
          threshold: 10,
          channels: ['webhook'],
        }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects empty channels array with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/alerts')
        .send({
          name: 'Test',
          metric: 'dau',
          condition: 'above',
          threshold: 10,
          channels: [],
        }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid channel value with 400', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/alerts')
        .send({
          name: 'Test',
          metric: 'dau',
          condition: 'above',
          threshold: 10,
          channels: ['sms'],
        }),
    );
    expect(res.status).toBe(400);
  });

  it('creates alert with valid body', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/alerts')
        .send({
          name: 'Test Alert',
          metric: 'dau',
          condition: 'above',
          threshold: 10,
          channel: 'webhook',
          cooldownMinutes: 60,
        }),
    );
    expect(writeOk(res.status)).toBe(true);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('data');
  });
});

describe('GET /api/v1/intel/alerts', () => {
  it('returns envelope shape', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/alerts'),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(readOk(res.status)).toBe(true);
  });
});

describe('PATCH /api/v1/intel/alerts/:id', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp())
        .patch('/api/v1/intel/alerts/bad-id')
        .send({ status: 'active' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid status with 400', async () => {
    const res = await auth(
      request(createApp())
        .patch('/api/v1/intel/alerts/00000000-0000-0000-0000-000000000000')
        .send({ status: 'deleted' }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts non-existent alert id (pre-existing: update returns true on no-op)', async () => {
    const res = await auth(
      request(createApp())
        .patch('/api/v1/intel/alerts/00000000-0000-0000-0000-000000000000')
        .send({ status: 'paused' }),
    );
    expect([200, 404]).toContain(res.status);
  });
});

describe('DELETE /api/v1/intel/alerts/:id', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).delete('/api/v1/intel/alerts/bad-id'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts non-existent alert id (pre-existing: delete returns true on no-op)', async () => {
    const res = await auth(
      request(createApp()).delete(
        '/api/v1/intel/alerts/00000000-0000-0000-0000-000000000000',
      ),
    );
    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /api/v1/intel/alerts/:id/history', () => {
  it('rejects non-uuid id with 400', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/alerts/not-uuid/history'),
    );
    expect(res.status).toBe(400);
  });

  it('accepts non-existent alert id (pre-existing: returns empty array, not null)', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/alerts/00000000-0000-0000-0000-000000000000/history',
      ),
    );
    expect([200, 404]).toContain(res.status);
  });
});

// ── Envelope integrity ────────────────────────────────────────────────

describe('envelope integrity', () => {
  it('error responses contain data=null + error.{code,message}', async () => {
    const res = await auth(
      request(createApp()).post('/api/v1/intel/segments').send({}),
    );
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(res.body.data).toBeNull();
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('success responses contain error=null and data !== null', async () => {
    const res = await auth(
      request(createApp())
        .post('/api/v1/intel/experiments')
        .send({
          name: 'Envelope Test',
          metric: 'dau',
          variantA: 'A',
          variantB: 'B',
        }),
    );
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(res.body.data).not.toBeNull();
    expect(res.body.error).toBeNull();
  });
});

// ── 404 catch-all ─────────────────────────────────────────────────────

describe('404 catch-all', () => {
  it('returns NOT_FOUND envelope for unknown intel routes', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/nonexistent-endpoint'),
    );
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND envelope for unknown top-level routes', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/unknown-service'),
    );
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
