import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { matchDocument } from '../services/matching.js';
import type { RecognizeFn } from '../services/ocr.js';

/*
 * POST /internal/v1/verifications/parent — stateless verdict endpoint.
 * Internal-only (INTERNAL_API_KEY, enforced in app.ts). This service NEVER
 * touches the database and NEVER persists the image (multer memoryStorage,
 * buffer dropped when the request scope ends). Core owns all writes.
 */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const Fields = z.object({
  givenNames: z.string().trim().min(1).max(120),
  surnames: z.string().trim().min(1).max(120),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'birthDate must be a real date'),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

export function verificationsRouter(recognize: RecognizeFn): Router {
  const router = Router();

  router.post('/parent', upload.single('document'), async (req, res) => {
    const parsed = Fields.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
    }
    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      return res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'A jpeg/png/webp "document" image is required' },
      });
    }

    try {
      // The buffer is handed to OCR and never referenced again — no disk, no
      // logs, no outbound calls. Node reclaims it with the request.
      const text = await recognize(req.file.buffer);
      const result = matchDocument(text, parsed.data);
      return res.json({ data: result, error: null });
    } catch {
      // Deliberately no error detail: it could echo document content.
      return res.status(422).json({
        data: null,
        error: { code: 'DOCUMENT_UNREADABLE', message: 'The document image could not be processed' },
      });
    }
  });

  return router;
}
