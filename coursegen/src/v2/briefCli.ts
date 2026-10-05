// v2:brief — prints the writing-skills prompt block for one lesson, so an
// agentic author (Claude Code) writes with the same craft rules Forge's
// `authoringMessages` hands the model. Zero spend, no database access.
//
//   npm run v2:brief -- --age-band 10-12 --min-age 10 --max-age 12 --mentor rho
//   npm run v2:brief -- --age-band adult --min-age 18 --max-age 99 --mentor dina --roles hook,example,guided,practice,transfer
//
// --roles lists the teaching roles the lesson will use (default: all six).
//   npm run v2:brief -- --types --age-band 13-17 --min-age 13 --max-age 17   (segment types this pathway may use)

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { V2_AGE_BANDS, V2_SEGMENT_TYPES } from './contract.js';
import { v2AgeScopeProblem } from './v2SegmentFamilies.generated.js';
import { V2_TEACHING_ROLES, type V2LessonPlan, type V2TeachingRole } from './plan.js';
import { writingSkillsPrompt } from './writingSkills.js';

const MENTORS = ['rho', 'zara', 'liruf', 'dina'] as const;
type Mentor = (typeof MENTORS)[number];

type Args = Record<string, string | true>;
function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (!flag.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[flag.slice(2)] = true;
    else { out[flag.slice(2)] = next; i += 1; }
  }
  return out;
}

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../backend');

/** Horizonte kinds carry their age scope in Core's packs; ask Core's own check so the list cannot drift. */
function horizonteScope(band: string, minAge: number, maxAge: number): { closed: Set<string> } {
  const tsx = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  try {
    const out = execFileSync(process.execPath, [tsx, 'scripts/v2-open-types.ts', band, String(minAge), String(maxAge)], { cwd: BACKEND_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { closed: new Set((JSON.parse(out) as { closed: string[] }).closed) };
  } catch {
    console.error('v2:brief: could not ask Core for the Horizonte age scopes (is backend/ installed?); the list below can over-report Horizonte kinds');
    return { closed: new Set() };
  }
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const text = (name: string): string | undefined => (typeof args[name] === 'string' ? (args[name] as string) : undefined);
  const band = text('age-band');
  const minAge = Number(text('min-age'));
  const maxAge = Number(text('max-age'));
  const mentor = text('mentor');
  const problems: string[] = [];
  if (!band || !(V2_AGE_BANDS as readonly string[]).includes(band)) problems.push(`--age-band must be one of ${V2_AGE_BANDS.join(', ')}`);
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge > maxAge) problems.push('--min-age and --max-age must be integers with min <= max');
  if (mentor && !(MENTORS as readonly string[]).includes(mentor)) problems.push(`--mentor must be one of ${MENTORS.join(', ')}`);
  const roles = (text('roles')?.split(',').map((role) => role.trim()).filter(Boolean) ?? [...V2_TEACHING_ROLES]) as V2TeachingRole[];
  for (const role of roles) if (!(V2_TEACHING_ROLES as readonly string[]).includes(role)) problems.push(`--roles: "${role}" is not one of ${V2_TEACHING_ROLES.join(', ')}`);
  if (problems.length) { console.error(`v2:brief: ${problems.join('; ')}`); return 1; }

  if (args.types === true) {
    const document = { age_band: band!, eligibility: { minimum_age: minAge, maximum_age: maxAge } };
    const horizonte = horizonteScope(band!, minAge, maxAge);
    const open: string[] = [];
    const closed: string[] = [];
    for (const type of V2_SEGMENT_TYPES) {
      const isOpen = v2AgeScopeProblem(type, document) === null && !horizonte.closed.has(type);
      (isOpen ? open : closed).push(type);
    }
    console.log(`Segment types open to ${band} (eligibility ${minAge}-${maxAge}):\n  ${open.join('\n  ')}`);
    console.log(`\nNot open here:\n  ${closed.join('\n  ')}`);
    console.log('\n"Open" means Core accepts the type for this band, not that it fits the learner: several kinds declare no age scope at all (e.g. amortization, debt-payoff, rule-of-72 are open to a 7-year-old). Choose by the concept and the age, and follow the structure entry.');
    return 0;
  }

  const skeleton = {
    eligibility: { minimum_age: minAge, maximum_age: maxAge },
    age_band: band as V2LessonPlan['age_band'],
    mentor_stage: mentor ? { character: mentor as Mentor, scene: 'diorama-a' as const } : undefined,
    segments: roles.map((role, index) => ({ id: `s${index + 1}`, teaching_role: role })),
  } as unknown as Pick<V2LessonPlan, 'eligibility' | 'age_band' | 'mentor_stage' | 'segments'>;
  console.log(writingSkillsPrompt(skeleton).join('\n'));
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
