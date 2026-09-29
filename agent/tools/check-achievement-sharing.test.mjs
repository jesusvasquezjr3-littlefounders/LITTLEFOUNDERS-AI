import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedPreviewFailures, checkAchievementSharing } from './check-achievement-sharing.mjs';

/*
 * The gate must pass on the real tree and fail on each regression it exists
 * to catch — a checker nobody has seen fail is not a checker.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const FILES = [
  'backend/src/services/badgeLinkWindow.ts',
  'backend/src/services/badges.ts',
  'backend/src/services/insights.ts',
  'backend/src/routes/events.ts',
  'backend/src/routes/family.ts',
  'frontend/api/badge/[token].ts',
  'frontend/src/routes/marketing/BadgeLandingPage.tsx',
  'filebase/src/routes/badges.ts',
  'docs/product-audit/COSMIC_NARRATIVE.md',
  'docs/rebuild/policies/ACHIEVEMENT-SHARING.md',
  'frontend/src/routes/app/family/KidTerritoryPage.tsx',
  'frontend/src/rebuild/family/console/ChildProgress.tsx',
  'frontend/src/rebuild/family/AchievementShare.tsx',
  'frontend/src/rebuild/family/achievementImage.ts',
  'frontend/src/i18n/en-US/common.json',
  'frontend/src/i18n/es-MX/common.json',
  'frontend/src/i18n/pt-BR/common.json',
  'frontend/src/rebuild/family/BadgeShares.tsx',
  'frontend/src/i18n/en-US/rebuild-family.json',
  'frontend/src/i18n/es-MX/rebuild-family.json',
  'frontend/src/i18n/pt-BR/rebuild-family.json',
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lf-sharing-'));
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(resolve(repo, file), join(root, file));
  }
  cpSync(resolve(repo, 'database/migrations'), join(root, 'database/migrations'), { recursive: true });
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const source = readFileSync(path, 'utf8');
  assert.ok(source.includes(from), `${file} fixture lacks ${from}`);
  writeFileSync(path, source.replace(from, to));
}

function withFixture(mutate, expected) {
  const root = fixture();
  try {
    mutate(root);
    const failures = checkAchievementSharing(root);
    assert.ok(failures.some((f) => expected.test(f)), `expected ${expected} in ${JSON.stringify(failures)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the real tree passes', () => {
  assert.deepEqual(checkAchievementSharing(repo), []);
});

test('fails when a mirrored retirement date drifts', () => {
  withFixture((root) => edit(root, 'frontend/api/badge/[token].ts', "'2026-10-24T00:00:00.000Z'", "'2026-11-24T00:00:00.000Z'"), /\[token\]\.ts: BADGE_LINK_ROUTE_RETIRES_AT/);
  withFixture((root) => edit(root, 'backend/src/services/badgeLinkWindow.ts', "BADGE_LINK_ROUTE_RETIRES_AT = '2026-10-24", "BADGE_LINK_ROUTE_RETIRES_AT = '2026-12-24"), /must be BADGE_LINK_CUTOVER/);
});

test('fails when Core regains a badge_shares insert path or calls the retired compose endpoint', () => {
  withFixture((root) => writeFileSync(join(root, 'backend/src/services/sneaky.ts'),
    "export const x = () => serviceRest('/badge_shares', { method: 'POST', body: '{}' });\n"), /sneaky\.ts: writes a new badge_shares row/);
  withFixture((root) => writeFileSync(join(root, 'backend/src/services/compose.ts'),
    "export const y = () => fetch(`${base}/api/v1/badges`, { method: 'POST' });\n"), /compose\.ts: calls Depot's retired/);
});

test('fails when Depot stores badges again or loses its strict schema', () => {
  withFixture((root) => edit(root, 'filebase/src/routes/badges.ts', "import { z } from 'zod';", "import { z } from 'zod';\nimport { writeFile } from 'node:fs/promises';"), /must not store anything/);
  withFixture((root) => edit(root, 'filebase/src/routes/badges.ts', '.strict();', ';'), /\.strict\(\)/);
});

test('fails when the database stops refusing new links', () => {
  withFixture((root) => {
    const dir = join(root, 'database/migrations');
    for (const file of readdirSync(dir)) {
      const path = join(dir, file);
      writeFileSync(path, readFileSync(path, 'utf8').replace(/BEFORE\s+INSERT\s+ON\s+public\.badge_shares/gi, 'BEFORE UPDATE ON public.badge_shares'));
    }
  }, /no migration makes badge_shares refuse new rows/);
});

test('fails when viewer reach comes back', () => {
  withFixture((root) => edit(root, 'backend/src/services/insights.ts', "'badge_generated', 'badge_shared',", "'badge_generated', 'badge_shared', 'badge_link_click',"), /viewer reach\) must not be recordable/);
  withFixture((root) => edit(root, 'frontend/src/routes/marketing/BadgeLandingPage.tsx', "import { api } from '@/lib/api';", "import { api } from '@/lib/api';\nimport { trackInsight } from '@/lib/insights';"), /must not track viewers/);
});

test('fails when the brand position or the policy loses its substance', () => {
  withFixture((root) => edit(root, 'docs/product-audit/COSMIC_NARRATIVE.md', "## 5. Sharing a Child's Achievement", '## 5. Something else'), /missing the "Sharing a Child's Achievement"/);
  withFixture((root) => edit(root, 'docs/product-audit/COSMIC_NARRATIVE.md', 'count who sees it', 'measure the audience'), /never-viewer-reach/);
  withFixture((root) => edit(root, 'docs/rebuild/policies/ACHIEVEMENT-SHARING.md', 'Guardian-only initiation', 'Anyone may initiate'), /Guardian-only initiation/);
});

test('fails when a share button loses its disclosure or its description', () => {
  // A screen that calls the image transport and draws its own buttons (the pre-W2 shape) needs both lines and a description per button.
  const page = 'frontend/src/routes/app/family/LegacySharePage.tsx';
  const legacy = [
    "import { shareAchievementImage } from '@/rebuild/family/achievementImage';",
    'export function P() { void shareAchievementImage(request); return <>',
    "<Button aria-describedby={`${a}-made ${a}-keep`}>{t('family.badge.share')}</Button>",
    "<p id={`${a}-made`}>{t('family.badge.disclosure')}</p><p id={`${a}-keep`}>{t('family.badge.disclosureKeep')}</p>",
    "<Button aria-describedby={`${b}-made ${b}-keep`}>{t('family.badge.shareGoal', { title })}</Button>",
    "<p id={`${b}-made`}>{t('family.badge.disclosure')}</p><p id={`${b}-keep`}>{t('family.badge.disclosureKeep')}</p>",
    '</>; }',
  ].join('\n');
  const write = (root, source) => writeFileSync(join(root, page), source);
  withFixture((root) => write(root, legacy.replace("<p id={`${b}-keep`}>{t('family.badge.disclosureKeep')}</p>", '')), /2 share button\(s\) but 1 full disclosure/);
  withFixture((root) => write(root, legacy.replace('aria-describedby={`${b}-made ${b}-keep`}', '')), /2 share button\(s\) but 1 aria-describedby/);
  // W2F.1: the route adapter hands the result to the rebuilt screen, which must use AchievementShare for every share action.
  const adapter = 'frontend/src/routes/app/family/KidTerritoryPage.tsx';
  withFixture((root) => edit(root, adapter, "import { ChildProgress } from '@/rebuild/family/console/ChildProgress';", ''), /starts a share but no share button label/);
  withFixture((root) => edit(root, 'frontend/src/rebuild/family/console/ChildProgress.tsx', '<AchievementShare copy={shareCopy}', '<ShareButton copy={shareCopy}'),
    /ChildProgress\.tsx: 3 share handler\(s\) but 2 AchievementShare/);
  withFixture((root) => edit(root, 'frontend/src/rebuild/family/AchievementShare.tsx', ' aria-describedby={disclosureId}', ''), /AchievementShare\.tsx: the share button must be described/);
  withFixture((root) => {
    const path = join(root, 'frontend/src/i18n/pt-BR/common.json');
    const json = JSON.parse(readFileSync(path, 'utf8'));
    delete json.family.badge.disclosureKeep;
    writeFileSync(path, JSON.stringify(json, null, 2));
  }, /pt-BR\/common\.json: family\.badge\.disclosureKeep is missing/);
});

// F.2 (b) / F.3 (GAP-FIX-R5): the legacy-link panel discloses that a preview
// a messaging app cached before revocation may persist, until the links retire.
test('fails when the cached-preview caveat leaves the legacy-link panel before the links retire', () => {
  withFixture((root) => edit(root, 'frontend/src/rebuild/family/BadgeShares.tsx', '<Copy role="body">{copy.cachedPreview}</Copy>', ''), /BadgeShares\.tsx: the legacy-link panel must render badgeShares\.cachedPreview/);
  for (const [locale, key] of [['en-US', 'cachedPreview'], ['es-MX', 'revoked'], ['pt-BR', 'cachedPreview']]) {
    withFixture((root) => {
      const path = join(root, `frontend/src/i18n/${locale}/rebuild-family.json`);
      const json = JSON.parse(readFileSync(path, 'utf8'));
      json.badgeShares[key] = locale === 'es-MX' ? 'Enlace revocado.' : '';
      writeFileSync(path, JSON.stringify(json, null, 2));
    }, new RegExp(`${locale}/rebuild-family\.json: badgeShares\.${key} must disclose`));
  }
  withFixture((root) => edit(root, 'docs/rebuild/policies/ACHIEVEMENT-SHARING.md', 'accepted and disclosed for legacy links', 'noted'), /record the cached-preview caveat/);
});

test('the cached-preview pin lifts once the legacy links have retired', () => {
  const root = fixture();
  try {
    edit(root, 'frontend/src/rebuild/family/BadgeShares.tsx', '<Copy role="body">{copy.cachedPreview}</Copy>', '');
    assert.ok(cachedPreviewFailures(root, '2026-10-24T00:00:00.000Z', Date.parse('2026-10-01T00:00:00Z')).length > 0);
    assert.deepEqual(cachedPreviewFailures(root, '2026-10-24T00:00:00.000Z', Date.parse('2026-10-24T00:00:00Z')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
