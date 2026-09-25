/*
 * Client API layer for OD-20 achievement sharing (Product 10 F.1).
 *
 * The share is an IMAGE the verified guardian receives from Core and sends
 * themselves: through the device share sheet when it accepts image files
 * (Web Share API level 2), or as a download otherwise. No link is created,
 * nothing is uploaded anywhere, and nothing here records who sees the
 * picture — Appendix L counts shares initiated (Core records one per
 * rendered image, by hand-off), never viewer reach.
 *
 * Transport-only and dependency-injected (fetch, navigator, document), so it
 * imports nothing from the legacy app (Bible 02 rule 23) and is testable
 * without a browser. Authorization is enforced by Core, never here.
 */

export type AchievementKind = 'course_badge' | 'streak' | 'goal_reached';
export type AchievementLocale = 'en-US' | 'es-MX' | 'pt-BR';
export type AchievementHandoff = 'share_sheet' | 'download';
export type AchievementShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

export interface AchievementImageRequest {
  kind: AchievementKind;
  courseSlug?: string;
  goalId?: string;
  locale: AchievementLocale;
}

export const ACHIEVEMENT_IMAGE_FILENAME = 'littlefounders-achievement.png';

type ShareNavigator = Pick<Navigator, 'share' | 'canShare'> | Partial<Pick<Navigator, 'share' | 'canShare'>>;

/**
 * What this device can do with the picture. A probe file stands in for the
 * real one so the choice is made BEFORE the request (Core counts the hand-off
 * the parent was offered) and the share call still happens inside the
 * click's user activation window.
 */
export function preferredHandoff(nav: ShareNavigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): AchievementHandoff {
  try {
    if (!nav?.share || !nav.canShare || typeof File === 'undefined') return 'download';
    const probe = new File([new Uint8Array(8)], ACHIEVEMENT_IMAGE_FILENAME, { type: 'image/png' });
    return nav.canShare({ files: [probe] }) ? 'share_sheet' : 'download';
  } catch {
    return 'download';
  }
}

export type AchievementImageResult = { ok: true; image: Blob } | { ok: false; code: string };

/** Asks Core for the rendered picture. Core re-verifies the guardian link and the achievement on every call. */
export async function requestAchievementImage(options: {
  baseUrl: string;
  token: string;
  kidId: string;
  request: AchievementImageRequest;
  handoff: AchievementHandoff;
  fetchImpl?: typeof fetch;
}): Promise<AchievementImageResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${options.baseUrl}/api/v1/family/kids/${encodeURIComponent(options.kidId)}/achievement-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options.request, handoff: options.handoff }),
    });
  } catch {
    return { ok: false, code: 'INTERNAL' };
  }
  if (response.ok && response.headers.get('content-type') === 'image/png') {
    try {
      const image = await response.blob();
      return image.size > 0 ? { ok: true, image } : { ok: false, code: 'INTERNAL' };
    } catch {
      return { ok: false, code: 'INTERNAL' };
    }
  }
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
  return { ok: false, code: typeof body?.error?.code === 'string' ? body.error.code : 'INTERNAL' };
}

function download(image: Blob, doc: Document): void {
  const url = URL.createObjectURL(image);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = ACHIEVEMENT_IMAGE_FILENAME;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  // The object URL is local to this tab; release it once the save has started.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Hands the picture to the parent. A dismissed share sheet is `cancelled`,
 * never a failure and never a download the parent did not ask for; any other
 * share-sheet refusal (for example an expired user activation) falls back to
 * a download so the parent still gets the picture.
 */
export async function handOffAchievementImage(
  image: Blob,
  handoff: AchievementHandoff,
  options: { title: string; nav?: ShareNavigator; doc?: Document },
): Promise<AchievementShareOutcome> {
  const nav = options.nav ?? (typeof navigator === 'undefined' ? undefined : navigator);
  const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
  if (handoff === 'share_sheet' && nav?.share && typeof File !== 'undefined') {
    const file = new File([image], ACHIEVEMENT_IMAGE_FILENAME, { type: 'image/png' });
    try {
      await nav.share({ files: [file], title: options.title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  if (!doc) return 'failed';
  try {
    download(image, doc);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** The whole action: choose the hand-off, fetch the picture, hand it over. */
export async function shareAchievementImage(options: {
  baseUrl: string;
  token: string;
  kidId: string;
  request: AchievementImageRequest;
  title: string;
  fetchImpl?: typeof fetch;
  nav?: ShareNavigator;
  doc?: Document;
}): Promise<AchievementShareOutcome> {
  const handoff = preferredHandoff(options.nav);
  const result = await requestAchievementImage({ ...options, handoff });
  if (!result.ok) return 'failed';
  return handOffAchievementImage(result.image, handoff, { title: options.title, nav: options.nav, doc: options.doc });
}
