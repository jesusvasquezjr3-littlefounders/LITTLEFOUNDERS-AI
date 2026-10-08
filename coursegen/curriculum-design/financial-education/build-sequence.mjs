import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { objectives, openingBridge } from './objectives.mjs';
import { domains, requirements } from './dependencies.mjs';

const scopeUrl = new URL('./scope.json', import.meta.url);
const lessonId = (domain, index) => `fe-production-${domain}-${String(index).padStart(2, '0')}`;

export function buildSequence(scope, inventory = objectives, edges = requirements) {
  const aliases = Object.entries(domains);
  const ordered = scope.domains.map(domain => domain.id);
  if (JSON.stringify(Object.keys(inventory)) !== JSON.stringify(ordered)) throw new Error('Objective domains must exactly match the ordered scope.');
  if (JSON.stringify(Object.keys(edges)) !== JSON.stringify(aliases.map(([alias]) => alias))) throw new Error('Dependency domains must exactly match the authored inventory.');
  const lessons = [];
  const authoredObjectives = new Set();
  for (const domain of ordered) {
    const alias = aliases.find(([, value]) => value === domain)?.[0];
    const rows = edges[alias].split('|').map(row => row.trim());
    if (rows.length !== inventory[domain].length) throw new Error(`${domain}: every objective needs an explicit dependency declaration.`);
    const teaching = [];
    if (domain === openingBridge.domain) {
      lessons.push({ ...openingBridge, kind: 'teach', prerequisites: [], retrieve_objectives: [], authoring_status: 'objective-and-dependencies-only' });
      teaching.push(openingBridge.lesson_id);
      authoredObjectives.add(openingBridge.objective.toLowerCase().replace(/\s+/g, ' ').trim());
    }
    for (const [index, objective] of inventory[domain].entries()) {
      if (typeof objective !== 'string' || objective.trim().length < 30) throw new Error(`${domain}: objective must name an observable task.`);
      const normalized = objective.toLowerCase().replace(/\s+/g, ' ').trim();
      if (authoredObjectives.has(normalized)) throw new Error(`${domain}: duplicate objective.`);
      authoredObjectives.add(normalized);
      const prerequisites = rows[index] === '-' ? [] : rows[index].split(/\s+/).map(reference => {
        const match = /^(?:([a-z]+)\.)?(0|[1-9][0-9]*)$/.exec(reference);
        if (!match) throw new Error(`Invalid dependency ${reference}.`);
        const targetDomain = match[1] ? domains[match[1]] : domain;
        if (!targetDomain) throw new Error(`Unknown dependency domain ${reference}.`);
        return lessonId(targetDomain, Number(match[2]));
      });
      const integrated = domain === 'integrated-decisions';
      const lesson = {
        lesson_id: lessonId(domain, index + 1), domain,
        kind: integrated ? 'capstone' : 'teach', objective, prerequisites,
        retrieve_objectives: integrated ? [...prerequisites] : [],
        authoring_status: 'objective-and-dependencies-only',
      };
      lessons.push(lesson);
      if (!integrated) teaching.push(lesson.lesson_id);
    }
    if (teaching.length) {
      // These slots reserve assessment capacity; they are not authored exercises.
      // Splitting at the midpoint leaves an intervening slot before recalling the last introduction.
      const midpoint = Math.ceil(teaching.length / 2);
      for (const [index, group] of [teaching.slice(0, midpoint), teaching.slice(midpoint)].entries()) {
        const crossDomain = lessons.filter(lesson => lesson.domain === domain && lesson.kind === 'teach')
          .flatMap(lesson => lesson.prerequisites)
          .find(reference => !teaching.includes(reference));
        const targets = [...group, ...(crossDomain ? [crossDomain] : [])];
        lessons.push({
          lesson_id: `fe-production-${domain}-review-${index + 1}`, domain, kind: 'consolidate',
          objective: null, prerequisites: [...targets], retrieve_objectives: targets,
          authoring_status: 'retrieval-reservation-not-implementation-evidence',
        });
      }
    }
  }
  const design = {
    version: 1, course_id: 'financial-education', audience: 'adult-beginners',
    status: 'proposed-lesson-sequence', playable_lessons: 0, production_release_authorized: false,
    calibration: { lessons: 36, owner_accepted: true, accepted_on: '2026-10-05', included_in_production_count: false },
    limitations: [
      'Dependencies are proposed instructional edges, not activated shared knowledge components.',
      'Structural retrieval slots do not prove elapsed-time spacing, assessment quality or retention.',
      'Review slots require authored integrated scenarios and independent evidence for each target.',
      'Every lesson still requires misconception, worked example, guided practice, fresh transfer, exact engine scoring and market evidence before generation.',
      'A passed structural check does not approve the sequence pedagogically or authorize publication.',
    ],
    sources: scope.sources, lessons,
  };
  const findings = checkSequence(design);
  if (findings.length) throw new Error(findings.join('\n'));
  return design;
}

export function checkSequence(design) {
  const findings = [];
  const introduced = new Map();
  const seen = new Set();
  const retrieved = new Set();
  for (const [position, lesson] of design.lessons.entries()) {
    if (seen.has(lesson.lesson_id)) findings.push(`Duplicate lesson ${lesson.lesson_id}.`);
    seen.add(lesson.lesson_id);
    for (const field of ['prerequisites', 'retrieve_objectives']) {
      if (new Set(lesson[field]).size !== lesson[field].length) findings.push(`${lesson.lesson_id}: repeated ${field}.`);
      for (const reference of lesson[field]) {
        if (!introduced.has(reference)) findings.push(`${lesson.lesson_id}: ${field} references an untaught objective ${reference}.`);
      }
    }
    if (lesson.kind === 'teach') introduced.set(lesson.lesson_id, position);
    else if (!['consolidate', 'capstone'].includes(lesson.kind)) findings.push(`${lesson.lesson_id}: unknown teaching role.`);
    if (lesson.kind === 'capstone' && lesson.retrieve_objectives.length < 3) findings.push(`${lesson.lesson_id}: capstone must combine at least three taught objectives.`);
    if (lesson.retrieve_objectives.length > 8) findings.push(`${lesson.lesson_id}: retrieval exceeds the reserved exercise capacity.`);
    for (const reference of lesson.retrieve_objectives) {
      const first = introduced.get(reference);
      if (first !== undefined && position - first >= 2) retrieved.add(reference);
      else findings.push(`${lesson.lesson_id}: retrieval needs prior teaching and an intervening lesson.`);
    }
  }
  for (const reference of introduced.keys()) if (!retrieved.has(reference)) findings.push(`${reference}: no later retrieval slot.`);
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sequence = buildSequence(JSON.parse(readFileSync(scopeUrl, 'utf8')));
  const destination = new URL('./lesson-sequence.json', import.meta.url);
  writeFileSync(destination, `${JSON.stringify(sequence, null, 2)}\n`);
  console.log(JSON.stringify({
    path: fileURLToPath(destination), totalPlannedSlots: sequence.lessons.length,
    authoredObjectives: sequence.lessons.filter(lesson => lesson.objective !== null).length,
    teaching: sequence.lessons.filter(lesson => lesson.kind === 'teach').length,
    retrievalSlots: sequence.lessons.filter(lesson => lesson.kind === 'consolidate').length,
    capstones: sequence.lessons.filter(lesson => lesson.kind === 'capstone').length,
    playableLessons: 0, findings: 0,
  }, null, 2));
}
