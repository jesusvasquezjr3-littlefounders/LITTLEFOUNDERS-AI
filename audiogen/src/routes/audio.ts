import { Router } from 'express';
import { z } from 'zod';
import { narrateLesson, type NarrateLessonDeps } from '../service/lessonAudio.js';
import { narrateSegment, type NarrateSegmentDeps } from '../service/segmentAudio.js';
import { getLessonDocument } from '../db/lessonDocumentsRepo.js';

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

const NarrateLessonBody = z.object({
  lesson_id: z.string().min(1),
  locale: z.enum(LOCALES),
});

const NarrateSegmentBody = z.object({
  text: z.string().min(1).max(4000),
  locale: z.enum(LOCALES),
  voice: z.string().min(1).optional(),
});

const LessonManifestQuery = z.object({
  locale: z.enum(LOCALES),
});

export interface AudioRouterDeps {
  narrateLesson?: Partial<NarrateLessonDeps>;
  narrateSegment?: Partial<NarrateSegmentDeps>;
}

export function audioRouter(deps: AudioRouterDeps = {}): Router {
  const router = Router();

  router.post('/lesson', async (req, res) => {
    const parsed = NarrateLessonBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
    }
    try {
      const summary = await narrateLesson(parsed.data.lesson_id, parsed.data.locale, deps.narrateLesson);
      if (!summary) {
        return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No lesson document for that lesson_id/locale' } });
      }
      return res.json({ data: summary, error: null });
    } catch (err) {
      return res.status(502).json({
        data: null,
        error: { code: 'AUDIO_GENERATION_FAILED', message: err instanceof Error ? err.message : 'Narration failed' },
      });
    }
  });

  router.post('/segment', async (req, res) => {
    const parsed = NarrateSegmentBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
    }
    try {
      const result = await narrateSegment(parsed.data.text, parsed.data.locale, parsed.data.voice, deps.narrateSegment);
      return res.json({ data: result, error: null });
    } catch (err) {
      return res.status(502).json({
        data: null,
        error: { code: 'AUDIO_GENERATION_FAILED', message: err instanceof Error ? err.message : 'Narration failed' },
      });
    }
  });

  router.get('/lesson/:id', async (req, res) => {
    const parsed = LessonManifestQuery.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query' } });
    }
    try {
      const row = await getLessonDocument(req.params.id as string, parsed.data.locale);
      if (!row) {
        return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No lesson document for that lesson_id/locale' } });
      }
      return res.json({ data: row.audio, error: null });
    } catch (err) {
      // getLessonDocument throws on a Vault 5xx/network failure (§1.14 — a
      // down Vault must never read as "manifest missing", so 404 stays
      // reserved for a genuinely absent row). A down Vault is an upstream
      // dependency failure, not an audiogen fault: answer 502 like the POST
      // sibling, with the repo's upstream-failure code.
      return res.status(502).json({
        data: null,
        error: { code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'Vault read failed' },
      });
    }
  });

  return router;
}
