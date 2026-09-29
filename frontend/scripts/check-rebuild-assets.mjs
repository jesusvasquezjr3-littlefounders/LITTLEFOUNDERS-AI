import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

/*
 * The rebuilt frontend's asset gate (Frontend Bible 07 §2, §3, §4, §6, §7, §8).
 *
 * Runs in `spec:check` and, with `--release`, before every build (`prebuild`).
 * One manifest, `src/rebuild/assets/manifest.json`, holds both classes:
 *
 *   Class A, the system glyphs (07 §2): at most 24 families, all from ONE
 *   declared source, drawn to the glyph spec (24 px grid, 2 px live-area
 *   padding, path data only, no fill). `design/glyphs.tsx` reads the drawings
 *   from the manifest and only mirrors their names for the type system; this
 *   gate fails if the two lists differ, if that module carries path data, if
 *   any other rebuilt file draws a 24 px icon, or if a rebuilt file imports an
 *   icon pack.
 *
 *   Class B, our own assets (07 §3, §6): every 07 §6 field, the size budget
 *   (§3.2), both colour modes, the no-text and token-colour checks that can be
 *   automated on SVG, real-model provenance and a catalogue pose for every
 *   Mentor render, a genuinely transparent background where the slot requires
 *   one (02 §9.7), a translated accessible name within 12 words for every
 *   informative asset (§8), every referenced asset registered and every
 *   registered asset referenced. `--release` also refuses any asset that is
 *   not `approved` (07 §6: "The build fails if a component references an
 *   asset that is not in the manifest, or one that is not approved").
 *
 *   Motion assets (type `lottie`, 07 §5; first one: OD-28 V-12, the lesson-complete
 *   confetti): the file parses as a Lottie, plays at most 60 fps for at most 3 s,
 *   carries no text, raster, gradient or expression, fills only with token
 *   colours under the same hue rules as SVG art, and names its reduced-motion
 *   `staticFrame`, which must be a registered, live SVG of the same slot.
 *   A row may name a checked-in `generator` (scripts/*.mjs exporting
 *   `synthesize(path)`); the file must equal its output byte for byte.
 *   Local draft override (S10L.2): `LF_LOCAL_DRAFT_ASSETS=1` with `--release`
 *   lets a LOCAL production build (`npm run build:local`) ship draft assets
 *   while the owner style review (OD-14) is pending. It only downgrades the
 *   one "not approved" refusal to a listed warning; every other check still
 *   fails the build. It is itself refused when the build runs in CI or on a
 *   hosting builder (CI, VERCEL, RAILWAY_ENVIRONMENT, NETLIFY), and it never
 *   applies to a `retired` asset, so the release build stays strict.
 *
 *   Sound cues (type `wav`) are class B rows too; 07 has no audio section, so
 *   how its §6 fields and §7 gate apply to a sound is written beside the
 *   SOUND_* constants below (first cue: OD-28 L-02, the gentle "not yet").
 *
 *   Raster art (types `png`, `render`, `webp`; OD-28 V-16): 07 §7's no-text check.
 *   Every live raster is read by OCR (scripts/ocr/rasterText.mjs: tesseract.js with
 *   the vendored eng/spa/por models, offline, zero spend) on a white and on a black
 *   background, and any word it reads is refused. REBUILD_ASSET_OCR=off skips only
 *   this check (the gate's own mutation tests use it for the cases about other rules).
 *
 * Not automated here: the human style review of the first asset of each family
 * (07 §7 item 2, OD-14).
 */
// REBUILD_ASSET_ROOT points the gate at a copy of the frontend tree (its own mutation tests do this).
const root = process.env.REBUILD_ASSET_ROOT ? resolve(process.env.REBUILD_ASSET_ROOT) : resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'public');
const rebuildRoot = resolve(root, 'src/rebuild');
const release = process.argv.includes('--release');
const draftOverride = /^(1|true|yes)$/i.test(process.env.LF_LOCAL_DRAFT_ASSETS ?? '');
const hostedBuilder = ['CI', 'VERCEL', 'RAILWAY_ENVIRONMENT', 'NETLIFY'].find((name) => {
  const value = process.env[name];
  return typeof value === 'string' && value !== '' && !/^(0|false)$/i.test(value);
});
const allowDrafts = release && draftOverride && !hostedBuilder;
const allowedDrafts = [];
const manifest = JSON.parse(readFileSync(resolve(root, 'src/rebuild/assets/manifest.json'), 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
if (release && draftOverride && hostedBuilder) {
  fail(`LF_LOCAL_DRAFT_ASSETS is a local-only override and is refused on a hosted or CI build (${hostedBuilder} is set)`);
}

/* ---------------------------------------------------------------- sources */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const sourceFiles = walk(rebuildRoot).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file));
const sources = new Map(sourceFiles.map((file) => [relative(root, file).split(sep).join('/'), readFileSync(file, 'utf8')]));
// Sound cues are played from anywhere in the app (the lesson player's `sfx.ts` is outside src/rebuild), so every
// source file is scanned for a `/sounds/…wav` literal. Only WAV is registered: the legacy MP3 set predates the manifest.
const soundRefs = [];
const scanSounds = (file, text) => { for (const m of text.matchAll(/['"`](\/sounds\/[^'"`\s]+?\.wav)['"`]/g)) soundRefs.push({ file, literal: m[1] }); };
for (const [file, text] of sources) scanSounds(file, text);
// Everything else in the app that may reference a rebuilt asset path.
for (const file of walk(resolve(root, 'src')).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith(rebuildRoot))) {
  const text = readFileSync(file, 'utf8');
  scanSounds(relative(root, file).split(sep).join('/'), text);
  if (text.includes('/rebuild/')) sources.set(relative(root, file).split(sep).join('/'), text);
}

/* ------------------------------------------------------- class A: glyphs */
// The 19 of 07 §1/§2 (show and hide are one family); up to 5 more with a reason.
const STARTING_LIST = ['close', 'back', 'menu', 'chevron', 'check', 'cross', 'plus', 'minus', 'show', 'hide', 'search', 'settings', 'info', 'warning', 'external', 'microphone', 'send', 'play', 'pause', 'refresh'];
const GLYPH_BUDGET = 24;
const GLYPH_SOURCE = 'littlefounders-in-house';
const ICON_PACKS = /from\s+['"](lucide-react|react-icons[^'"]*|@heroicons\/[^'"]+|@mui\/icons-material[^'"]*|@tabler\/icons[^'"]*|@phosphor-icons\/[^'"]+|feather-icons|react-feather|@fortawesome\/[^'"]+|@radix-ui\/react-icons|@iconify\/[^'"]+|@dicebear\/[^'"]+)['"]/;

/** Every point a path visits, curves and arcs sampled, so its extent can be measured. */
function pathPoints(d) {
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(d)) throw new Error('illegal characters');
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const points = [];
  let i = 0, command = '', x = 0, y = 0, startX = 0, startY = 0, lastControl = null;
  const number = () => { const value = Number(tokens[i++]); if (!Number.isFinite(value)) throw new Error('bad number'); return value; };
  const sample = (fn, steps = 24) => { for (let s = 1; s <= steps; s++) points.push(fn(s / steps)); };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    else if (!command) throw new Error('number before command');
    const rel = command === command.toLowerCase(), upper = command.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (upper === 'Z') { x = startX; y = startY; points.push([x, y]); lastControl = null; command = ''; continue; }
    if (upper === 'M') { x = ox + number(); y = oy + number(); startX = x; startY = y; points.push([x, y]); command = rel ? 'l' : 'L'; lastControl = null; continue; }
    if (upper === 'L') { x = ox + number(); y = oy + number(); points.push([x, y]); lastControl = null; continue; }
    if (upper === 'H') { x = ox + number(); points.push([x, y]); lastControl = null; continue; }
    if (upper === 'V') { y = oy + number(); points.push([x, y]); lastControl = null; continue; }
    if (upper === 'C' || upper === 'S') {
      const [x1, y1] = upper === 'C' ? [ox + number(), oy + number()] : lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
      const x2 = ox + number(), y2 = oy + number(), ex = ox + number(), ey = oy + number(), sx = x, sy = y;
      sample((t) => { const u = 1 - t; return [u ** 3 * sx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * ex, u ** 3 * sy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * ey]; });
      x = ex; y = ey; lastControl = [x2, y2]; continue;
    }
    if (upper === 'Q' || upper === 'T') {
      const [x1, y1] = upper === 'Q' ? [ox + number(), oy + number()] : lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
      const ex = ox + number(), ey = oy + number(), sx = x, sy = y;
      sample((t) => { const u = 1 - t; return [u * u * sx + 2 * u * t * x1 + t * t * ex, u * u * sy + 2 * u * t * y1 + t * t * ey]; });
      x = ex; y = ey; lastControl = [x1, y1]; continue;
    }
    if (upper === 'A') {
      let rx = Math.abs(number()), ry = Math.abs(number());
      const phi = number() * Math.PI / 180, large = number() !== 0, sweep = number() !== 0, ex = ox + number(), ey = oy + number();
      // SVG 1.1 F.6.5: endpoint to centre parameterisation.
      const cos = Math.cos(phi), sin = Math.sin(phi), dx = (x - ex) / 2, dy = (y - ey) / 2;
      const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
      const lambda = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2;
      if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
      const sign = large === sweep ? -1 : 1;
      const numerator = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2;
      const coef = sign * Math.sqrt(Math.max(0, numerator / (rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2)));
      const cxp = coef * rx * y1p / ry, cyp = -coef * ry * x1p / rx;
      const cx = cos * cxp - sin * cyp + (x + ex) / 2, cy = sin * cxp + cos * cyp + (y + ey) / 2;
      const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!sweep && delta > 0) delta -= 2 * Math.PI;
      if (sweep && delta < 0) delta += 2 * Math.PI;
      sample((t) => { const a = theta + delta * t; return [cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos]; }, 48);
      x = ex; y = ey; lastControl = null; continue;
    }
    throw new Error(`unsupported command ${command}`);
  }
  return points;
}

const glyphRows = manifest.filter((row) => row.class === 'A');
const glyphNames = [];
if (glyphRows.length > GLYPH_BUDGET) fail(`Glyph budget exceeded: ${glyphRows.length} families (max ${GLYPH_BUDGET}, 07 §2)`);
for (const row of glyphRows) {
  if (row.type !== 'glyph' || row.slot !== 'system.glyph' || row.altKey !== 'decorative' || row.modes !== 'both') fail(`Class A row is not a decorative system glyph for both modes: ${row.id}`);
  if (row.source !== GLYPH_SOURCE) fail(`Glyph from a second source (07 §2 "never mix sets"): ${row.id} declares ${row.source}`);
  if ('path' in row || 'reviewStatus' in row) fail(`Glyph rows carry their drawing, not a file or a review status: ${row.id}`);
  const names = Object.keys(row.names ?? {});
  if (!names.length || row.id !== `glyph.${names.join('-')}`) fail(`Glyph family id must name its glyphs: ${row.id}`);
  const extra = names.filter((name) => !STARTING_LIST.includes(name));
  if (extra.length && !row.reason) fail(`Glyph outside the 07 §2 starting list needs a reason: ${row.id}`);
  for (const name of names) {
    glyphNames.push(name);
    const paths = row.names[name];
    if (!Array.isArray(paths) || !paths.length) { fail(`Glyph without drawing: ${name}`); continue; }
    for (const d of paths) {
      try {
        const points = pathPoints(d);
        if (points.length < 2) fail(`Glyph path draws nothing: ${name}`);
        for (const [px, py] of points) if (px < 2 - 1e-6 || px > 22 + 1e-6 || py < 2 - 1e-6 || py > 22 + 1e-6) { fail(`Glyph leaves the 20 px live area (07 §2): ${name} at ${px.toFixed(2)},${py.toFixed(2)}`); break; }
      } catch (error) { fail(`Glyph path is not plain path data (${error.message}): ${name}`); }
    }
  }
}
if (new Set(glyphNames).size !== glyphNames.length) fail('Duplicate glyph name in the manifest');
for (const name of STARTING_LIST) if (!glyphNames.includes(name)) fail(`Starting-list glyph missing from the manifest: ${name}`);
const glyphModule = sources.get('src/rebuild/design/glyphs.tsx') ?? '';
const mirrored = [...(glyphModule.match(/GLYPH_NAMES = \[([\s\S]*?)\] as const/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
if (mirrored.join() !== glyphNames.join()) fail(`glyphs.tsx GLYPH_NAMES does not mirror the manifest (${mirrored.join()} vs ${glyphNames.join()})`);
if (/['"`]M\s*[\d.-]/.test(glyphModule)) fail('glyphs.tsx carries path data; the manifest is the one glyph source');
for (const [file, text] of sources) {
  if (!file.startsWith('src/rebuild/')) continue;
  if (file !== 'src/rebuild/design/glyphs.tsx' && /viewBox=["'{]\s*["'`]?0 0 24 24/.test(text)) fail(`Off-list 24 px icon drawn outside the glyph set: ${file}`);
  if (ICON_PACKS.test(text)) fail(`Icon pack imported into the rebuilt frontend (07 §1): ${file}`);
}

/* -------------------------------------------------- class B: own assets */
const TYPES = new Set(['svg', 'webp', 'png', 'lottie', 'render', 'wav']);
const MODES = new Set(['both', 'light', 'dark']);
const REVIEW = new Set(['draft', 'approved', 'retired']);
// 07 §7 item 2: the families whose first asset needs the owner's style approval. `sounds` is ours, not 07's (below).
// W2 profile lane: the cartoon avatar parts and the profile covers (E.12) are two more families of our own, each with its first-asset style review.
// Gap-fix round 2 (02 D8, 07 §1): `brand` holds the one own-asset mark the favicons, app icons and structured-data logo are drawn from.
// Gap-fix round 2: the OD-20 achievement image's marks are a family of their own (`achievement-share`), drawn by Depot.
const FAMILIES = new Set(['character-renders', 'badges', 'course-icons', 'pockets', 'empty-states', 'scenes', 'task-categories', 'coins', 'celebration-motion', 'avatar-parts', 'profile-covers', 'sounds', 'brand', 'achievement-share']);
const BUDGET_KB = { svg: 6, webp: 120, png: 120, lottie: 150, render: 150, wav: 32 };
const RASTER = new Set(['png', 'render', 'webp']);
let ocrRead = 0;
const rasters = []; // live raster art, read by OCR after the per-row checks (07 §7)
/*
 * Sound cues (type `wav`, family `sounds`; first one: the gentle "not yet" cue, OD-28 L-02). Frontend 07 has no
 * audio section, so its §6 fields and §7 review gate are applied as follows, and nothing in 07 is relaxed for images:
 *   - They live under /sounds/ (public/sounds, beside the legacy cues), not /rebuild/, and are found by a
 *     `/sounds/…wav` literal anywhere in src (above).
 *   - `modes` is `both` (a sound has no colour mode) and `altKey` is `decorative`: a cue is never the only signal,
 *     the visible state (cross mark, hint banner) carries the meaning (02 §8 "not yet"). No aspect or background.
 *   - Budget 32 KB. The file is a 16-bit PCM mono WAV of at most SOUND_MAX_SECONDS, peaking at or below
 *     SOUND_PEAK_DBFS (a gentle cue, B.26: no non-verbal shame signal, so nothing loud), not silent, and it starts
 *     and ends near zero (no click).
 *   - `generator` (optional) names a checked-in script under scripts/ that exports `synthesize()`; the file must
 *     equal its output byte for byte, so the asset cannot drift from its zero-spend generator (OD-23).
 *   - A `draft` sound that declares `wiring` (where the UI will play it once the owner approves it) is exempt from
 *     "every live asset is referenced" while it awaits review. Nothing else is: an approved sound must be referenced,
 *     and `--release` still refuses the draft.
 */
const SOUND_HOME = '/sounds/';
const SOUND_MAX_SECONDS = 1;
const SOUND_PEAK_DBFS = -9;
const SOUND_FLOOR_DBFS = -40;
const SOUND_EDGE = 0.01; // |first| and |last| sample, as a fraction of full scale
const frontendRoot = resolve(import.meta.dirname, '..'); // generators are code: always this checkout's, never the tree under test

/** Minimal RIFF/WAVE reader: format fields and 16-bit samples of the first `data` chunk; unknown chunks are skipped. */
function readWav(bytes) {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12, format = null, data = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), body = bytes.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ' && body.length >= 16) format = { encoding: body.readUInt16LE(0), channels: body.readUInt16LE(2), sampleRate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    else if (id === 'data' && !data) data = body;
    offset += 8 + size + (size % 2);
  }
  if (!format || !data) return null;
  return { ...format, samples: format.bits === 16 ? new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2))) : null };
}
const MENTORS = ['rho', 'zara', 'liruf', 'dina'];
const AVATAR_SLOT = 'mentor.avatar';
const poseCatalogue = new Set([...readFileSync(resolve(root, 'src/tutor-scene/poseLibrary.ts'), 'utf8')
  .matchAll(/\{\s*id:\s*'([^']+)',\s*category:/g)].map((match) => match[1]));
if (poseCatalogue.size < 10) fail('Pose catalogue could not be read');
const tokenSheet = readFileSync(resolve(root, 'src/rebuild/design/tokens.css'), 'utf8');
const tokenColours = new Set([...tokenSheet.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()));
// 07 §3: "only the token hues", "at most 3 hues plus ink per icon", reserved hues keep their meaning (02 §4.2):
// the accent is the call to action only and error red never appears in art. Each token colour maps to its hue
// family (`mint-ridge` -> mint, `warning` is an alias of reward); neutrals (base, surface, content, ink, `on-*`) are not hues.
const HUES = ['primary', 'accent', 'reward', 'success', 'error', 'sky', 'mint', 'berry'];
const hueOf = new Map();
for (const [, name, hex] of tokenSheet.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)) {
  const family = name.replace(/^on-.*/, '').replace(/-(?:ridge|strong|soft)$/, '').replace(/^warning$/, 'reward');
  const value = hex.toLowerCase();
  if (!HUES.includes(family)) hueOf.set(value, null); // a neutral wins over a hue that shares its value (white)
  else if (!hueOf.has(value)) hueOf.set(value, family);
}
// The motion tokens a motion asset may name (04 §2): durations and easings from the generated sheet and system.css.
const motionTokenNames = new Set([...(tokenSheet + readFileSync(resolve(root, 'src/rebuild/design/system.css'), 'utf8')).matchAll(/(--(?:dur|ease)-[\w-]+)\s*:/g)].map((m) => m[1]));
const locales = ['en-US', 'es-MX', 'pt-BR'];
// Every rebuilt namespace (`src/i18n/<locale>/rebuild-<lane>.json`, one per wave-2 lane), merged: an altKey names its full key path.
const rebuildCopy = (locale) => Object.assign({}, ...readdirSync(resolve(root, `src/i18n/${locale}`)).filter((file) => /^rebuild-[a-z]+\.json$/.test(file)).sort()
  .map((file) => JSON.parse(readFileSync(resolve(root, `src/i18n/${locale}/${file}`), 'utf8'))));
const copy = Object.fromEntries(locales.map((locale) => [locale, rebuildCopy(locale)]));
const lookup = (object, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), object);
const words = (text) => (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;

/** Minimal PNG reader (8-bit, non-interlaced): enough to measure size, colour type and alpha. */
function readPng(bytes) {
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  let offset = 8, width = 0, height = 0, depth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colourType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType];
  if (depth !== 8 || interlace !== 0 || !channels) return { width, height, colourType, pixels: null };
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)], line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? pixels[row * stride + i - channels] : 0, b = row ? pixels[(row - 1) * stride + i] : 0;
      const c = i >= channels && row ? pixels[(row - 1) * stride + i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a; else if (filter === 2) value += b; else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      pixels[row * stride + i] = value & 255;
    }
  }
  return { width, height, colourType, channels, pixels };
}

// A translation key is copy, not an asset id: `lesson.results.saving` is the `results.saving` entry of the
// en-US `lesson` namespace file. Legacy surfaces that import a rebuilt module (so their text is scanned)
// carry such keys (plural forms included); a key that resolves in the namespace bundles is never read as an asset reference.
const i18nRoot = resolve(root, 'src/i18n/en-US');
const namespaces = Object.fromEntries(readdirSync(i18nRoot).filter((name) => name.endsWith('.json'))
  .map((name) => [name.slice(0, -5), JSON.parse(readFileSync(resolve(i18nRoot, name), 'utf8'))]));
const isTranslationKey = (literal) => {
  const stem = literal.split('${')[0].replace(/\.$/, '');
  const node = lookup(namespaces, stem);
  if (literal.includes('${')) return node !== null && typeof node === 'object';
  // i18next plurals: `lesson.intro.minutes` resolves through `minutes_one` / `minutes_other`.
  return node !== undefined || lookup(namespaces, `${stem}_other`) !== undefined;
};
// Every literal (or template) under /rebuild/ in the app, as a pattern: `${…}` matches any segment text.
const pattern = (literal) => new RegExp(`^${literal.split(/\$\{[^}]*\}/).map((part) => part.replace(/[.*+?^()|[\]\\/]/g, '\\$&')).join('[^/]*')}$`);
const pathRefs = [], idRefs = [];
for (const [file, text] of sources) {
  for (const m of text.matchAll(/['"`](\/rebuild\/[^'"`\s]+?\.(?:png|webp|svg|json|lottie))['"`]/g)) pathRefs.push({ file, literal: m[1], re: pattern(m[1]) });
  for (const m of text.matchAll(/['"`]((?:lesson|mentor|badge|course|pocket|empty|scene|task|coin|money|celebration)\.[a-z0-9.${}-]+)['"`]/g)) {
    if (!isTranslationKey(m[1])) idRefs.push({ file, literal: m[1], re: pattern(m[1]) });
  }
}

const classB = manifest.filter((row) => row.class !== 'A');

/*
 * The Depot achievement template (OD-20; gap-fix round 2). The image a verified parent sends out is drawn by
 * Depot (filebase/src/lib/badge.ts) from the marks inlined in filebase/src/lib/badgeArt.ts. Each mark is a
 * registered class B asset of the `achievement-share` family, so the owner's style review applies to it: the
 * inlined body must equal its registered SVG (whitespace aside), that inlining is the asset's reference, and
 * both template files may name only token colours, with no gradient, opacity tint or emoji (07 sections 1, 3).
 */
const DEPOT_FAMILY = 'achievement-share';
const depotFiles = ['filebase/src/lib/badge.ts', 'filebase/src/lib/badgeArt.ts'];
const depotSource = Object.fromEntries(depotFiles.map((file) => {
  try { return [file, readFileSync(resolve(frontendRoot, '..', file), 'utf8')]; } catch { fail(`Depot achievement template missing: ${file}`); return [file, '']; }
}));
const depotArt = depotSource['filebase/src/lib/badgeArt.ts'];
const depotReferenced = new Set();
for (const [file, text] of Object.entries(depotSource)) {
  for (const m of text.matchAll(/#[0-9a-f]{3,8}\b/gi)) if (!tokenColours.has(m[0].toLowerCase())) fail(`Depot template colour ${m[0]} is not a token colour (07 section 3): ${file}`);
  if (/linearGradient|radialGradient|opacity=|\bopacity:/i.test(text)) fail(`Depot template uses a gradient or an opacity tint (02 rules 2, 3): ${file}`);
  if (/\p{Extended_Pictographic}/u.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/PICTOGRAPHIC = .*$/m, ''))) fail(`Depot template carries an emoji (07 section 1): ${file}`);
}
for (const [, id] of depotArt.matchAll(/assetId:\s*'([^']+)'/g)) {
  const asset = classB.find((row) => row.id === id && row.reviewStatus !== 'retired');
  if (!asset) { fail(`Depot draws an unregistered or retired mark: ${id}`); continue; }
  if (asset.reviewFamily !== DEPOT_FAMILY || asset.type !== 'svg') { fail(`A Depot achievement mark is an SVG of the ${DEPOT_FAMILY} family: ${id}`); continue; }
  let svg = '';
  try { svg = readFileSync(resolve(publicRoot, `.${asset.path}`), 'utf8'); } catch { continue; }
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!depotArt.includes(`body: '${inner}'`)) fail(`Depot's inlined mark differs from its registered SVG; copy it again: ${id}`);
  else depotReferenced.add(id);
}
for (const asset of classB) if (asset.reviewFamily === DEPOT_FAMILY && asset.reviewStatus !== 'retired' && !depotReferenced.has(asset.id)) {
  fail(`An ${DEPOT_FAMILY} asset must be the mark Depot draws (filebase/src/lib/badgeArt.ts): ${asset.id}`);
}

const ids = new Set(), paths = new Set();
for (const asset of classB) {
  const where = asset.id ?? asset.path ?? JSON.stringify(asset).slice(0, 60);
  if (asset.class !== 'B') { fail(`Invalid asset class: ${where}`); continue; }
  if (ids.has(asset.id)) fail(`Duplicate asset id: ${asset.id}`);
  if (paths.has(asset.path)) fail(`Duplicate asset path: ${asset.path}`);
  ids.add(asset.id); paths.add(asset.path);
  // 07 §6 fields.
  for (const field of ['id', 'type', 'path', 'slot', 'modes', 'altKey', 'generatedBy', 'reviewStatus', 'reviewFamily']) if (typeof asset[field] !== 'string' || !asset[field]) fail(`Manifest field ${field} missing: ${where}`);
  if (!TYPES.has(asset.type)) fail(`Unknown asset type ${asset.type}: ${where}`);
  if (!MODES.has(asset.modes)) fail(`Unknown modes ${asset.modes}: ${where}`);
  if (!REVIEW.has(asset.reviewStatus)) fail(`Unknown review status ${asset.reviewStatus}: ${where}`);
  if (!FAMILIES.has(asset.reviewFamily)) fail(`Unknown review family ${asset.reviewFamily}: ${where}`);
  if ((asset.reviewStatus === 'approved') !== (typeof asset.approvedBy === 'string' && asset.approvedBy.length > 0)) fail(`approvedBy must be set exactly when approved: ${where}`);
  if (typeof asset.sizesKb !== 'number' || !Array.isArray(asset.motionTokens)) fail(`sizesKb and motionTokens are required: ${where}`);
  if (asset.type === 'lottie' && !asset.staticFrame) fail(`A Lottie needs its reduced-motion static frame (07 §5): ${where}`);
  if (asset.aspect && !/^\d+:\d+$/.test(asset.aspect)) fail(`Invalid aspect: ${where}`);
  // 07 §8: an informative asset has a translated name within 12 words (x1.25 for es/pt).
  if (asset.altKey !== 'decorative') for (const locale of locales) {
    const text = lookup(copy[locale], asset.altKey);
    if (typeof text !== 'string' || !text.trim()) fail(`Accessible name ${asset.altKey} missing in ${locale}: ${where}`);
    else if (words(text) > Math.ceil(12 * (locale === 'en-US' ? 1 : 1.25))) fail(`Accessible name over 12 words in ${locale}: ${where}`);
  }
  if (asset.type === 'render') {
    if (!MENTORS.includes(asset.character)) fail(`Render of an unknown character: ${where}`);
    if (asset.sourceModel !== `/scenes/${asset.character}.glb`) fail(`Render not from the character's own model: ${where}`);
    if (!poseCatalogue.has(asset.poseId)) fail(`Render pose is not in the pose catalogue: ${where}`);
    if (asset.reviewFamily !== 'character-renders') fail(`A Mentor render belongs to the character-renders family: ${where}`);
  }
  if (asset.slot === AVATAR_SLOT && (asset.type !== 'render' || asset.aspect !== '1:1' || asset.background !== 'transparent' || asset.altKey !== 'decorative')) {
    fail(`An avatar is a square, transparent, decorative real-model render (02 §9.7; the name beside it is the label): ${where}`);
  }
  const sound = asset.type === 'wav';
  if (sound !== (asset.reviewFamily === 'sounds')) fail(`A sound cue is a wav in the sounds family, and only a sound is: ${where}`);
  if (sound && (asset.modes !== 'both' || asset.altKey !== 'decorative' || 'aspect' in asset || 'background' in asset)) {
    fail(`A sound cue is decorative in both modes, with no aspect or background; the visible state carries the meaning: ${where}`);
  }
  if ('wiring' in asset && (!sound || typeof asset.wiring !== 'string' || !asset.wiring.trim())) fail(`wiring is a sound cue's planned call site: ${where}`);
  if (typeof asset.path !== 'string') continue;
  const home = sound ? SOUND_HOME : '/rebuild/';
  const file = resolve(publicRoot, `.${asset.path}`);
  if (!asset.path.startsWith(home) || !file.startsWith(resolve(publicRoot, `.${home}`) + sep)) { fail(`Asset outside public${home}: ${asset.path}`); continue; }
  let bytes;
  try { bytes = readFileSync(file); } catch { fail(`Missing or unreadable asset: ${asset.path}`); continue; }
  const kb = Math.ceil(statSync(file).size / 1024);
  if (kb > asset.sizesKb) fail(`Asset exceeds its declared size (${kb} KB > ${asset.sizesKb}): ${asset.path}`);
  if (kb > BUDGET_KB[asset.type] && !asset.budgetReason) fail(`Asset over the 07 §3.2 budget (${kb} KB > ${BUDGET_KB[asset.type]}) without a reason: ${asset.path}`);
  if (RASTER.has(asset.type) && asset.reviewStatus !== 'retired') rasters.push({ path: asset.path, bytes });
  if (asset.type === 'render' || asset.type === 'png') {
    const png = readPng(bytes);
    if (!png) { fail(`Not a PNG: ${asset.path}`); continue; }
    if (asset.aspect) {
      const [w, h] = asset.aspect.split(':').map(Number);
      if (Math.abs(png.width / png.height - w / h) > 0.01) fail(`Asset aspect differs from the manifest: ${asset.path}`);
    }
    if (asset.background === 'transparent') {
      if (png.colourType !== 6 || !png.pixels) { fail(`A transparent slot needs an 8-bit RGBA PNG: ${asset.path}`); continue; }
      const alpha = (x, y) => png.pixels[(y * png.width + x) * 4 + 3];
      let clear = 0, solid = 0;
      for (let i = 3; i < png.pixels.length; i += 4) { if (png.pixels[i] === 0) clear++; else if (png.pixels[i] === 255) solid++; }
      const total = png.width * png.height;
      const corners = [alpha(0, 0), alpha(png.width - 1, 0), alpha(0, png.height - 1), alpha(png.width - 1, png.height - 1)];
      if (corners.some((a) => a !== 0) || clear / total < 0.15) fail(`Background is not transparent (02 §9.7): ${asset.path}`);
      if (solid / total < 0.2) fail(`Render is nearly empty: ${asset.path}`);
    }
  } else if (asset.type === 'svg') {
    const svg = bytes.toString('utf8');
    if (!svg.startsWith('<svg ') || /<(script|image|foreignObject|text|tspan|linearGradient|radialGradient|filter)\b/i.test(svg) || /\bon[a-z]+=/i.test(svg)) {
      fail(`SVG must be plain in-house shapes: no script, image, text, gradient or filter (07 §3): ${asset.path}`);
    }
    for (const m of svg.matchAll(/#[0-9a-f]{3,8}\b/gi)) if (!tokenColours.has(m[0].toLowerCase())) fail(`SVG colour ${m[0]} is not a token colour (07 §3, §7): ${asset.path}`);
    const hues = new Set([...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => hueOf.get(m[0].toLowerCase())).filter(Boolean));
    if (hues.has('error')) fail(`Error red never appears in our own art; it means system errors only (07 §3, 02 §4.2): ${asset.path}`);
    if (hues.has('accent')) fail(`The accent is the call to action only, never art (02 §4.2): ${asset.path}`);
    if (hues.size > 3) fail(`More than 3 hues in one asset (07 §3): ${[...hues].join(', ')} in ${asset.path}`);
    if (/\brgba?\(|\bhsla?\(/i.test(svg)) fail(`SVG colour outside the token palette: ${asset.path}`);
  } else if (asset.type === 'lottie') {
    let anim = null;
    try { anim = JSON.parse(bytes.toString('utf8')); } catch { fail(`Not a Lottie JSON: ${asset.path}`); }
    if (anim) {
      const frames = anim.op - anim.ip;
      if (!(anim.fr > 0 && anim.fr <= 60)) fail(`Lottie frame rate must be at most 60 fps (07 §3.2): ${asset.path}`);
      if (!(frames > 0) || frames / anim.fr > 3) fail(`Lottie longer than 3 s or empty (07 §3.2, §5): ${asset.path}`);
      if (asset.aspect) {
        const [w, h] = asset.aspect.split(':').map(Number);
        if (!(anim.w > 0 && anim.h > 0) || Math.abs(anim.w / anim.h - w / h) > 0.01) fail(`Lottie aspect differs from the manifest: ${asset.path}`);
      }
      const layers = [...(anim.layers ?? []), ...(anim.assets ?? []).flatMap((entry) => entry.layers ?? [])];
      if (layers.some((layer) => layer.ty === 5)) fail(`A motion asset never carries text (07 §5): ${asset.path}`);
      if (layers.some((layer) => layer.ty === 2) || (anim.assets ?? []).some((entry) => typeof entry.p === 'string')) fail(`Lottie embeds a raster image; flat in-house shapes only: ${asset.path}`);
      const colours = [];
      const visit = (node) => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (typeof node.x === 'string') fail(`Lottie expression found; motion is keyframed only: ${asset.path}`);
        if (node.ty === 'gf' || node.ty === 'gs') fail(`Lottie gradient; token fills only (02 rule 2, 07 §3): ${asset.path}`);
        if ((node.ty === 'fl' || node.ty === 'st') && node.c) {
          const values = node.c.a ? (node.c.k ?? []).map((key) => key.s) : [node.c.k];
          for (const value of values) {
            if (!Array.isArray(value) || value.length < 3) { fail(`Lottie colour is not an RGB value: ${asset.path}`); continue; }
            colours.push(`#${value.slice(0, 3).map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`);
          }
        }
        Object.values(node).forEach(visit);
      };
      visit(anim.layers ?? []);
      if (!colours.length) fail(`Lottie fills nothing: ${asset.path}`);
      for (const colour of colours) if (!tokenColours.has(colour)) fail(`Lottie colour ${colour} is not a token colour (07 §3, §7): ${asset.path}`);
      const hues = new Set(colours.map((colour) => hueOf.get(colour)).filter(Boolean));
      if (hues.has('error')) fail(`Error red never appears in our own art (07 §3, 02 §4.2): ${asset.path}`);
      if (hues.has('accent')) fail(`The accent is the call to action only, never art (02 §4.2): ${asset.path}`);
      if (hues.size > 3) fail(`More than 3 hues in one asset (07 §3): ${[...hues].join(', ')} in ${asset.path}`);
    }
    if (!asset.motionTokens.length || asset.motionTokens.some((token) => !motionTokenNames.has(token))) fail(`A motion asset maps to the motion tokens (07 §5): ${where}`);
    const frame = classB.find((entry) => entry.path === asset.staticFrame);
    if (!frame || frame.type !== 'svg' || frame.reviewStatus === 'retired' || frame.slot !== asset.slot) fail(`A Lottie's static frame is a registered, live SVG of the same slot (07 §5): ${where}`);
  } else if (sound) {
    const wav = readWav(bytes);
    if (!wav || wav.encoding !== 1 || wav.channels !== 1 || wav.bits !== 16 || !wav.samples?.length || wav.sampleRate < 8000 || wav.sampleRate > 48000) {
      fail(`Not a 16-bit PCM mono WAV: ${asset.path}`);
    } else {
      const seconds = wav.samples.length / wav.sampleRate;
      let peak = 0;
      for (const value of wav.samples) peak = Math.max(peak, Math.abs(value));
      const dbfs = 20 * Math.log10(Math.max(peak, 1) / 32768);
      if (seconds > SOUND_MAX_SECONDS) fail(`Sound cue longer than ${SOUND_MAX_SECONDS} s (${seconds.toFixed(2)} s): ${asset.path}`);
      if (dbfs > SOUND_PEAK_DBFS) fail(`Sound cue peaks above ${SOUND_PEAK_DBFS} dBFS (${dbfs.toFixed(1)} dBFS; a gentle cue, B.26): ${asset.path}`);
      if (dbfs < SOUND_FLOOR_DBFS) fail(`Sound cue is silent (${dbfs.toFixed(1)} dBFS): ${asset.path}`);
      if (Math.max(Math.abs(wav.samples[0]), Math.abs(wav.samples[wav.samples.length - 1])) > SOUND_EDGE * 32768) fail(`Sound cue starts or ends on a click (no fade): ${asset.path}`);
    }
  }
  // Any generated asset (a sound cue, the confetti and its still) must equal its zero-spend generator's output (OD-23).
  if ('generator' in asset) {
    if (typeof asset.generator !== 'string' || !/^scripts\/[a-z0-9-]+\.mjs$/.test(asset.generator)) fail(`A generator is a script under scripts/: ${where}`);
    else {
      try {
        const { synthesize } = await import(pathToFileURL(resolve(frontendRoot, asset.generator)).href);
        if (!Buffer.from(synthesize(asset.path)).equals(bytes)) fail(`Asset does not match its generator ${asset.generator}; rerun it: ${asset.path}`);
      } catch (error) { fail(`Generator ${asset.generator} could not synthesize (${error.message}): ${where}`); }
    }
  }
  // Referenced somewhere, by path or id (an avatar is found by its slot; a sound by its /sounds/ path).
  // A Lottie's static frame is shown by the component that shows the Lottie (07 §5), so it is referenced with it.
  // An asset used outside the app (the brand mark: favicons, app icons, the structured-data logo) names its
  // `consumer`, a checked-in script under scripts/ that must carry the asset's path literally.
  let consumed = false;
  if ('consumer' in asset) {
    if (typeof asset.consumer !== 'string' || !/^scripts\/[a-z0-9/-]+\.mjs$/.test(asset.consumer)) fail(`A consumer is a script under scripts/: ${where}`);
    else {
      try { consumed = readFileSync(resolve(root, asset.consumer), 'utf8').includes(asset.path); } catch { consumed = false; }
      if (!consumed) fail(`Consumer ${asset.consumer} does not use ${asset.path}: ${where}`);
    }
  }
  const referenced = consumed || (sound ? soundRefs.some((ref) => ref.literal === asset.path)
    : depotReferenced.has(asset.id) || asset.slot === AVATAR_SLOT || pathRefs.some((ref) => ref.re.test(asset.path)) || idRefs.some((ref) => ref.re.test(asset.id))
      || classB.some((entry) => entry.type === 'lottie' && entry.reviewStatus !== 'retired' && entry.staticFrame === asset.path && idRefs.some((ref) => ref.re.test(entry.id))));
  const awaitingWiring = sound && asset.reviewStatus === 'draft' && typeof asset.wiring === 'string' && asset.wiring.trim().length > 0;
  if (asset.reviewStatus !== 'retired' && !referenced && !awaitingWiring) fail(`Registered asset is referenced nowhere: ${asset.id}`);
  if (release && asset.reviewStatus !== 'approved') {
    if (allowDrafts && asset.reviewStatus === 'draft') allowedDrafts.push(asset.path);
    else fail(`Unapproved asset blocks the build (07 §6): ${asset.path}`);
  }
}
// Every referenced path is registered and live.
const live = classB.filter((asset) => asset.reviewStatus !== 'retired');
for (const ref of pathRefs) if (!live.some((asset) => ref.re.test(asset.path))) fail(`${ref.file} references an unregistered or retired asset: ${ref.literal}`);
for (const ref of soundRefs) if (!live.some((asset) => asset.type === 'wav' && asset.path === ref.literal)) fail(`${ref.file} references an unregistered or retired sound: ${ref.literal}`);
for (const ref of idRefs) if (ref.literal.includes('.') && /^(lesson|mentor)\.[a-z]+\.[a-z]/.test(ref.literal) && !live.some((asset) => ref.re.test(asset.id))) {
  fail(`${ref.file} references an unregistered or retired asset id: ${ref.literal}`);
}
// Both colour modes (07 §3): per slot and subject, a `both` asset or a light/dark pair.
const groups = new Map();
for (const asset of live) {
  const key = `${asset.slot}|${asset.character ?? ''}|${asset.aspect ?? ''}`;
  groups.set(key, [...(groups.get(key) ?? []), asset.modes]);
}
for (const [key, modes] of groups) if (!modes.includes('both') && !(modes.includes('light') && modes.includes('dark'))) fail(`Asset set lacks a mode pair (07 §3): ${key}`);
// Completeness: every Mentor has an avatar in both modes (02 §9.7: the chosen character fills every Mentor slot).
for (const character of MENTORS) for (const mode of ['light', 'dark']) {
  if (!live.some((asset) => asset.slot === AVATAR_SLOT && asset.character === character && (asset.modes === mode || asset.modes === 'both'))) fail(`No ${mode} avatar render for ${character}`);
}

// 07 §7 item 1: the no-text check. OCR finds no word in any live raster (OD-28 V-16).
if (process.env.REBUILD_ASSET_OCR !== 'off' && rasters.length) {
  try {
    const { createRasterTextReader } = await import(pathToFileURL(resolve(frontendRoot, 'scripts/ocr/rasterText.mjs')).href);
    const reader = await createRasterTextReader();
    try {
      for (const { path, bytes } of rasters) {
        const words = await reader.read(bytes);
        ocrRead++;
        if (words.length) fail(`Raster art contains text (07 §7, OCR read ${words.map((word) => `"${word.text}" ${word.confidence}%`).join(', ')}): ${path}`);
      }
    } finally { await reader.close(); }
  } catch (error) { fail(`The OCR no-text check could not run (07 §7): ${error.message}`); }
}

if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else {
  const pending = [...new Set(live.filter((asset) => asset.reviewStatus !== 'approved').map((asset) => asset.reviewFamily))];
  const status = release && !allowDrafts ? ' approved'
    : `, ${live.filter((asset) => asset.reviewStatus === 'draft').length} awaiting review${pending.length ? ` (owner style review pending for: ${pending.join(', ')})` : ''}`;
  console.log(`Rebuild asset integrity OK: ${glyphRows.length}/${GLYPH_BUDGET} glyph families from one source (${glyphNames.length} names); ${classB.length} class B assets, ${ocrRead} raster(s) free of text by OCR${status}.`);
  if (allowedDrafts.length) {
    console.warn(`LOCAL DRAFT BUILD (LF_LOCAL_DRAFT_ASSETS=1): ${allowedDrafts.length} draft assets allowed; this build is not releasable (07 §6).`);
  }
}
