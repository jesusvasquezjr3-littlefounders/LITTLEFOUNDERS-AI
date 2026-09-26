import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * check-achievement-sharing.mjs — the release gate for achievement sharing
 * under OD-20 (Product 10 F.1-F.6, Appendix L 1.2).
 *
 * Tests pin behaviour inside each service; this gate pins the facts that span
 * services and documents, which no single service's suite can see:
 *
 *   1. Window parity. The legacy-link cutover and retirement dates are
 *      hand-mirrored across Core, the Vercel edge function and the landing
 *      page (no shared types across packages, by design). They must agree,
 *      and the retirement must equal cutover + the link lifetime.
 *   2. No new public link. Core has no insert path into badge_shares, Depot's
 *      badge route stores nothing, and a migration makes the table refuse
 *      inserts (F.1 per OD-20).
 *   3. No viewer reach. `badge_link_click` is not a recordable event and the
 *      legacy landing page tracks nothing (Appendix L counts shares initiated).
 *   4. Brand narrative coverage (Appendix L "Brand-Narrative Coverage Check",
 *      F.5): COSMIC_NARRATIVE.md carries the achievement-sharing position.
 *   5. The written policy exists and names the standing constraints (F.6).
 *   6. Every share action carries F.3's point-of-action disclosure, bound to
 *      its button, in every locale.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function read(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function constant(source, name) {
  return new RegExp(`export const ${name} = '([^']+)'`).exec(source)?.[1] ?? null;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}

export function checkAchievementSharing(root) {
  const failures = [];

  // 1. Window parity.
  const windowSource = read(root, 'backend/src/services/badgeLinkWindow.ts');
  const cutover = constant(windowSource, 'BADGE_LINK_CUTOVER');
  const retires = constant(windowSource, 'BADGE_LINK_ROUTE_RETIRES_AT');
  const lifetime = Number(/export const BADGE_SHARE_LIFETIME_DAYS = (\d+);/.exec(windowSource)?.[1]);
  if (!cutover || !retires || !Number.isInteger(lifetime)) {
    failures.push('badgeLinkWindow.ts must export BADGE_LINK_CUTOVER, BADGE_LINK_ROUTE_RETIRES_AT and BADGE_SHARE_LIFETIME_DAYS');
  } else if (Date.parse(retires) - Date.parse(cutover) !== lifetime * DAY_MS) {
    failures.push(`BADGE_LINK_ROUTE_RETIRES_AT (${retires}) must be BADGE_LINK_CUTOVER (${cutover}) + ${lifetime} days`);
  }
  for (const mirror of ['frontend/api/badge/[token].ts', 'frontend/src/routes/marketing/BadgeLandingPage.tsx']) {
    const value = constant(read(root, mirror), 'BADGE_LINK_ROUTE_RETIRES_AT');
    if (value !== retires) failures.push(`${mirror}: BADGE_LINK_ROUTE_RETIRES_AT is ${value}, Core says ${retires}`);
  }

  // 2. No new public link.
  const coreSources = walk(resolve(root, 'backend/src')).filter((file) => file.endsWith('.ts') && !/[\\/]__tests__[\\/]/.test(file));
  for (const file of coreSources) {
    const source = readFileSync(file, 'utf8');
    if (/insertBadgeShare|['`]\/badge_shares['`]\s*,\s*\{[^}]*method:\s*'POST'/s.test(source)) {
      failures.push(`${relative(root, file)}: writes a new badge_shares row (OD-20: new shares are images, never links)`);
    }
    // A service call to Depot's retired compose-and-store endpoint (the render path ends in /render).
    if (/fetch\(\s*[`'"][^`'"]*\/api\/v1\/badges[`'"]/.test(source)) {
      failures.push(`${relative(root, file)}: calls Depot's retired compose-and-store badge endpoint`);
    }
  }
  const depotRoute = read(root, 'filebase/src/routes/badges.ts');
  if (/writeFile|writeMetadataAtomic|mkdir/.test(depotRoute)) failures.push('filebase/src/routes/badges.ts: the badge route must not store anything (OD-20)');
  if (!/\}\)\s*\.strict\(\)/.test(depotRoute)) failures.push('filebase/src/routes/badges.ts: the render body must be .strict() (F.6 minimization)');
  const migrations = readdirSync(resolve(root, 'database/migrations')).filter((file) => file.endsWith('.sql'));
  const closes = migrations.some((file) => /BEFORE\s+INSERT\s+ON\s+public\.badge_shares/i.test(read(root, `database/migrations/${file}`)));
  if (!closes) failures.push('database/migrations: no migration makes badge_shares refuse new rows (OD-20 cutover)');

  // 3. No viewer reach.
  const recordable = /export const RECORDABLE_EVENTS = \[([\s\S]*?)\] as const;/.exec(read(root, 'backend/src/services/insights.ts'))?.[1] ?? '';
  if (recordable.includes("'badge_link_click'")) failures.push('backend/src/services/insights.ts: badge_link_click (viewer reach) must not be recordable');
  const anon = /const ANON_EVENTS = new Set\(\[([\s\S]*?)\]\);/.exec(read(root, 'backend/src/routes/events.ts'))?.[1] ?? '';
  if (anon.includes("'badge_link_click'")) failures.push('backend/src/routes/events.ts: badge_link_click must not be an anonymous event');
  if (/trackInsight|['"]badge_link_click['"]/.test(read(root, 'frontend/src/routes/marketing/BadgeLandingPage.tsx'))) {
    failures.push('frontend/src/routes/marketing/BadgeLandingPage.tsx: the legacy landing page must not track viewers');
  }

  // 4. Brand narrative coverage (F.5).
  const narrative = read(root, 'docs/product-audit/COSMIC_NARRATIVE.md');
  const start = narrative.search(/^## \d+\. Sharing a Child's Achievement/m);
  const rest = start === -1 ? '' : narrative.slice(start + 3);
  const end = rest.search(/^#{2,3} /m);
  const section = start === -1 ? '' : end === -1 ? rest : rest.slice(0, end);
  if (!section) {
    failures.push("docs/product-audit/COSMIC_NARRATIVE.md: missing the \"Sharing a Child's Achievement\" brand position (F.5)");
  } else {
    for (const [needle, why] of [
      ['**What it is.**', 'what the feature is'],
      ['**What it deliberately is not.**', 'what it deliberately is not'],
      ['first name', 'the first-name-only promise'],
      ['no link', 'the no-link architecture'],
      ['count who sees it', 'the never-viewer-reach position'],
      ['OD-20', 'the decision it describes'],
    ]) if (!section.toLowerCase().includes(needle.toLowerCase())) failures.push(`COSMIC_NARRATIVE.md sharing position must state ${why} ("${needle}")`);
  }

  // 5. Policy and standing constraints (F.6).
  const policy = read(root, 'docs/rebuild/policies/ACHIEVEMENT-SHARING.md');
  for (const needle of ['Guardian-only initiation', 'Server-side achievement verification', 'First-name-only minimization', 'Dated removal']) {
    if (!policy.includes(needle)) failures.push(`docs/rebuild/policies/ACHIEVEMENT-SHARING.md must carry "${needle}"`);
  }

  // 6. The disclosure travels with every share action (F.3; Appendix L
  //    "Point-of-Share Disclosure": displayed on 100% of share actions).
  failures.push(...disclosureFailures(root));

  return failures;
}

/*
 * 6. Every screen that can start a share shows F.3's two disclosure lines
 * beside each share button and describes the button with them
 * (aria-describedby), so no share action exists without the disclosure.
 * The rebuilt AchievementShare component binds its own; a screen that calls
 * the transport directly must render both keys and bind them once per
 * button. Both disclosure lines must exist in every locale.
 *
 * W2F.1: a route adapter may call the transport for a rebuilt screen instead
 * of rendering a button itself (the rebuild imports nothing outside it, so it
 * cannot call Core's image endpoint). Such an adapter renders no legacy label
 * and must import a rebuilt screen that renders only AchievementShare for its
 * share actions: every place that screen receives a share result
 * (`onShare=`) is an AchievementShare, and it draws no share button of its own.
 */
export function disclosureFailures(root) {
  const failures = [];
  const sources = walk(resolve(root, 'frontend/src'))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/[\\/]__tests__[\\/]|\.test\.tsx?$/.test(f));
  for (const file of sources) {
    const name = relative(root, file).replaceAll('\\', '/');
    if (name === 'frontend/src/rebuild/family/achievementImage.ts') continue;
    const source = readFileSync(file, 'utf8');
    if (name === 'frontend/src/rebuild/family/AchievementShare.tsx') {
      if (!/aria-describedby=\{disclosureId\}/.test(source) || !/id=\{disclosureId\}/.test(source)
        || !/copy\.disclosure\b/.test(source) || !/copy\.keepNote\b/.test(source)) {
        failures.push(`${name}: the share button must be described by both disclosure lines (F.3)`);
      }
      continue;
    }
    if (!/\bshareAchievementImage\(/.test(source)) continue;
    const rebuilt = [...source.matchAll(/from '@\/(rebuild\/[^']+)'/g)].map((m) => resolve(root, 'frontend/src', `${m[1]}.tsx`))
      .filter((path) => { try { return /<AchievementShare\b/.test(readFileSync(path, 'utf8')); } catch { return false; } });
    if (rebuilt.length > 0 && !/t\('family\.badge\.share/.test(source)) {
      for (const path of rebuilt) {
        const screen = readFileSync(path, 'utf8');
        const shares = (screen.match(/<AchievementShare\b/g) ?? []).length;
        const handlers = (screen.match(/\bonShare=/g) ?? []).length;
        if (handlers !== shares) failures.push(`${relative(root, path).replaceAll('\\', '/')}: ${handlers} share handler(s) but ${shares} AchievementShare; every share action must be an AchievementShare (F.3)`);
      }
      continue;
    }
    const buttons = (source.match(/t\('family\.badge\.share(?:Goal)?'(?:,\s*\{[^}]*\})?\)\}/g) ?? []).length;
    const made = (source.match(/t\('family\.badge\.disclosure'\)/g) ?? []).length;
    const keep = (source.match(/t\('family\.badge\.disclosureKeep'\)/g) ?? []).length;
    const described = (source.match(/aria-describedby=/g) ?? []).length;
    if (buttons === 0) failures.push(`${name}: starts a share but no share button label was found; render the rebuilt AchievementShare or the family.badge.share label`);
    if (made < buttons || keep < buttons) failures.push(`${name}: ${buttons} share button(s) but ${Math.min(made, keep)} full disclosure(s); every share button needs both F.3 lines beside it`);
    if (described < buttons) failures.push(`${name}: ${buttons} share button(s) but ${described} aria-describedby; each button must be described by its disclosure`);
  }
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    const badge = JSON.parse(read(root, `frontend/src/i18n/${locale}/common.json`))?.family?.badge ?? {};
    for (const key of ['disclosure', 'disclosureKeep']) {
      if (typeof badge[key] !== 'string' || badge[key].trim() === '') failures.push(`frontend/src/i18n/${locale}/common.json: family.badge.${key} is missing`);
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkAchievementSharing(fileURLToPath(new URL('../../', import.meta.url)));
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Achievement sharing OK: window parity, no public-link path, no viewer reach, brand position, policy and standing constraints, disclosure on every share action.');
  }
}
