#!/usr/bin/env node
// Verifies the documentation system: wikilinks resolve, every document is reachable
// from docs/INDEX.md and links onward, front matter is valid, and a commit that
// changes behavior also touches the documentation.
//
//   node scripts/check-docs.mjs            link and structure check
//   node scripts/check-docs.mjs --staged   the same, plus the freshness checks on staged files
//
// Set SKIP_DOCS_FRESHNESS=1 to commit a change that genuinely needs no documentation update.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const staged = process.argv.includes('--staged');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
const root = git('rev-parse', '--show-toplevel')[0];
process.chdir(root);

const ROOT_DOCS = ['README.md', 'CLAUDE.md', 'AGENTS.md', 'CHANGELOG.md'];
const STATUSES = new Set(['scaffold', 'draft', 'accepted']);
const today = new Date().toISOString().slice(0, 10);

const inScope = (f) => f.endsWith('.md') && (f.startsWith('docs/') || ROOT_DOCS.includes(f));
const files = [...new Set(git('ls-files', '-co', '--exclude-standard').filter(inScope))].filter((f) => fs.existsSync(f));

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const byName = new Map();
for (const f of files) {
  const name = path.basename(f, '.md');
  if (byName.has(name)) fail(f, `name "${name}" is also used by ${byName.get(name)}; wikilinks need unique names`);
  else byName.set(name, f);
}

const stripCode = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
const outgoing = new Map();
const incoming = new Map(files.map((f) => [f, new Set()]));

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const links = new Set();
  for (const m of stripCode(text).matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (!byName.has(target)) fail(f, `broken link [[${m[1]}]]`);
    else if (byName.get(target) !== f) {
      links.add(byName.get(target));
      incoming.get(byName.get(target)).add(f);
    }
  }
  outgoing.set(f, links);

  if (/[áéíóúñ¿¡ãõçÁÉÍÓÚÑ]/.test(stripCode(text)) && !f.endsWith('CHANGELOG.md')) {
    fail(f, 'contains non-English characters; repository documentation is written in English');
  }

  if (f.startsWith('docs/')) {
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) { fail(f, 'missing front matter (title, status, updated)'); continue; }
    const get = (k) => fm[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim();
    if (!get('title')) fail(f, 'front matter needs a title');
    if (!STATUSES.has(get('status') ?? '')) fail(f, `front matter status must be one of ${[...STATUSES].join(', ')}`);
    const updated = get('updated');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updated ?? '')) fail(f, 'front matter needs updated: YYYY-MM-DD');
    else if (updated > today) fail(f, `updated date ${updated} is in the future`);
    if (!/^## Related\s*$/m.test(text)) fail(f, 'missing a "## Related" section');
    if (links.size === 0) fail(f, 'links to no other document');
  }
}

for (const f of ROOT_DOCS.filter((r) => files.includes(r))) {
  if (outgoing.get(f).size === 0) fail(f, 'links to no other document');
}

const indexFile = 'docs/INDEX.md';
if (!files.includes(indexFile)) fail(indexFile, 'missing');
else {
  for (const f of files) {
    if (f.startsWith('docs/') && f !== indexFile && !outgoing.get(indexFile).has(f)) fail(f, 'not linked from docs/INDEX.md');
  }
  for (const r of ['CLAUDE.md', 'README.md']) {
    if (files.includes(r) && !outgoing.get(r).has(byName.get('INDEX'))) fail(r, 'must link to [[INDEX]]');
  }
}

if (staged) {
  const changed = git('diff', '--cached', '--name-only', '--diff-filter=ACMRD');
  const docsChanged = changed.filter((f) => inScope(f) && f !== 'CHANGELOG.md');
  const codeChanged = changed.filter((f) => !f.endsWith('.md') && !f.startsWith('.claude/') && !/(^|\/)package-lock\.json$/.test(f));

  for (const f of changed.filter((c) => c.startsWith('docs/') && c.endsWith('.md') && fs.existsSync(c))) {
    const updated = fs.readFileSync(f, 'utf8').match(/^updated:\s*(\S+)/m)?.[1];
    if (updated !== today) fail(f, `changed in this commit but "updated" is ${updated ?? 'missing'}; set it to ${today}`);
  }

  if (codeChanged.length > 0 && docsChanged.length === 0 && process.env.SKIP_DOCS_FRESHNESS !== '1') {
    fail('commit', `changes ${codeChanged.length} non-documentation file(s) and no document under docs/ or README, CLAUDE or AGENTS. Update the affected documents (see docs/INDEX.md), or set SKIP_DOCS_FRESHNESS=1 if none is affected.`);
  }
  if (codeChanged.length > 0 && !changed.includes('CHANGELOG.md') && process.env.SKIP_DOCS_FRESHNESS !== '1') {
    fail('commit', 'add an entry to CHANGELOG.md, or set SKIP_DOCS_FRESHNESS=1 for a change that needs none.');
  }
}

if (errors.length > 0) {
  console.error(`docs check failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`docs check OK: ${files.length} documents, all links resolve, all reachable from docs/INDEX.md`);
