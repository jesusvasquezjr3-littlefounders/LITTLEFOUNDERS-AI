// Reward-mechanic structural gate — Appendix C Part 3, Stage 2, gate 7 (B.22,
// S05.3e). Policy: docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md §3.
//
// Product 10 B.22: no randomized or variable-ratio reward mechanic may reach a
// minor. Every reward must be predictable and tied to a specific, understood
// action. For a lesson document that means:
//
//   BLOCKING (structural, no judgment needed)
//     * a reward field (a segment's `xp`, anything under `scoring`, or any key
//       naming a reward: xp, coins, reward, bonus, prize) whose value is not a
//       fixed number, a boolean or null: a range, an array of outcomes, a
//       weighted table or a formula string is a draw by construction;
//     * any key, anywhere in `scoring`, a segment's own fields (outside its
//       teaching payload) or a reward object, that names chance: random,
//       chance, probability, odds, lottery, loot, gacha, mystery, jackpot,
//       surprise, roll, drop rate, weighted reward, bonus pool, variable ratio.
//
//   REVIEW (flagged for the Stage 3 pedagogical reviewer, not blocking)
//     * learner-facing text that uses mystery-reward language ("mystery box",
//       "spin the wheel", "surprise prize", in three languages). A teen lesson
//       may legitimately TEACH the odds of a loot box as risk and expected
//       value; the reviewer decides whether the text teaches the mechanic or
//       dangles it. The code and copy of the product itself are held to the
//       stricter repository gate (agent/tools/check-reward-mechanics.mjs).
//
// Pure over the raw document, so it reports even when the contract gate (1)
// fails, and itemizes each finding by path, per Appendix C's "which gate,
// which exact content span, why".

export interface RewardMechanicFinding {
  path: string;
  segmentId?: string;
  message: string;
}

export interface RewardMechanicReport {
  blocking: RewardMechanicFinding[];
  review: RewardMechanicFinding[];
}

const CHANCE_KEY = /(random|chance|probab|odds|lotter|loot|gacha|myster|jackpot|surprise|(^|_)roll|drop_?rate|weighted_?(reward|xp|prize)|bonus_?pool|variable_?ratio)/i;
const REWARD_KEY = /^(xp|xp_[a-z_]+|coins?|reward[a-z_]*|bonus[a-z_]*|prizes?)$/i;

export const MYSTERY_REWARD_LEXICON: readonly RegExp[] = [
  /\bmystery\s+(?:box(?:es)?|rewards?|prizes?|chests?|gifts?|crates?|packs?|eggs?)\b/i,
  /\bloot(?:\s*box(?:es)?|\s*drops?)?\b/i,
  /\bgacha\b/i,
  /\blucky\s+(?:draws?|spins?|box(?:es)?|dips?)\b/i,
  /\bspin\s+(?:the|to)\s+(?:wheel|win)\b/i,
  /\bprize\s+wheels?\b/i,
  /\bscratch\s+cards?\b/i,
  /\b(?:random|randomi[sz]ed|surprise)\s+(?:rewards?|prizes?|bonus(?:es)?|box(?:es)?|chests?|drops?|tiers?)\b/i,
  /\bcajas?\s+(?:misteriosas?|sorpresa)\b/i,
  /\bpremios?\s+(?:sorpresa|misteriosos?|aleatorios?)\b/i,
  /\brecompensas?\s+(?:aleatori[ao]s?|aleatória|sorpresa|surpresa|misteriosas?)\b/i,
  /\bruleta\s+de\s+premios\b/i,
  /\brasca\s+y\s+gana\b/i,
  /\bcaixas?\s+(?:misteriosas?|surpresa)\b/i,
  /\bprêmios?\s+(?:surpresa|misteriosos?|aleatórios?)\b/i,
  /\bbaús?\s+(?:misteriosos?|surpresa)\b/i,
  /\broleta\s+de\s+prêmios\b/i,
  /\braspadinhas?\b/i,
];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fixedScalar(value: unknown): boolean {
  return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

/** Every key under `node` that names chance, with its path. */
function chanceKeys(node: unknown, path: string, out: RewardMechanicFinding[], segmentId?: string): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => chanceKeys(item, `${path}[${index}]`, out, segmentId));
    return;
  }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`;
    if (CHANCE_KEY.test(key)) out.push({ path: here, segmentId, message: `"${key}" names a chance-based reward; rewards must be fixed and tied to an understood action (B.22)` });
    chanceKeys(value, here, out, segmentId);
  }
}

/** A reward value must be a fixed number (or a boolean/null flag), never a range, a table or a formula. */
function rewardValues(node: unknown, path: string, out: RewardMechanicFinding[], segmentId?: string): void {
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`;
    if (REWARD_KEY.test(key)) {
      if (isRecord(value)) {
        for (const [inner, innerValue] of Object.entries(value)) {
          if (!fixedScalar(innerValue)) out.push({ path: `${here}.${inner}`, segmentId, message: `reward value is not a fixed number (B.22)` });
        }
      } else if (!fixedScalar(value)) {
        out.push({ path: here, segmentId, message: `reward value ${JSON.stringify(value)} is not a fixed number; a range or a list of outcomes is a draw (B.22)` });
      }
    }
  }
}

function strings(node: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof node === 'string') visit(node, path);
  else if (Array.isArray(node)) node.forEach((item, index) => strings(item, `${path}[${index}]`, visit));
  else if (isRecord(node)) for (const [key, value] of Object.entries(node)) strings(value, `${path}.${key}`, visit);
}

export function runRewardMechanicGate(rawDocument: unknown): RewardMechanicReport {
  const report: RewardMechanicReport = { blocking: [], review: [] };
  if (!isRecord(rawDocument)) return report;
  const doc = rawDocument as Record<string, Json>;

  if (doc.scoring !== undefined) {
    chanceKeys(doc.scoring, 'scoring', report.blocking);
    if (isRecord(doc.scoring)) {
      for (const [key, value] of Object.entries(doc.scoring)) {
        if (!fixedScalar(value)) report.blocking.push({ path: `scoring.${key}`, message: `scoring value is not fixed; the reward rule must be predictable (B.22)` });
      }
    }
  }
  for (const [key, value] of Object.entries(doc)) {
    if (key !== 'segments' && key !== 'scoring' && REWARD_KEY.test(key)) {
      chanceKeys(value, key, report.blocking);
      rewardValues({ [key]: value }, '', report.blocking);
    }
  }

  const segments = Array.isArray(doc.segments) ? doc.segments : [];
  segments.forEach((segment, index) => {
    if (!isRecord(segment)) return;
    const id = typeof segment.id === 'string' ? segment.id : undefined;
    const base = `segments[${index}]`;
    // A segment's own fields (not its teaching payload) carry its reward.
    for (const [key, value] of Object.entries(segment)) {
      if (key === 'payload') continue;
      if (CHANCE_KEY.test(key)) report.blocking.push({ path: `${base}.${key}`, segmentId: id, message: `"${key}" names a chance-based reward (B.22)` });
      if (REWARD_KEY.test(key)) {
        chanceKeys(value, `${base}.${key}`, report.blocking, id);
        rewardValues({ [key]: value }, base, report.blocking, id);
      }
    }
    if (segment.xp !== undefined && !(typeof segment.xp === 'number' && Number.isInteger(segment.xp) && segment.xp >= 0)) {
      if (!report.blocking.some((finding) => finding.path === `${base}.xp`)) {
        report.blocking.push({ path: `${base}.xp`, segmentId: id, message: `xp must be a fixed whole number (B.22)` });
      }
    }
    // Reward objects inside a payload (a story's "prize", an activity's "bonus") are held to the same rule.
    if (isRecord(segment.payload)) rewardValues(segment.payload, `${base}.payload`, report.blocking, id);
  });

  strings(rawDocument, '', (text, path) => {
    for (const pattern of MYSTERY_REWARD_LEXICON) {
      const match = text.match(pattern);
      if (match) {
        report.review.push({ path: path.replace(/^\./, ''), message: `mystery-reward language "${match[0]}": the Stage 3 reviewer confirms it teaches the mechanic and never offers it (B.22)` });
        break;
      }
    }
  });
  return report;
}
