import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Strategy } from '../context/schema.js';

/*
 * PEDAGOGICAL SKILLS — the tutor's procedural memory (V4, harness pattern A).
 *
 * A strategy used to reach the model as one sentence: "Strategy for this turn:
 * SOCRATIC. Ask ONE guiding question…". A human tutor's edge over a chatbot is
 * not that they know which strategy to use — it is that they carry a CATALOGUE
 * of worked-out didactic maneuvers, indexed by situation, each with its own
 * procedure, its own failure modes, and its own definition of "it worked".
 * That is what the harness blueprint calls skills: procedural memory, loaded
 * only when relevant (progressive disclosure), selected deterministically.
 *
 * THE FAST CHAMBER NEVER THINKS ABOUT THIS. Selection is metadata filtering —
 * a Map lookup and a few comparisons, ~0 tokens, microseconds. No agent loop,
 * no model call, no file I/O after boot. The whole catalogue is read ONCE at
 * startup and held in memory; only the SELECTED skill's body travels to the
 * model, appended to the turn's user content, so the prefix cache is untouched.
 *
 * Files live in `oracle/skills/moves/*.md` — in the repo, versioned, reviewed
 * through pull requests. That IS the approval gate the blueprint requires
 * (§15.1: no autonomous content reaches a child): today every skill is
 * hand-written and code-reviewed; the self-authoring loop, when it arrives,
 * stages proposals for the same review instead of writing here directly.
 */

export interface PedagogicalSkill {
  name: string;
  description: string;
  /** Strategies this maneuver implements. A skill may serve several. */
  strategies: Strategy[];
  /** Misconception codes this maneuver specifically remediates. */
  misconceptions: string[];
  /** Mastery band [min, max) in which the maneuver is appropriate. */
  masteryMin: number;
  masteryMax: number;
  /** Content tiers (age bands) the wording suits. */
  tiers: number[];
  /** Higher wins among candidates that pass every filter. */
  priority: number;
  /**
   * The skill's own procedure forbids reusing it in the same session — found
   * live: `counterexample-confront`'s body says "ONE counterexample per
   * session, ever" while `selectSkill` is a pure function of the CURRENT
   * turn's strategy/tier/misconception, with no memory of what it already
   * returned. A learner who fails the same skill four times in one session
   * got the identical confrontation, and near-identical wording, four times —
   * the exact "told, not checked" gap this catalogue exists to close for the
   * strategy layer above it.
   */
  onceOnly: boolean;
  /** The procedure — what actually reaches the model. */
  body: string;
}

/**
 * Bodies are spoken to the model every turn they are selected, so they have a
 * hard budget the way learner memory does. A skill that cannot say its
 * procedure in this space is two skills.
 */
export const SKILL_BODY_MAX_CHARS = 1_600;

/*
 * A deliberately minimal frontmatter reader. The format is a closed set of
 * `key: value` lines between `---` fences — strings, numbers, and `[a, b]`
 * lists. Bringing in a YAML parser for that would add a dependency with its
 * own parsing surface to a service that feeds children; forty lines we fully
 * understand beat four thousand we do not.
 */
function parseFrontmatter(raw: string, file: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---\n')) throw new Error(`${file}: missing frontmatter opening fence`);
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`${file}: missing frontmatter closing fence`);
  const meta: Record<string, string> = {};
  for (const line of raw.slice(4, end).split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`${file}: frontmatter line without a colon: "${line}"`);
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { meta, body: raw.slice(end + 5).trim() };
}

function list(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

const STRATEGY_NAMES = new Set<string>([
  'DIRECT',
  'WORKED',
  'FADED',
  'SOCRATIC',
  'FLUENCY',
  'SPACED',
  'PROBE',
  'REMEDIATE',
  'RESCUE',
  'ELABORATE',
  'TRANSFER',
  'CELEBRATE',
]);

function parseSkill(file: string, raw: string): PedagogicalSkill {
  const { meta, body } = parseFrontmatter(raw, file);
  const name = meta.name ?? '';
  if (name === '') throw new Error(`${file}: skill has no name`);
  if (body.length === 0) throw new Error(`${file}: skill has no body`);
  if (body.length > SKILL_BODY_MAX_CHARS) {
    throw new Error(
      `${file}: body is ${body.length} chars (max ${SKILL_BODY_MAX_CHARS}). ` +
        'A procedure that cannot fit is two skills — split it.',
    );
  }
  const strategies = list(meta.strategies);
  for (const s of strategies) {
    if (!STRATEGY_NAMES.has(s)) throw new Error(`${file}: unknown strategy "${s}"`);
  }
  const masteryMin = meta.mastery_min === undefined ? 0 : Number(meta.mastery_min);
  const masteryMax = meta.mastery_max === undefined ? 1 : Number(meta.mastery_max);
  if (!Number.isFinite(masteryMin) || !Number.isFinite(masteryMax) || masteryMin >= masteryMax) {
    throw new Error(`${file}: invalid mastery band [${meta.mastery_min}, ${meta.mastery_max}]`);
  }
  const tiers = list(meta.tiers).map(Number);
  if (tiers.some((t) => !Number.isInteger(t) || t < 1 || t > 3)) {
    throw new Error(`${file}: tiers must be integers 1-3`);
  }
  return {
    name,
    description: meta.description ?? '',
    strategies: strategies as Strategy[],
    misconceptions: list(meta.misconceptions),
    masteryMin,
    masteryMax,
    tiers: tiers.length > 0 ? tiers : [1, 2, 3],
    priority: meta.priority === undefined ? 0 : Number(meta.priority),
    onceOnly: meta.once_per_session === 'true',
    body,
  };
}

/** Read once at boot; loud on ANY malformed file — a broken catalogue must fail deploy, not a turn. */
function loadCatalogue(): PedagogicalSkill[] {
  const dir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../skills/moves');
  const skills = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseSkill(f, readFileSync(path.join(dir, f), 'utf8')));
  const names = new Set<string>();
  for (const s of skills) {
    if (names.has(s.name)) throw new Error(`duplicate skill name: ${s.name}`);
    names.add(s.name);
  }
  return skills;
}

let catalogue: PedagogicalSkill[] | null = null;

export function skillCatalogue(): PedagogicalSkill[] {
  catalogue ??= loadCatalogue();
  return catalogue;
}

export interface SkillQuery {
  strategy: Strategy;
  tier: number;
  /** Current mastery estimate for the active KC; null when unknown. */
  pKnown: number | null;
  misconceptionCode: string | null;
  /**
   * Skill names already delivered earlier in THIS session — so a skill whose
   * own procedure says "once, ever" (`onceOnly`) can be fenced out on a
   * repeat visit instead of being selected identically every time the same
   * misconception or strategy comes back. Skills without that flag ignore
   * this set entirely; reuse is fine for the rest of the catalogue.
   */
  usedSkillNames: ReadonlySet<string>;
}

/**
 * Deterministic selection, blueprint §6.4 levels 0-1.
 *
 * A catalogued misconception with a dedicated remediation always wins — the
 * specific procedure beats the general one. Otherwise: filter by strategy,
 * tier, and mastery band, then highest priority. Null when nothing fits, and
 * null must cost nothing: the caller falls back to the strategy's one-line
 * instruction, which is exactly the pre-V4 behaviour.
 */
export function selectSkill(query: SkillQuery): PedagogicalSkill | null {
  const all = skillCatalogue();
  const notSpent = (s: PedagogicalSkill) => !s.onceOnly || !query.usedSkillNames.has(s.name);

  if (query.misconceptionCode !== null) {
    const dedicated = all
      .filter((s) => s.misconceptions.includes(query.misconceptionCode as string))
      .filter((s) => s.tiers.includes(query.tier))
      .filter(notSpent);
    if (dedicated.length > 0) {
      return dedicated.sort((a, b) => b.priority - a.priority)[0]!;
    }
  }

  const candidates = all
    .filter((s) => s.strategies.includes(query.strategy))
    /*
     * A skill dedicated to specific misconceptions is reachable ONLY through
     * them. counterexample-confront's own procedure forbids using it on a
     * careless slip — it needs a learner who holds an explicit wrong rule —
     * and yet, listed under REMEDIATE with high priority, it was winning the
     * GENERIC selection too. The metadata that targets a skill narrowly must
     * also fence it out of the broad path.
     */
    .filter((s) => s.misconceptions.length === 0)
    .filter((s) => s.tiers.includes(query.tier))
    .filter(notSpent)
    .filter((s) => {
      // No estimate means no band filter: never let missing data hide the
      // only skill a strategy has.
      if (query.pKnown === null) return true;
      return query.pKnown >= s.masteryMin && query.pKnown < s.masteryMax;
    });
  if (candidates.length === 0) {
    // The band may have excluded everything; retry without it so a strategy
    // with any skill at all is never left with none.
    const anyBand = all
      .filter((s) => s.strategies.includes(query.strategy))
      .filter((s) => s.misconceptions.length === 0)
      .filter((s) => s.tiers.includes(query.tier))
      .filter(notSpent);
    if (anyBand.length === 0) return null;
    return anyBand.sort((a, b) => b.priority - a.priority)[0]!;
  }
  return candidates.sort((a, b) => b.priority - a.priority)[0]!;
}
