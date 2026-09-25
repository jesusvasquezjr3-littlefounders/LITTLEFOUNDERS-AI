#!/usr/bin/env node
/*
 * kc:map — the B.6 topic → KC map sync gate (S05.3a).
 *
 *   npm run kc:map              check: exit 1 on any drift from the curriculum
 *   npm run kc:map -- --write   refresh kinds, review_of, requires and order
 *                               from the curriculum, keeping authored KCs;
 *                               refuses to write while a teaching topic has
 *                               no KC (assign it in the map, then re-run)
 *
 * No network, no provider, no database: it reads coursegen/curriculum and
 * database/seeds/kc_topic_map.v1.json only.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCourseCatalog } from '../catalog/loader.js';
import { catalogTopicFacts, checkKcTopicMap, kcTopicMapFileSchema, serializeKcTopicMap, syncKcTopicMap } from '../catalog/kcTopicMap.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const KC_TOPIC_MAP_PATH = path.resolve(PACKAGE_ROOT, '../database/seeds/kc_topic_map.v1.json');

export function loadCurriculumFacts(curriculumRoot = path.join(PACKAGE_ROOT, 'curriculum')) {
  return readdirSync(curriculumRoot)
    .map((name) => path.join(curriculumRoot, name))
    .filter((dir) => statSync(dir).isDirectory())
    .sort()
    .map((dir) => {
      const load = loadCourseCatalog(dir);
      const errors = load.issues.filter((issue) => issue.level === 'error');
      if (errors.length > 0 || !load.course.catalog) throw new Error(`${dir} does not load: ${errors.map((e) => e.message).join('; ')}`);
      return { slug: load.course.catalog.course.slug, position: order(load.course.catalog.course.slug), facts: catalogTopicFacts(load.course) };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ slug, facts }) => ({ slug, facts }));
}

/** The map lists courses in catalog order (the three principal subjects, then the lemonade stand). */
const COURSE_ORDER = ['financial-education', 'investing', 'entrepreneurship', 'first-lemonade-stand'];
const order = (slug: string): number => (COURSE_ORDER.includes(slug) ? COURSE_ORDER.indexOf(slug) : COURSE_ORDER.length);

function main(): void {
  const write = process.argv.includes('--write');
  const map = kcTopicMapFileSchema.parse(JSON.parse(readFileSync(KC_TOPIC_MAP_PATH, 'utf8')));
  const courses = loadCurriculumFacts();
  if (write) {
    const { map: next, issues } = syncKcTopicMap(map, courses);
    if (issues.length > 0) {
      for (const issue of issues) console.error(`::error::${issue}`);
      process.exitCode = 1;
      return;
    }
    writeFileSync(KC_TOPIC_MAP_PATH, serializeKcTopicMap(next));
    console.log(`kc:map wrote ${next.courses.reduce((n, c) => n + c.topics.length, 0)} topics`);
    return;
  }
  const issues = checkKcTopicMap(map, courses);
  for (const issue of issues) console.error(`::error::${issue}`);
  const topics = courses.reduce((n, c) => n + c.facts.length, 0);
  if (issues.length > 0) process.exitCode = 1;
  else console.log(`kc:map OK — ${courses.length} courses, ${topics} topics in sync with the curriculum`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
