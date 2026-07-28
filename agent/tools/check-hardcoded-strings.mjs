#!/usr/bin/env node
/**
 * check-hardcoded-strings.mjs — detects user-facing strings in TSX/TS files
 * that are NOT wrapped in t() or i18n calls. Scans the frontend source tree
 * and reports any line that looks like hardcoded text a user would see.
 *
 * Heuristics (deliberately simple, not AST-based — catches the 80% case):
 *   1. JSX text nodes:  >Some text<  or  >Some text</  (between JSX tags)
 *   2. setError/setState with raw string:  setError('...')  setState('Error')
 *   3. English-looking sentence fragments (>3 words, starts with capital)
 *
 * Excludes: test files, console logs, comments, CSS classes, i18n keys,
 * import paths, aria-* attributes, className props.
 *
 * Usage:  node agent/tools/check-hardcoded-strings.mjs [path]
 * Exit:   0 = clean, 1 = issues found
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.argv[2] || 'frontend/src';

const EXCLUDE_DIRS = new Set(['__tests__', 'node_modules', '.vercel', 'dist', 'i18n']);
const INCLUDE_EXTS = new Set(['.tsx', '.ts']);

/** Lines that are always fine even if they match patterns. */
function isExcludedLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  if (t.startsWith('import ') || t.startsWith('export ')) return true;
  if (t.includes('console.')) return true;
  if (t.includes('className=')) return true;
  if (t.includes('aria-')) return true;
  if (t.includes("t('") || t.includes('t(`')) return true;
  if (t.includes('i18nKey') || t.includes('titleKey') || t.includes('subtitleKey')) return true;
  if (t.includes('defaultValue:')) return true;
  if (t.includes('data-')) return true;
  if (t.includes('<Icon ') || t.includes('<Badge ') || t.includes('<Card ')) return true;
  if (t.includes('href=') || t.includes('src=')) return true;
  return false;
}

let issues = 0;

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (isExcludedLine(raw)) continue;

    const lineno = i + 1;

    // Pattern A: JSX text between tags — >Some text<
    const jsxText = line.match(/>([A-Z][^<>{}=`'"]{3,})</);
    if (jsxText && !line.includes('t(`') && !line.includes("t('")) {
      const text = jsxText[1].trim();
      if (text.split(/\s+/).length >= 2 || text.length > 15) {
        console.log(`${filePath}:${lineno}: JSX text not in t(): "${text.slice(0, 60)}"`);
        issues++;
        continue;
      }
    }

    // Pattern B: setError/setState/setMessage with raw string
    const setter = line.match(/(?:setError|setMessage|setState)\s*\(\s*['"]([^'"]+)['"]/);
    if (setter) {
      const text = setter[1];
      // Exclude single-word / short strings
      if (text.length > 5 && text.includes(' ')) {
        console.log(`${filePath}:${lineno}: setError/setState with raw string: "${text.slice(0, 60)}"`);
        issues++;
        continue;
      }
    }

    // Pattern C: English words in JSX content without t()
    const templateText = line.match(/\{['"]([A-Z][\w\s,.:;!?'\-]{10,})['"]\}/);
    if (templateText && !line.includes('t(')) {
      console.log(`${filePath}:${lineno}: Hardcoded English string in JSX: "${templateText[1].slice(0, 60)}"`);
      issues++;
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile() && INCLUDE_EXTS.has(extname(entry))) {
      scanFile(full);
    }
  }
}

walk(ROOT);

if (issues > 0) {
  console.log(`\ncheck-hardcoded-strings: ${issues} potential hardcoded string(s) found.`);
  console.log('Review each hit — some may be false positives (CSS labels, type keys, etc).');
  process.exit(1);
}

console.log('check-hardcoded-strings OK — no hardcoded user-facing strings detected');
process.exit(0);
