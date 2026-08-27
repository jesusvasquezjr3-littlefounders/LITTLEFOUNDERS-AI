/*
 * Image inventory of the LIVE catalogue (988 published lessons, post-repair).
 * Everything here is measured from the documents that are in production now.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

// Usage: node image-inventory.mjs <work-dir>
// <work-dir> holds corpus/docs/<lesson_id>.json (exported documents),
// release/<lesson_id>.json (edited versions, optional) and final-cuts.json.
const S = process.argv[2];
if (!S) { console.error('usage: node image-inventory.mjs <work-dir>'); process.exit(1); }
const idx = Object.fromEntries(JSON.parse(readFileSync(`${S}/corpus/index.json`, 'utf8')).map((r) => [r.lesson_id, r]));
const cut = new Set(JSON.parse(readFileSync(`${S}/final-cuts.json`, 'utf8')));

const live = (id) => existsSync(`${S}/release/${id}.json`)
  ? JSON.parse(readFileSync(`${S}/release/${id}.json`, 'utf8'))
  : JSON.parse(readFileSync(`${S}/corpus/docs/${id}.json`, 'utf8'));

const imgToLessons = new Map();   // url -> Set(lesson)
const lessonImgCount = new Map(); // lesson -> distinct images
const slotsWanting = [];          // segments that render art but have none
let totalSlots = 0;

/*
 * Any key ENDING in `image_url` — not just the literal one. memory_flip carries
 * `a_image_url`/`b_image_url`, and matching only `image_url` undercounted the
 * catalogue and wrongly reported those segments as having no art.
 */
function collectImages(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => collectImages(n, out)); return; }
  for (const [k, v] of Object.entries(node)) {
    if (/image_url$/.test(k) && typeof v === 'string') out.push(v);
    else collectImages(v, out);
  }
}

// Types whose exercise depends on pictures to be answerable at all.
const IMAGE_CRITICAL = new Set(['picture_choice', 'memory_flip', 'flash_match']);

for (const f of readdirSync(`${S}/corpus/docs`)) {
  const id = f.replace('.json', '');
  if (cut.has(id)) continue;
  const doc = live(id).locales['es-MX'].document;
  const urls = [];
  collectImages(doc, urls);
  totalSlots += urls.length;
  lessonImgCount.set(id, new Set(urls).size);
  for (const u of urls) {
    if (!imgToLessons.has(u)) imgToLessons.set(u, new Set());
    imgToLessons.get(u).add(id);
  }
  // segments that are image-critical but carry no picture
  for (const seg of doc.segments) {
    if (!IMAGE_CRITICAL.has(seg.type)) continue;
    const segUrls = [];
    collectImages(seg, segUrls);
    if (segUrls.length === 0) {
      slotsWanting.push({ lesson_id: id, slug: idx[id].slug, adventure: idx[id].adventure, segment_id: seg.id, type: seg.type, xp: seg.xp || 0 });
    }
  }
}

const reuse = [...imgToLessons.entries()]
  .map(([url, s]) => ({ url, lessons: s.size, lesson_ids: [...s] }))
  .sort((a, b) => b.lessons - a.lessons);

const shared = reuse.filter((r) => r.lessons > 1);
const lessonsTouchedByReuse = new Set(shared.flatMap((r) => r.lesson_ids));
const noArt = [...lessonImgCount.entries()].filter(([, n]) => n === 0).map(([id]) => ({ lesson_id: id, slug: idx[id].slug, adventure: idx[id].adventure }));

const out = {
  live_lessons: lessonImgCount.size,
  total_image_slots: totalSlots,
  distinct_images: reuse.length,
  images_serving_more_than_one_lesson: shared.length,
  lessons_touched_by_a_shared_image: lessonsTouchedByReuse.size,
  redundant_slot_uses: totalSlots - reuse.length,
  lessons_with_zero_art: noArt.length,
  image_critical_segments_with_no_picture: slotsWanting.length,
  top_offenders: reuse.slice(0, 20).map((r) => ({ url: r.url, lessons: r.lessons })),
  reuse_histogram: shared.reduce((a, r) => { const b = r.lessons >= 10 ? '10+' : String(r.lessons); a[b] = (a[b] || 0) + 1; return a; }, {}),
};
writeFileSync(`${S}/image-inventory.json`, JSON.stringify({ ...out, shared, no_art: noArt, image_critical_missing: slotsWanting }, null, 2));
console.log(JSON.stringify(out, null, 2));
