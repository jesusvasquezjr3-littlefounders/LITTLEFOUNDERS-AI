import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse } from './helpers.js';
import { extractBucketAndFile, purgeExpiredTutorSessions } from '../services/tutorRetention.js';

/*
 * The 90-day sweep (/ORACLE.md §12).
 *
 * The test that matters most here is the one asserting the AUDIO is deleted
 * too. Dropping the session row cascades to turns and segments, but nothing
 * cascades to a file in Depot — and a sweep that deleted only rows would leave
 * a child's conversation audible at a public URL with every record of it gone,
 * so nothing would remain to tell anyone the files existed.
 */

interface StubOpts {
  purged?: { session_id: string; audio_paths: string[] }[];
  rpcStatus?: number;
  depotStatus?: number;
  calls?: { url: string; method: string }[];
}

function stub(opts: StubOpts = {}) {
  const calls = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method });

      if (url.includes('/rpc/purge_expired_tutor_sessions')) {
        if (opts.rpcStatus && opts.rpcStatus >= 400) {
          return Promise.resolve(new Response(null, { status: opts.rpcStatus }));
        }
        return Promise.resolve(jsonResponse(200, opts.purged ?? []));
      }
      if (url.includes('/api/v1/files/')) {
        return Promise.resolve(new Response(null, { status: opts.depotStatus ?? 204 }));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('extractBucketAndFile', () => {
  it.each([
    ['https://media.example.com/files/tutor-speech/abc123.mp3', 'tutor-speech/abc123.mp3'],
    ['tutor-speech/abc123.mp3', 'tutor-speech/abc123.mp3'],
    ['/files/tutor-speech/abc123.mp3', 'tutor-speech/abc123.mp3'],
    ['https://media.example.com/files/tutor-speech/abc123.mp3?v=2', 'tutor-speech/abc123.mp3'],
  ])('parses %s', (input, expected) => {
    expect(extractBucketAndFile(input)).toBe(expected);
  });

  it.each([['', null], ['nonsense', null], ['a/b/c/d', null]])(
    'refuses to guess at %s',
    (input, expected) => {
      // Guessing wrong here does not delete the wrong file — it leaks one, by
      // silently doing nothing. Returning null makes that a reported failure.
      expect(extractBucketAndFile(input as string)).toBe(expected);
    },
  );
});

describe('purgeExpiredTutorSessions', () => {
  it('deletes the audio of every session it purges', async () => {
    const calls = stub({
      purged: [
        { session_id: '1', audio_paths: ['tutor-speech/a.mp3', 'tutor-speech/b.mp3'] },
        { session_id: '2', audio_paths: ['tutor-speech/c.mp3'] },
      ],
    });

    const result = await purgeExpiredTutorSessions(500);

    expect(result).toMatchObject({ sessionsDeleted: 2, audioDeleted: 3, audioFailed: 0 });
    const deletes = calls.filter((c) => c.method === 'DELETE');
    expect(deletes).toHaveLength(3);
    expect(deletes[0]?.url).toContain('/api/v1/files/tutor-speech/a.mp3');
  });

  it('treats a 404 from Depot as already gone', async () => {
    stub({ purged: [{ session_id: '1', audio_paths: ['tutor-speech/a.mp3'] }], depotStatus: 404 });
    const result = await purgeExpiredTutorSessions();
    expect(result).toMatchObject({ audioDeleted: 1, audioFailed: 0 });
  });

  it('reports an audio file that survived rather than swallowing it', async () => {
    stub({ purged: [{ session_id: '1', audio_paths: ['tutor-speech/a.mp3'] }], depotStatus: 500 });
    const result = await purgeExpiredTutorSessions();
    // The row is already gone, so nothing else will ever mention this file.
    expect(result).toMatchObject({ audioDeleted: 0, audioFailed: 1 });
    expect(result?.orphanedPaths).toEqual(['tutor-speech/a.mp3']);
  });

  it('returns null when the database call itself failed', async () => {
    stub({ rpcStatus: 500 });
    // NOT an empty result. A retention job that reports success on an
    // unreachable database is how a 90-day promise becomes forever (§1.14).
    expect(await purgeExpiredTutorSessions()).toBeNull();
  });

  it('handles a session with no stored audio', async () => {
    stub({ purged: [{ session_id: '1', audio_paths: [] }] });
    expect(await purgeExpiredTutorSessions()).toMatchObject({ sessionsDeleted: 1, audioDeleted: 0 });
  });

  it('RETAINS shared scripted audio instead of deleting it', async () => {
    /*
     * `tutor-speech-shared` holds the closed, human-written line set — the
     * greetings, the safety lines, the closes — pre-generated once and reused
     * by every learner (/ORACLE.md §15). Depot is content-addressed, so each
     * of those is ONE object that thousands of transcripts point at. Deleting
     * it when the first of those sessions expires would protect nobody and
     * silence every session afterwards.
     */
    const calls = stub({
      purged: [
        {
          session_id: '1',
          audio_paths: [
            'tutor-speech/a.mp3',
            'https://media.example.com/files/tutor-speech-shared/greeting-rho.mp3',
          ],
        },
      ],
    });

    const result = await purgeExpiredTutorSessions();

    expect(result).toMatchObject({ audioDeleted: 1, audioRetained: 1, audioFailed: 0 });
    // Retained is not "failed": nothing needs retrying and nothing leaked.
    expect(result?.orphanedPaths).toEqual([]);
    const deletes = calls.filter((c) => c.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toContain('tutor-speech/a.mp3');
    expect(calls.some((c) => c.url.includes('tutor-speech-shared'))).toBe(false);
  });

  it('refuses to delete from any other bucket at all', async () => {
    // The guard predates the shared bucket in usefulness: this function would
    // otherwise delete whatever path the database handed it, including a
    // lesson-narration URL written into audio_path by a bug.
    const calls = stub({ purged: [{ session_id: '1', audio_paths: ['lesson-audio/narration.mp3'] }] });
    const result = await purgeExpiredTutorSessions();
    expect(result).toMatchObject({ audioDeleted: 0, audioRetained: 1, audioFailed: 0 });
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });
});

describe('POST /api/v1/tutor/internal/retention/purge', () => {
  const key = () => process.env.INTERNAL_API_KEY as string;

  it('is internal-only', async () => {
    stub();
    const response = await request(createApp()).post('/api/v1/tutor/internal/retention/purge').send({});
    expect(response.status).toBe(403);
  });

  it('reports what it deleted rather than answering 204', async () => {
    stub({ purged: [{ session_id: '1', audio_paths: ['tutor-speech/a.mp3'] }] });
    const response = await request(createApp())
      .post('/api/v1/tutor/internal/retention/purge')
      .set('x-internal-api-key', key())
      .send({ limit: 10 });

    // A retention job that cannot prove it ran is indistinguishable from one
    // that did not.
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ sessionsDeleted: 1, audioDeleted: 1 });
  });

  it('fails loudly when the sweep could not run', async () => {
    stub({ rpcStatus: 500 });
    const response = await request(createApp())
      .post('/api/v1/tutor/internal/retention/purge')
      .set('x-internal-api-key', key())
      .send({});
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('rejects an out-of-range batch size', async () => {
    stub();
    const response = await request(createApp())
      .post('/api/v1/tutor/internal/retention/purge')
      .set('x-internal-api-key', key())
      .send({ limit: 999999 });
    expect(response.status).toBe(400);
  });
});
