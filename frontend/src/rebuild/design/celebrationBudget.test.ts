import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MILESTONES, celebrationsFrom, crossedStreakMilestone, mayCelebrate, streakMilestone } from './milestones';

/*
 * B.20 acceptance (Product 10): "an automated check that no celebration effect
 * fires outside the milestone list" (OD-7; Frontend Bible 02 D7, rule 17).
 *
 * Two halves:
 *  1. STATIC. Every celebration effect in the frontend source (confetti,
 *     floating XP or coin amounts, the burst ring, spring overshoot, the
 *     streak takeover and pill) is found by pattern, and each file that uses
 *     one must be a registered consumer that decides through the milestone
 *     gate (rebuild/design/milestones.ts), or the effect's own definition
 *     mounted only by such a consumer. A new effect anywhere else fails here.
 *  2. RUNTIME. The gate functions themselves: only the closed list, only what
 *     Core named, and only a streak that crossed 7, 30 or 100 days. The live
 *     lesson player's own gate is tested beside it
 *     (lesson-engine/player/celebrationGate.test.ts), since a rebuilt file may
 *     not import the legacy player (Bible 02 rule 23).
 */

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel = (file: string) => path.relative(src, file).split(path.sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules' && name !== '__tests__') walk(full, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Strip comments so a sentence ABOUT confetti is not an effect. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const EFFECTS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'burst ring', pattern: /\blf-burst\b/ },
  { name: 'reward landing overshoot', pattern: /\blf-land\b/ },
  { name: 'streak takeover', pattern: /<StreakCelebration\b/ },
  { name: 'Mentor streak pill', pattern: /<GamificationCelebration\b/ },
  { name: 'streak flame effect', pattern: /\blf-streak-(?:ring|spark|number|flame)\b/ },
  { name: 'confetti', pattern: /confetti\s*\(|from\s+['"][^'"]*confetti|<Confetti\b|\bconfetti\b[^;\n]*className|className[^;\n]*\bconfetti\b/i },
  { name: 'XP or coin floater', pattern: /\b(?:xp|coin)-?float(?:er|ing)?\b|\b(?:xp|coin)Float(?:er|ing)?\b/i },
  { name: 'spring overshoot (rebuild tokens)', pattern: /var\(--ease-spring\)|var\(--dur-celebration\)/ },
  { name: 'spring overshoot (literal)', pattern: /cubic-bezier\(\s*0?\.34\s*,\s*1\.5\d*/ },
];

/*
 * Registered consumers. `gate` must appear in the file: the proof that the
 * effect is decided by the milestone list. `mountedBy` restricts an effect's
 * own component to the listed files.
 */
const CONSUMERS: Record<string, { gate: RegExp; reason: string }> = {
  'lesson-engine/player/LessonPlayer.tsx': { gate: /streakCelebrationFor\(server\)/, reason: 'the streak takeover, only for a streak milestone Core named' },
  'lesson-engine/player/StreakCelebration.tsx': { gate: /export function StreakCelebration/, reason: 'the takeover itself; mounted only by LessonPlayer' },
  'tutor/hud/GamificationCelebration.tsx': { gate: /export function GamificationCelebration/, reason: 'the Mentor pill itself; mounted only by ConversationView' },
  'tutor/ConversationView.tsx': { gate: /streakJustAdvanced|GamificationCelebration streakDays/, reason: 'mounts the pill on useTutorLearningStats\' milestone flag' },
  'rebuild/learning/LessonResultView.tsx': { gate: /mayCelebrate\(|celebrationsFrom\(/, reason: 'the lesson-complete and streak milestone moments on the result screen' },
  'rebuild/learning/result.css': { gate: /\[data-celebrate/, reason: 'milestone motion bound to [data-celebrate], which only the gate sets' },
};

/*
 * Definitions and legacy exceptions, closed. Token and keyframe DEFINITIONS
 * are not effects firing. The four legacy 2D characters bounce when tapped
 * (a character reaction, not a reward); they are retired with the legacy UI
 * (Bible 02 rule 21: Mentor characters are 3D renders only) and nothing new
 * may join them.
 */
const DEFINITIONS: Record<string, string> = {
  'index.css': 'legacy keyframes and the --lf-ease-tactile token (definitions only; .lf-land has no consumer)',
  'rebuild/design/system.css': 'the --ease-spring and --dur-celebration tokens (definitions only)',
  'components/characters/DinaCharacter.tsx': 'legacy 2D character tap reaction, retired in wave 2',
  'components/characters/DrRhoCharacter.tsx': 'legacy 2D character tap reaction, retired in wave 2',
  'components/characters/LirufCharacter.tsx': 'legacy 2D character tap reaction, retired in wave 2',
  'components/characters/ZaraVexCharacter.tsx': 'legacy 2D character tap reaction, retired in wave 2',
};

const MOUNTS: Record<string, string[]> = {
  StreakCelebration: ['lesson-engine/player/LessonPlayer.tsx'],
  GamificationCelebration: ['tutor/ConversationView.tsx'],
};

const files = walk(src).map((file) => ({ file: rel(file), text: readFileSync(file, 'utf8') }));

describe('B.20 celebration budget: static scan of every celebration effect', () => {
  it('finds the effects it is meant to find (the scan is live, not vacuous)', () => {
    const hits = files.filter(({ text }) => EFFECTS.some(({ pattern }) => pattern.test(code(text))));
    expect(hits.map((h) => h.file)).toEqual(expect.arrayContaining(['lesson-engine/player/LessonPlayer.tsx', 'tutor/hud/GamificationCelebration.tsx']));
  });

  it('every file that uses a celebration effect is a registered, gated consumer or a closed-list definition', () => {
    const findings: string[] = [];
    for (const { file, text } of files) {
      const stripped = code(text);
      const effects = EFFECTS.filter(({ pattern }) => pattern.test(stripped)).map(({ name }) => name);
      if (effects.length === 0 || DEFINITIONS[file]) continue;
      const consumer = CONSUMERS[file];
      if (!consumer) findings.push(`${file}: ${effects.join(', ')} is not decided by the OD-7 milestone list`);
      else if (!consumer.gate.test(text)) findings.push(`${file}: registered, but its gate (${consumer.gate}) is gone`);
    }
    expect(findings).toEqual([]);
  });

  it('each effect component is mounted only by its gated consumer', () => {
    for (const [component, allowed] of Object.entries(MOUNTS)) {
      const mounts = files.filter(({ text }) => new RegExp(`<${component}\\b`).test(code(text))).map(({ file }) => file);
      expect(mounts, component).toEqual(allowed);
    }
  });

  it('the Mentor pill\'s flag comes from the streak-milestone crossing, and the lesson burst is gone', () => {
    const stats = files.find(({ file }) => file === 'tutor/useTutorLearningStats.ts')!.text;
    expect(stats).toMatch(/crossedStreakMilestone\(lastSeen, stats\.streakDays\)/);
    const player = files.find(({ file }) => file === 'lesson-engine/player/LessonPlayer.tsx')!.text;
    expect(code(player)).not.toMatch(/lf-burst|<CountUp/);
  });

  it('rebuilt surfaces never use the spring or celebration tokens outside the result screen\'s milestone rule', () => {
    const rebuilt = files.filter(({ file }) => file.startsWith('rebuild/') && file !== 'rebuild/design/system.css');
    const users = rebuilt.filter(({ text }) => /var\(--ease-spring\)|var\(--dur-celebration\)/.test(code(text))).map(({ file }) => file);
    expect(users.every((file) => file === 'rebuild/learning/result.css')).toBe(true);
  });

  it('the definitions list is closed', () => {
    expect(Object.keys(DEFINITIONS).sort()).toEqual([
      'components/characters/DinaCharacter.tsx', 'components/characters/DrRhoCharacter.tsx', 'components/characters/LirufCharacter.tsx',
      'components/characters/ZaraVexCharacter.tsx', 'index.css', 'rebuild/design/system.css',
    ]);
  });
});

describe('B.20 celebration budget: the gate functions', () => {
  it('the list is exactly OD-7', () => {
    expect(MILESTONES).toEqual(['lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100']);
  });

  it('keeps only closed-list values from the server, and refuses anything malformed', () => {
    expect(celebrationsFrom(['lesson-complete', 'correct-answer', 'coin-split', 'streak-8', 'streak-7', 'lesson-complete', 3]))
      .toEqual(['lesson-complete', 'streak-7']);
    expect(celebrationsFrom('lesson-complete')).toEqual([]);
    expect(celebrationsFrom(undefined)).toEqual([]);
    expect(mayCelebrate(['badge-earned'], 'lesson-complete')).toBe(false);
  });

  it('only 7, 30 and 100 days are streak milestones, and only when crossed', () => {
    expect([6, 7, 8, 29, 30, 31, 99, 100, 101].map(streakMilestone)).toEqual([null, 'streak-7', null, null, 'streak-30', null, null, 'streak-100', null]);
    expect(crossedStreakMilestone(null, 7)).toBeNull();
    expect(crossedStreakMilestone(6, 7)).toBe('streak-7');
    expect(crossedStreakMilestone(5, 9)).toBe('streak-7');
    expect(crossedStreakMilestone(7, 8)).toBeNull();
    expect(crossedStreakMilestone(11, 12)).toBeNull();
    expect(crossedStreakMilestone(12, 1)).toBeNull();
    expect(crossedStreakMilestone(2, 120)).toBe('streak-100');
  });
});
