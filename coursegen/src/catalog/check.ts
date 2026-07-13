#!/usr/bin/env node
// catalog:check CLI — `npm run catalog:check [-- <path>]`.
// With no path, validates every course directory under coursegen/curriculum/.
// With a path, validates just that course directory (absolute or relative
// to the coursegen package root).

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadCourseCatalog } from './loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const CURRICULUM_ROOT = path.join(PACKAGE_ROOT, 'curriculum');

function discoverCourseDirs(): string[] {
  try {
    return readdirSync(CURRICULUM_ROOT)
      .map((name) => path.join(CURRICULUM_ROOT, name))
      .filter((p) => statSync(p).isDirectory());
  } catch {
    return [];
  }
}

function main(): void {
  const argPath = process.argv[2];
  const courseDirs = argPath
    ? [path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath)]
    : discoverCourseDirs();

  if (courseDirs.length === 0) {
    console.log('catalog:check — no course directories found under coursegen/curriculum/. Nothing to validate.');
    return;
  }

  let anyErrors = false;
  for (const courseDir of courseDirs) {
    const result = loadCourseCatalog(courseDir);
    const errors = result.issues.filter((i) => i.level === 'error');
    const warnings = result.issues.filter((i) => i.level === 'warning');

    let teachingLessons = 0;
    let reviewLessons = 0;
    for (const a of result.course.adventures) {
      for (const s of a.data.sagas) {
        for (const t of s.topics) {
          if (t.kind === 'teaching') teachingLessons += t.lessons.length;
          else reviewLessons += t.lessons.length;
        }
      }
    }

    console.log(`\n── ${path.relative(PACKAGE_ROOT, courseDir) || courseDir} ──`);
    console.log(
      `  slots: ${result.course.adventures.length} adventure file(s) loaded, ` +
        `${result.course.adventures.reduce((n, a) => n + a.data.sagas.length, 0)} sagas, ` +
        `${result.course.adventures.reduce((n, a) => n + a.data.sagas.reduce((m, s) => m + s.topics.length, 0), 0)} topics, ` +
        `${teachingLessons + reviewLessons} lesson blueprints (${teachingLessons} teaching, ${reviewLessons} review)`,
    );

    for (const w of warnings) console.log(`  WARN  ${path.relative(PACKAGE_ROOT, w.file)}: ${w.message}`);
    for (const e of errors) console.error(`  ERROR ${path.relative(PACKAGE_ROOT, e.file)}: ${e.message}`);

    if (errors.length > 0) {
      anyErrors = true;
      console.error(`  catalog:check FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`);
    } else {
      console.log(`  catalog:check OK — 0 errors, ${warnings.length} warning(s)`);
    }
  }

  if (anyErrors) process.exit(1);
}

main();
