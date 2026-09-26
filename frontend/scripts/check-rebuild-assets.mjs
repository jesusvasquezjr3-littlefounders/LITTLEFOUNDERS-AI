import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
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
 * Not automated here (recorded open in the S03 sprint record): OCR for text
 * inside raster renders, and the human style review of the first asset of each
 * family (07 §7 item 2, OD-14).
 */
// REBUILD_ASSET_ROOT points the gate at a copy of the frontend tree (its own mutation tests do this).
const root = process.env.REBUILD_ASSET_ROOT ? resolve(process.env.REBUILD_ASSET_ROOT) : resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'public');
const rebuildRoot = resolve(root, 'src/rebuild');
const release = process.argv.includes('--release');
const manifest = JSON.parse(readFileSync(resolve(root, 'src/rebuild/assets/manifest.json'), 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);

/* ---------------------------------------------------------------- sources */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const sourceFiles = walk(rebuildRoot).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file));
const sources = new Map(sourceFiles.map((file) => [relative(root, file).split(sep).join('/'), readFileSync(file, 'utf8')]));
// Everything else in the app that may reference a rebuilt asset path.
for (const file of walk(resolve(root, 'src')).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith(rebuildRoot))) {
  const text = readFileSync(file, 'utf8');
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
const TYPES = new Set(['svg', 'webp', 'png', 'lottie', 'render']);
const MODES = new Set(['both', 'light', 'dark']);
const REVIEW = new Set(['draft', 'approved', 'retired']);
// 07 §7 item 2: the families whose first asset needs the owner's style approval.
const FAMILIES = new Set(['character-renders', 'badges', 'course-icons', 'pockets', 'empty-states', 'scenes', 'task-categories', 'coins', 'celebration-motion']);
const BUDGET_KB = { svg: 6, webp: 120, png: 120, lottie: 150, render: 150 };
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
const locales = ['en-US', 'es-MX', 'pt-BR'];
const copy = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(readFileSync(resolve(root, `src/i18n/${locale}/rebuild.json`), 'utf8'))]));
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
  for (const m of text.matchAll(/['"`]((?:lesson|mentor|badge|course|pocket|empty|scene|task|coin|celebration)\.[a-z0-9.${}-]+)['"`]/g)) {
    if (!isTranslationKey(m[1])) idRefs.push({ file, literal: m[1], re: pattern(m[1]) });
  }
}

const classB = manifest.filter((row) => row.class !== 'A');
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
  if (typeof asset.path !== 'string') continue;
  const file = resolve(publicRoot, `.${asset.path}`);
  if (!asset.path.startsWith('/rebuild/') || !file.startsWith(publicRoot + sep)) { fail(`Asset outside public/rebuild/: ${asset.path}`); continue; }
  let bytes;
  try { bytes = readFileSync(file); } catch { fail(`Missing or unreadable asset: ${asset.path}`); continue; }
  const kb = Math.ceil(statSync(file).size / 1024);
  if (kb > asset.sizesKb) fail(`Asset exceeds its declared size (${kb} KB > ${asset.sizesKb}): ${asset.path}`);
  if (kb > BUDGET_KB[asset.type] && !asset.budgetReason) fail(`Asset over the 07 §3.2 budget (${kb} KB > ${BUDGET_KB[asset.type]}) without a reason: ${asset.path}`);
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
  }
  // Referenced somewhere, by path or id (an avatar is found by its slot).
  if (asset.reviewStatus !== 'retired' && asset.slot !== AVATAR_SLOT && !pathRefs.some((ref) => ref.re.test(asset.path)) && !idRefs.some((ref) => ref.re.test(asset.id))) {
    fail(`Registered asset is referenced nowhere: ${asset.id}`);
  }
  if (release && asset.reviewStatus !== 'approved') fail(`Unapproved asset blocks the build (07 §6): ${asset.path}`);
}
// Every referenced path is registered and live.
const live = classB.filter((asset) => asset.reviewStatus !== 'retired');
for (const ref of pathRefs) if (!live.some((asset) => ref.re.test(asset.path))) fail(`${ref.file} references an unregistered or retired asset: ${ref.literal}`);
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

if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else {
  const pending = [...new Set(live.filter((asset) => asset.reviewStatus !== 'approved').map((asset) => asset.reviewFamily))];
  console.log(`Rebuild asset integrity OK: ${glyphRows.length}/${GLYPH_BUDGET} glyph families from one source (${glyphNames.length} names); ${classB.length} class B assets${release ? ' approved' : `, ${live.filter((asset) => asset.reviewStatus === 'draft').length} awaiting review${pending.length ? ` (owner style review pending for: ${pending.join(', ')})` : ''}`}.`);
}
