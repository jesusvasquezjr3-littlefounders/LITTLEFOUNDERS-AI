#!/usr/bin/env node
/**
 * Appendix P Part 8 (GAP-FIX-R2 learning): two Definition-of-Done metrics as
 * a stored, reviewable report the staff learning-quality panel shows.
 *
 *   Tap-alternative coverage (WCAG 2.5.7, target 100%): every pointer-drag
 *   interaction in the rebuilt teaching boards (an onPointerDown handler that
 *   captures the pointer) sits in a board that also offers a tap and keyboard
 *   path (Slider, Stepper, Button, a native range input or a key handler).
 *   A drag-place board (`useDragPlace`, the Horizonte drag chips) counts as a
 *   drag interaction too and must render the "Move to" menu beside it.
 *   The in-browser board audit (frontend/scripts/audits, "board-draggable-
 *   without-tap-alternative") measures the rendered states; this is its
 *   static, always-run counterpart.
 *
 *   Locale rendering coverage (target 100%): every v2 segment kind Core
 *   delivers is emitted by Forge in en-US, es-MX and pt-BR and those rows
 *   pass Core's strict contract and behaviour gate (backend forge-v2:check,
 *   run by Core's `npm test`).
 *
 *   Horizonte Visual (S05, F0-F4) inventories, counted from source:
 *   chart kinds (core, situational and the twelve reading kinds of F1.0, with
 *   the reading kinds' three-locale Forge emission) and the pack segment types
 *   (each needs a lazy board in the browser and a strict contract in Core).
 *
 *   node agent/tools/teaching-visual-coverage.mjs           write the snapshot
 *   node agent/tools/teaching-visual-coverage.mjs --check   fail on drift (spec:check)
 *
 * The snapshot is backend/src/services/teachingVisualCoverage.generated.ts.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractCapabilityMap, packCapabilityName, readHorizontePackSources } from './check-v2-lesson-capability-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BOARDS = path.join(ROOT, 'frontend/src/rebuild/learning');
const HORIZONTE_BOARDS = path.join(BOARDS, 'horizonte');
const EMITTED = path.join(ROOT, 'coursegen/src/v2/fixtures/emitted.json');
const CORE = path.join(ROOT, 'backend/src/services/v2LessonDocument.ts');
const CHART_MODEL = path.join(ROOT, 'backend/src/services/v2ChartModel.ts');
const OUT = path.join(ROOT, 'backend/src/services/teachingVisualCoverage.generated.ts');
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'harness' ? [] : files(full);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
}

const POINTER_ALTERNATIVE = /<Slider\b|<Stepper\b|type="range"|onKeyDown=|<Button\b/;
const DRAG_PLACE_CALL = /(?<!\bfunction\s+)\buseDragPlace\s*(?:<[^()]*>)?\(/g;
const DRAG_PLACE_ALTERNATIVE = /<MoveToChoice\b/;

export function tapCoverage(sources) {
  let pointerHandlers = 0; let dragPlaceBoards = 0; let withAlternative = 0; const missing = [];
  for (const { file, source } of sources) {
    const handlers = /setPointerCapture/.test(source) ? [...source.matchAll(/onPointerDown=\{/g)].length : 0;
    const places = [...source.matchAll(DRAG_PLACE_CALL)].length;
    if (handlers === 0 && places === 0) continue;
    pointerHandlers += handlers;
    dragPlaceBoards += places;
    const handlersCovered = handlers === 0 || POINTER_ALTERNATIVE.test(source);
    const placesCovered = places === 0 || DRAG_PLACE_ALTERNATIVE.test(source);
    if (handlersCovered) withAlternative += handlers;
    if (placesCovered) withAlternative += places;
    if (!handlersCovered || !placesCovered) missing.push(file);
  }
  const drags = pointerHandlers + dragPlaceBoards;
  return {
    drag_interactions: drags, pointer_handlers: pointerHandlers, drag_place_hooks: dragPlaceBoards, with_alternative: withAlternative,
    share: drags === 0 ? null : Math.round(withAlternative / drags * 10_000) / 10_000, missing,
  };
}

export function localeCoverage(kinds, rows) {
  const seen = new Map();
  for (const row of rows) for (const segment of row.document?.segments ?? []) {
    const set = seen.get(segment.type) ?? new Set();
    set.add(row.locale);
    seen.set(segment.type, set);
  }
  const missing = kinds.filter((kind) => !LOCALES.every((locale) => seen.get(kind)?.has(locale)));
  return { kinds: kinds.length, covered: kinds.length - missing.length, share: kinds.length === 0 ? null : Math.round((kinds.length - missing.length) / kinds.length * 10_000) / 10_000, missing };
}

/** The three exported chart-kind lists of the canonical Core chart model. */
export function chartKindGroups(source) {
  const list = (name) => {
    const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`).exec(source);
    if (!match) throw new Error(`Missing ${name} declaration`);
    return [...new Set([...match[1].matchAll(/'([^']+)'/g)].map(([, kind]) => kind))];
  };
  return { core: list('CORE_CHART_KINDS'), situational: list('SITUATIONAL_CHART_KINDS'), reading: list('READING_CHART_KINDS') };
}

/** Every chart kind Core delivers, and whether Forge emits each reading kind (F1.0) as a visual.chart.v2 segment in all three locales. */
export function chartCoverage(groups, rows) {
  const seen = new Map();
  for (const row of rows) for (const segment of row.document?.segments ?? []) {
    if (segment.type !== 'visual.chart.v2' || typeof segment.visual?.type !== 'string') continue;
    const set = seen.get(segment.visual.type) ?? new Set();
    set.add(row.locale);
    seen.set(segment.visual.type, set);
  }
  const emitted = (kind) => LOCALES.every((locale) => seen.get(kind)?.has(locale));
  const readingMissing = groups.reading.filter((kind) => !emitted(kind));
  return {
    kinds: groups.core.length + groups.situational.length + groups.reading.length,
    core: groups.core.length,
    situational: groups.situational.length,
    reading: groups.reading.length,
    reading_covered: groups.reading.length - readingMissing.length,
    reading_missing: readingMissing,
    forge_emitted: [...groups.core, ...groups.situational, ...groups.reading].filter(emitted).length,
  };
}

/** Each pack is `{ id, types, boards, contract }`: its segment types and the sources that must name every one. */
export function horizonteCoverage(packs) {
  let types = 0; let withBoard = 0; let withContract = 0; const missing = [];
  for (const pack of packs) for (const type of pack.types) {
    types += 1;
    const board = new RegExp(`^\\s*'${type.replace(/\./g, '\\.')}'\\s*:`, 'm').test(pack.boards);
    const contract = pack.contract.includes(`'${type}'`);
    if (board) withBoard += 1;
    if (contract) withContract += 1;
    if (!board || !contract) missing.push(type);
  }
  return {
    packs: packs.length, segment_types: types, with_board: withBoard, with_contract: withContract,
    share: types === 0 ? null : Math.round((types - missing.length) / types * 10_000) / 10_000, missing,
  };
}

function readHorizontePacks() {
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
  const { core } = readHorizontePackSources(ROOT);
  return Object.entries(core).map(([id, source]) => ({
    id,
    types: Object.keys(extractCapabilityMap(source, packCapabilityName(id), { allowEmpty: true })).sort(),
    boards: read(path.join(HORIZONTE_BOARDS, id, 'boards.tsx')),
    contract: read(path.join(ROOT, 'backend/src/services/horizonte', id, 'contract.ts')),
  }));
}

export function buildReport(generatedAt) {
  const sources = files(BOARDS).map((file) => ({ file: path.relative(ROOT, file).replace(/\\/g, '/'), source: readFileSync(file, 'utf8') }));
  const kinds = Object.keys(extractCapabilityMap(readFileSync(CORE, 'utf8'), 'capabilities')).sort();
  const rows = JSON.parse(readFileSync(EMITTED, 'utf8'));
  return {
    generated_at: generatedAt,
    tap_alternative: tapCoverage(sources),
    locale_rendering: localeCoverage(kinds, rows),
    chart_kinds: chartCoverage(chartKindGroups(readFileSync(CHART_MODEL, 'utf8')), rows),
    horizonte: horizonteCoverage(readHorizontePacks()),
  };
}

function render(report) {
  return `// Generated by agent/tools/teaching-visual-coverage.mjs (Appendix P Part 8). Do not edit by hand.\nexport const TEACHING_VISUAL_COVERAGE = ${JSON.stringify(report, null, 2)} as const;\n`;
}

function summary(report) {
  const tap = report.tap_alternative; const locale = report.locale_rendering; const charts = report.chart_kinds; const hz = report.horizonte;
  return `tap alternatives ${tap.with_alternative}/${tap.drag_interactions}, locale rendering ${locale.covered}/${locale.kinds} kinds, `
    + `chart kinds ${charts.kinds} (reading ${charts.reading_covered}/${charts.reading} emitted in three locales), `
    + `Horizonte ${hz.packs} packs, ${hz.segment_types} segment types (${hz.with_board} boards, ${hz.with_contract} contracts).`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    const stamp = /"generated_at": "([^"]+)"/.exec(current)?.[1] ?? '';
    const report = buildReport(stamp);
    if (current !== render(report)) {
      console.error('Teaching-visual coverage drift: run node agent/tools/teaching-visual-coverage.mjs and commit the snapshot.');
      process.exitCode = 1;
    } else {
      console.log(`Teaching-visual coverage OK: ${summary(report)}`);
    }
  } else {
    const report = buildReport(new Date().toISOString().slice(0, 10));
    writeFileSync(OUT, render(report));
    console.log(`Wrote ${path.relative(ROOT, OUT)}: ${summary(report)}`);
  }
}
