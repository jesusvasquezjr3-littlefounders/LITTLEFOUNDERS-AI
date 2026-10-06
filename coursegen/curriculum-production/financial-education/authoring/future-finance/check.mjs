import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPlans, authoredLessonIds } from './index.mjs';
import { assemble } from './helpers.mjs';

const plans = buildPlans();
assert.equal(new Set(authoredLessonIds).size, plans.length);
// Validate isolated authored modules before adding them to the coherent export.
for (const moduleName of process.argv.slice(2)) {
  assert(/^[a-z-]+\.mjs$/u.test(moduleName));
  const module = await import(new URL(moduleName, import.meta.url));
  const rows = Object.values(module).flatMap(value => Array.isArray(value) ? value : []);
  const existing = new Set(plans.map(plan => plan.lesson_id));
  plans.push(...assemble(rows.filter(row => !existing.has(row.id))));
  if (typeof module.attachCreditRecovery === 'function') module.attachCreditRecovery(plans);
}
assert.equal(new Set(plans.map(plan => plan.lesson_id)).size, plans.length);
const overBudget = [];
const words = text => text.trim().split(/\s+/u).filter(Boolean).length;
for (const plan of plans) {
  assert.equal(plan.segments.filter(segment => segment.grading === 'server').length, plan.instruction.kind === 'teach' ? 6 : plan.instruction.retrieval_skills.length + 1);
  for (const skill of plan.instruction.retrieval_skills) assert(plan.instruction.evidence.some(item => item.skill_id === skill && plan.segments.find(segment => segment.id === item.segment_id)?.grading === 'server'), `Missing retrieval evidence for ${skill}`);
  for (const segment of plan.segments) {
    for (const [locale, copy] of Object.entries(segment.copy)) {
      assert(copy.prompt?.trim());
      if (segment.grading === 'server') {
        if (segment.type === 'story.branch.v2') assert(copy.scene?.trim());
        assert(copy.feedback.met?.trim());
        assert(copy.feedback.not_yet?.trim());
        if (copy.options) assert.equal(new Set(copy.options.map(option => option.label)).size, copy.options.length);
        const count = words([copy.prompt, copy.scene ?? '', ...(copy.options ?? []).map(option => option.label), copy.title ?? '', ...(copy.data?.categories ?? []).map(item => item.label), ...(copy.data?.series ?? []).map(item => item.label), ...(copy.data?.events ?? []).map(item => item.label), copy.question?.prompt ?? '', ...(copy.question?.options ?? []).map(item => item.label)].join(' '));
        if (count > (locale === 'en-US' ? 32 : 42)) overBudget.push({ lesson: plan.lesson_id, segment: segment.id, locale, count });
        if (locale === 'en-US') assert(words(copy.feedback.met) <= 12, `${plan.lesson_id}/${segment.id} success feedback`);
      } else if (locale === 'en-US') {
        for (const line of segment.type === 'voice.mentor-episode.v2' ? [copy.setup, copy.misjudgment, copy.recovery] : [copy.line]) assert(words(line) <= 20, `${plan.lesson_id}/${segment.id} Mentor line`);
      }
    }
  }
}
const output = new URL('./draft-plans/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const plan of plans) writeFileSync(new URL(`${plan.lesson_id}.json`, output), `${JSON.stringify(plan, null, 2)}\n`);
writeFileSync(new URL('./copy-review.json', import.meta.url), `${JSON.stringify(overBudget, null, 2)}\n`);
console.log(JSON.stringify({ authored: plans.length, localizedGraded: plans.reduce((sum, plan) => sum + 3 * plan.segments.filter(segment => segment.grading === 'server').length, 0), compactCopyFindings: overBudget }));
