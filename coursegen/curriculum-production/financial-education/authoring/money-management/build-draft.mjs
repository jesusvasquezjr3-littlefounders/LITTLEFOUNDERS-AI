import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPlans, lessonKcMapping, proposedSkills } from './index.mjs';

// Cross-domain names are provisional in this isolated draft. The coordinator resolves the shared graph.
const resolve = id => lessonKcMapping[id] ?? `prod.${id.replace('fe-production-', '').replace(/-(\d+)$/, '.$1')}`;
const plans = buildPlans(resolve);
const directory = new URL('./draft-plans/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const plan of plans) writeFileSync(new URL(`${plan.lesson_id}.json`, directory), `${JSON.stringify(plan, null, 2)}\n`);
writeFileSync(new URL('./draft-manifest.json', import.meta.url), `${JSON.stringify({ authoring_complete: false, publication_authorized: false, lessons: plans.length, proposedSkills, cross_domain_mapping: 'provisional-until-coordinator-reconciliation' }, null, 2)}\n`);
console.log(`Wrote ${plans.length} isolated drafts; no release authorization or whole-course claim.`);
