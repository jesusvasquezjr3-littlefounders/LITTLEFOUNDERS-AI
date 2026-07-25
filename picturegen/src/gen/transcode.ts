import sharp from 'sharp';

/*
 * Storage transcode — qwen-image serves ~900 KB 1024×1024 PNGs; WebP q82 cuts
 * them to 15–99 KB (−96.9% measured across the live corpus, visually verified
 * transparent at 1:1 on the most detailed image, 2026-07-25). At course scale
 * that is the difference between a 1.5 GB and a 47 MB image catalog, and a
 * ~60× lighter download for a kid on a phone.
 *
 * Runs AFTER the pictorial verifier on purpose: qwen-vl always inspects the
 * original PNG bytes, so WebP support in the vision model never has to be
 * proven. Runs BEFORE the Depot upload so the content address is the WebP.
 */

export interface TranscodedImage {
  bytes: Buffer;
  contentType: string;
}

/**
 * Re-encode image bytes as WebP at the given quality. On ANY encode failure
 * the ORIGINAL bytes come back untouched: the generation was already paid for,
 * and a stored PNG is strictly better than a lost image. The fallback is loud
 * (console.warn) so a systematic encoder problem cannot silently regress the
 * catalog to PNG sizes.
 */
export async function transcodeToWebp(bytes: Buffer, contentType: string, quality: number): Promise<TranscodedImage> {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'image/webp') return { bytes, contentType };
  try {
    const webp = await sharp(bytes).webp({ quality }).toBuffer();
    return { bytes: webp, contentType: 'image/webp' };
  } catch (err) {
    console.warn(`[picturegen] webp transcode failed (${err instanceof Error ? err.message : err}) — storing original ${contentType}`);
    return { bytes, contentType };
  }
}
