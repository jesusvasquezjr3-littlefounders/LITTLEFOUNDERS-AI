import { defineConfig, mergeConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import base from '../../vite.config';
import { gradeV2Visual, v2PublicLessonSchema } from '../../../backend/src/services/v2LessonDocument';
import { checkForgeV2Rows } from '../../../backend/src/services/forgeV2Rows';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = process.env.COURSE_REVIEW_FILE ? path.resolve(process.env.COURSE_REVIEW_FILE) : path.join(root, 'coursegen/runs/solid-course/documents.json');
type ReviewRow = { lesson_id: string; locale: string; document: unknown; answer_keys: Parameters<typeof gradeV2Visual>[1] };
const rows = JSON.parse(readFileSync(source, 'utf8')) as ReviewRow[];
const failures = checkForgeV2Rows(rows);
if (!rows.length || failures.length) throw new Error(`Review requires a compiled, Core-valid corpus: ${failures.join('; ')}`);

// Explicit local author tool, absent from the normal app config and production build.
export default mergeConfig(base, defineConfig({
  server: { host: '127.0.0.1', port: 5197, strictPort: true },
  plugins: [{ name: 'offline-course-review', configureServer(server) {
    server.middlewares.use('/__course_review', async (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (request.method === 'GET' && !url.searchParams.has('lesson')) {
          response.end(JSON.stringify(rows.map(row => ({ lesson: row.lesson_id, locale: row.locale, title: v2PublicLessonSchema.parse(row.document).title })))); return;
        }
        const row = rows.find(row => row.lesson_id === url.searchParams.get('lesson') && row.locale === url.searchParams.get('locale'));
        if (!row) { response.statusCode = 404; response.end('{}'); return; }
        if (request.method === 'GET') { response.end(JSON.stringify(row.document)); return; }
        if (request.method !== 'POST') { response.statusCode = 405; response.end('{}'); return; }
        let body = '';
        for await (const part of request) { body += part; if (body.length > 16_000) throw new Error('Request too large'); }
        const input = JSON.parse(body) as { id?: unknown; answer?: unknown };
        if (typeof input.id !== 'string') throw new Error('Missing segment');
        const grade = gradeV2Visual(v2PublicLessonSchema.parse(row.document), row.answer_keys, input.id, input.answer);
        if (!grade) throw new Error('Invalid answer');
        response.end(JSON.stringify({ verdict: grade.correct ? 'met' : 'review', diagnostic: grade.diagnostic }));
      } catch { response.statusCode = 400; response.end(JSON.stringify({ error: 'Invalid local review request' })); }
    });
  } }],
}));
