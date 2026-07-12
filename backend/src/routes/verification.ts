import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import {
  grantRole,
  hasRole,
  insertAuditLog,
  insertParentVerification,
} from '../services/supabaseRest.js';

/*
 * POST /api/v1/verification/parent — the universal → parent (Tutor) upgrade.
 * Flow (Jesús, 2026-07-12): applicant form + ID photo → Guardian OCR verdict
 * (stateless, image never persisted) → on verified: parent_verifications row
 * + parent role grant (both service-role writes; the grant is audited by the
 * DB trigger). Failed attempts: audit entry with boolean checks only.
 */

const Fields = z.object({
  givenNames: z.string().trim().min(1).max(120),
  surnames: z.string().trim().min(1).max(120),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
    .refine((d) => {
      const age = (Date.now() - Date.parse(d)) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age < 120;
    }, 'Applicant must be an adult'),
  address: z.string().trim().min(1).max(240),
  documentType: z.enum(['national-id', 'passport', 'driver-license']).default('national-id'),
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

/*
 * Per-user attempt limiter — in-memory, per instance (acceptable single-
 * instance; move to a shared store when Core scales horizontally).
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) return true;
  recent.push(now);
  attempts.set(userId, recent);
  return false;
}

export interface VerificationVerdict {
  verified: boolean;
  checks: Record<string, boolean>;
}

export function verificationRouter(): Router {
  const router = Router();

  router.post('/parent', requireAuth, upload.single('document'), async (req, res) => {
    const user = authedUser(res);
    const parsed = Fields.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'A jpeg/png/webp "document" image is required');
    }
    if (await hasRole(user.id, 'parent')) {
      return fail(res, 409, 'ALREADY_VERIFIED', 'This account already has the Tutor role');
    }
    if (rateLimited(user.id)) {
      return fail(res, 429, 'RATE_LIMITED', 'Too many verification attempts — try again later');
    }

    // Forward to Guardian (stateless OCR verdict). The image buffer is
    // forwarded and dropped — Core never persists it either.
    const { PARENT_ID_CHECK_URL, INTERNAL_API_KEY } = getConfig();
    const form = new FormData();
    form.set('givenNames', parsed.data.givenNames);
    form.set('surnames', parsed.data.surnames);
    form.set('birthDate', parsed.data.birthDate);
    form.set('document', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), 'document');

    let verdict: VerificationVerdict;
    try {
      const guardianRes = await fetch(`${PARENT_ID_CHECK_URL}/internal/v1/verifications/parent`, {
        method: 'POST',
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        body: form,
      });
      const body = (await guardianRes.json().catch(() => null)) as
        | { data: VerificationVerdict | null; error: { code: string; message: string } | null }
        | null;
      if (guardianRes.status === 422) {
        return fail(res, 422, 'DOCUMENT_UNREADABLE', 'The document image could not be processed');
      }
      if (!guardianRes.ok || !body?.data) {
        return fail(res, 502, 'INTERNAL', 'Verification service unavailable'); // never fail open
      }
      verdict = body.data;
    } catch {
      return fail(res, 502, 'INTERNAL', 'Verification service unavailable');
    }

    if (!verdict.verified) {
      await insertAuditLog(user.id, 'parent_verification.failed', user.id, { checks: verdict.checks });
      return ok(res, { verified: false, checks: verdict.checks });
    }

    const stored = await insertParentVerification({
      user_id: user.id,
      given_names: parsed.data.givenNames,
      surnames: parsed.data.surnames,
      birth_date: parsed.data.birthDate,
      address: parsed.data.address,
      document_type: parsed.data.documentType,
      checks: verdict.checks,
    });
    if (!stored) return fail(res, 502, 'INTERNAL', 'Could not record the verification');

    const granted = await grantRole(user.id, 'parent', user.id);
    if (!granted) return fail(res, 502, 'INTERNAL', 'Could not grant the Tutor role');

    return ok(res, { verified: true, role: 'parent' });
  });

  return router;
}
