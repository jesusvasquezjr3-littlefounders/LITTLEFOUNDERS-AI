#!/usr/bin/env node
// graph:check — inspect the derived competency DAG for one authored course.

import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCourseCatalog } from './loader.js';
import { buildCompetencyGraph, checkCompetencyGraph } from './competencyGraph.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const target = process.argv[2];
const curriculumRoot = path.join(PACKAGE_ROOT, 'curriculum');
const courseDirs = target
  ? [path.isAbsolute(target) ? target : path.join(curriculumRoot, target)]
  : readdirSync(curriculumRoot)
      .map((name) => path.join(curriculumRoot, name))
      .filter((candidate) => statSync(candidate).isDirectory())
      .sort();

let failures = 0;
for (const courseDir of courseDirs) {
  const label = path.relative(PACKAGE_ROOT, courseDir) || courseDir;
  const load = loadCourseCatalog(courseDir);
  const loadErrors = load.issues.filter((issue) => issue.level === 'error');
  if (loadErrors.length > 0) {
    console.error(`graph:check failed to load ${label}: ${loadErrors.map((issue) => issue.message).join('; ')}`);
    failures++;
    continue;
  }
  const graph = buildCompetencyGraph(load.course);
  const issues = checkCompetencyGraph(graph);
  for (const issue of issues) console[issue.level === 'error' ? 'error' : 'warn'](`${label}: ${issue.code}: ${issue.message}`);
  const teaching = graph.nodes.filter((node) => node.role === 'teaching').length;
  const retrieval = graph.nodes.length - teaching;
  const errors = issues.filter((issue) => issue.level === 'error').length;
  console.log(`competency graph: ${graph.courseSlug} — ${graph.nodes.length} nodes (${teaching} teaching, ${retrieval} retrieval), ${graph.edges.length} edges, ${errors} error(s)`);
  if (errors > 0) failures++;
}
if (failures > 0) process.exit(1);
