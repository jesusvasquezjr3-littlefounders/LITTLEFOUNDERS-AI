import { writeFile } from 'node:fs/promises';
import { getConfig } from './env.js';
import { transcodeToWebp } from './gen/transcode.js';
import { uploadFile } from './filebase/client.js';

/*
 * backfill:webp — one-time (but re-runnable) storage migration: every PNG
 * asset in the picture_assets cache is re-encoded WebP (gen/transcode.ts,
 * same encoder the live pipeline now uses), re-uploaded to Depot, and its
 * cache row updated IN PLACE (url, file_id, bytes — prompt_hash untouched:
 * the REQUEST didn't change, so this is explicitly not a STYLE_VERSION bump).
 *
 * Cache rows must be rewritten in lockstep with the objects: a cache HIT
 * returns the stored url verbatim with zero Depot reads, so a backfill that
 * only converted files would keep serving stale PNG urls to every future hit
 * AND to coursegen's imageInheritance.
 *
 * Emits an old-url → new-url JSON map for coursegen's images:apply-map,
 * which rewrites the urls embedded in lesson documents (Forge owns those).
 *
 * Idempotent: rows already pointing at .webp are skipped, so a re-run after
 * a partial failure only touches what's left. Free — no paid API involved —
 * but it writes the DB and Depot, hence the --confirm gate.
 */

interface AssetRow {
  id: string;
  prompt_hash: string;
  url: string;
  file_id: string;
}

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function rest<T>(path: string, init: RestInit = {}): Promise<{ ok: boolean; status: number; body: T | null }> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text().catch(() => '');
  let body: T | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

async function listPngAssets(): Promise<AssetRow[]> {
  const rows: AssetRow[] = [];
  const PAGE = 500;
  for (let offset = 0; ; offset += PAGE) {
    const res = await rest<AssetRow[]>(
      `/picture_assets?select=id,prompt_hash,url,file_id&order=created_at.asc&limit=${PAGE}&offset=${offset}`,
    );
    if (!res.ok || !res.body) throw new Error(`picture_assets page read failed (HTTP ${res.status})`);
    rows.push(...res.body);
    if (res.body.length < PAGE) return rows;
  }
}

async function convertOne(row: AssetRow, quality: number): Promise<{ oldUrl: string; newUrl: string } | null> {
  const config = getConfig();
  const res = await fetch(row.url);
  if (!res.ok) throw new Error(`download failed HTTP ${res.status} for ${row.url}`);
  const png = Buffer.from(await res.arrayBuffer());

  const stored = await transcodeToWebp(png, 'image/png', quality);
  if (stored.contentType !== 'image/webp') throw new Error(`transcode fell back to original for ${row.url}`);

  const upload = await uploadFile(stored.bytes, `${row.prompt_hash}.webp`, 'image/webp', 'lesson-images', 'public', {
    filebaseUrl: config.FILEBASE_URL,
    internalKey: config.FILEBASE_INTERNAL_KEY,
  });

  const patch = await rest(`/picture_assets?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ url: upload.url, file_id: upload.id, bytes: upload.bytes }),
  });
  if (!patch.ok) throw new Error(`picture_assets update failed HTTP ${patch.status} for ${row.id}`);

  return { oldUrl: row.url, newUrl: upload.url };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const mapPath = args.find((a) => a.endsWith('.json')) ?? 'webp-url-map.json';
  const quality = getConfig().IMAGE_WEBP_QUALITY;

  const all = await listPngAssets();
  const pending = all.filter((r) => r.file_id.endsWith('.png'));
  console.log(`[backfill:webp] ${all.length} cache rows, ${pending.length} still PNG, quality=${quality}`);
  if (!confirm) {
    console.log('[backfill:webp] dry run — pass --confirm to convert. Nothing was written.');
    return;
  }

  const map: Record<string, string> = {};
  const failures: { id: string; reason: string }[] = [];
  let done = 0;

  // Small fixed pool — local Depot + local sharp, the DB is the only shared resource.
  const CONCURRENCY = 4;
  const queue = [...pending];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          const converted = await convertOne(row, quality);
          if (converted) map[converted.oldUrl] = converted.newUrl;
        } catch (err) {
          failures.push({ id: row.id, reason: err instanceof Error ? err.message : String(err) });
        }
        done += 1;
        if (done % 200 === 0) console.log(`[backfill:webp] ${done}/${pending.length}…`);
      }
    }),
  );

  await writeFile(mapPath, JSON.stringify(map, null, 1), 'utf8');
  console.log(`[backfill:webp] converted ${Object.keys(map).length}/${pending.length}, map written to ${mapPath}`);
  if (failures.length > 0) {
    console.error(`[backfill:webp] ${failures.length} FAILURE(S) — re-run to retry the remainder:`);
    for (const f of failures.slice(0, 10)) console.error(`  ${f.id}: ${f.reason}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[backfill:webp] fatal:', err);
  process.exitCode = 1;
});
