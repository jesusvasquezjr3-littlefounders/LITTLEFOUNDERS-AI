import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MILESTONES, celebrationsFrom, crossedStreakMilestone, mayCelebrate, streakMilestone } from './milestones';
import { ORCHESTRATED_MOTION } from './motion';

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
  // S05.3g lane review: the fanfare and the cast's celebrate action were not scanned.
  { name: 'celebration sound', pattern: /playSfx\(\s*['"]celebration['"]/ },
  { name: 'character celebrate action', pattern: /action=\{[^}\n]*['"]celebrate['"]/ },
  // OD-28 (V-12): a celebration motion asset (07 §5), e.g. the lesson-complete confetti.
  { name: 'celebration motion asset', pattern: /<MotionAsset\b|celebration\.[a-z-]+\.[a-z-]+['"]/ },
];

/*
 * Registered consumers. `gate` must appear in the file: the proof that the
 * effect is decided by the milestone list. `mountedBy` restricts an effect's
 * own component to the listed files.
 */
const CONSUMERS: Record<string, { gate: RegExp; reason: string }> = {
  'tutor-scene/Character3D.tsx': {
    gate: /if \(action === 'celebrate'\) playCelebrationSound\(\)/,
    reason: 'the sound of the celebrate action, played only when a caller names it: the lesson director never does per answer (director.test.ts) and the live results cast only for Core\'s lesson-complete. The live Mentor\'s turn schema is an open S06 item.',
  },
  'rebuild/learning/LessonResultView.tsx': { gate: /mayCelebrate\(|celebrationsFrom\(/, reason: 'the lesson-complete and streak milestone moments on the result screen' },
  'rebuild/learning/result.css': { gate: /\[data-celebrate/, reason: 'milestone motion bound to [data-celebrate], which only the gate sets' },
  'rebuild/design/motion.css': {
    gate: /\.lf-celebration--play/,
    reason: 'the S03.7 shared celebration parts, which move only under a playing Celebration; Celebration renders only for a closed-list milestone (motion.tsx isMilestone), and the result screen mounts it only for what Core named (mayCelebrate)',
  },
};

/*
 * Definitions and legacy exceptions, closed. Token and keyframe DEFINITIONS
 * are not effects firing. The four legacy 2D characters that once bounced
 * when tapped were deleted in gap-fix round 8 (Bible 02 rule 21: Mentor
 * characters are 3D renders only), and nothing new may join this list.
 */
const DEFINITIONS: Record<string, string> = {
  'rebuild/design/system.css': 'the --ease-spring and --dur-celebration tokens (definitions only)',
  'rebuild/design/tokens.css': 'the generated Bible 02 token sheet: the --ease-spring and --dur-celebration tokens (definitions only)',
};

const MOUNTS: Record<string, string[]> = {
  // The component itself also refuses to show anything outside a closed-list Celebration (MotionAsset.test.tsx).
  // GAP-FIX-R4 (OD-28): the v1 player's results screen mounts the same lesson-complete confetti, gated by Core's milestone.
  MotionAsset: ['rebuild/learning/LessonResultView.tsx'],
  StreakCelebration: [],
  // The legacy Mentor streak pill left with the legacy Tutor UI (S10L.1): nothing may mount it again.
  GamificationCelebration: [],
};

const files = walk(src).map((file) => ({ file: rel(file), text: readFileSync(file, 'utf8') }));

describe('B.20 celebration budget: static scan of every celebration effect', () => {
  it('finds the effects it is meant to find (the scan is live, not vacuous)', () => {
    const hits = files.filter(({ text }) => EFFECTS.some(({ pattern }) => pattern.test(code(text))));
    expect(hits.map((h) => h.file)).toEqual(expect.arrayContaining(['rebuild/learning/LessonResultView.tsx', 'rebuild/design/motion.css']));
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

  it('the live results screen celebrates only Core\'s lesson-complete, never the client\'s own pass (S05.3g)', () => {
    const result = code(files.find(({ file }) => file === 'rebuild/learning/LessonResultView.tsx')!.text);
    expect(result).toMatch(/mayCelebrate\(receipt\.celebrations, 'lesson-complete'\)/);
    expect(result).toMatch(/celebrateLesson \? <Celebration milestone="lesson-complete"/);
    expect(result).not.toMatch(/passed\s*\?\s*<Celebration/);
  });

  it('the lesson burst is gone (the legacy Mentor pill left with the legacy Tutor UI, S10L.1)', () => {
    expect(files.some(({ file }) => file.startsWith('lesson-engine/'))).toBe(false);
    const route = files.find(({ file }) => file === 'routes/app/learn/LessonRoute.tsx')!.text;
    expect(code(route)).not.toMatch(/lf-burst|<CountUp/);
  });

  it('rebuilt surfaces never use the spring or celebration tokens outside the shared milestone celebration', () => {
    // S03.7: the one user is the motion sheet, under a playing Celebration (controlsCss.test.ts pins the selector).
    const rebuilt = files.filter(({ file }) => file.startsWith('rebuild/') && !['rebuild/design/system.css', 'rebuild/design/tokens.css'].includes(file));
    const users = rebuilt.filter(({ text }) => /var\(--ease-spring\)|var\(--dur-celebration\)/.test(code(text))).map(({ file }) => file);
    expect(users).toEqual(['rebuild/design/motion.css']);
  });

  it('registers the orchestrated patterns and the press ring as non-celebration motion (04 §4; 02 §9.1)', () => {
    // Not effects: they move the scene's own elements on route entry, an exercise change, an approval or a press.
    expect([...ORCHESTRATED_MOTION]).toEqual(['lf-route-enter', 'lf-sequence-in', 'lf-sequence-out', 'lf-success-wipe', 'lf-wave-rise', 'lf-stagger-rise', 'lf-press-ring']);
    for (const name of ORCHESTRATED_MOTION) expect(EFFECTS.some(({ pattern }) => pattern.test(name)), name).toBe(false);
    const sheet = code(files.find(({ file }) => file === 'rebuild/design/motion.css')!.text);
    for (const line of sheet.split(/\r?\n/).filter((entry) => ORCHESTRATED_MOTION.some((name) => entry.includes(`animation: ${name} `)))) {
      expect(line).not.toMatch(/--ease-spring|--dur-celebration/);
    }
  });

  it('the definitions list is closed', () => {
    expect(Object.keys(DEFINITIONS).sort()).toEqual([
      'rebuild/design/system.css', 'rebuild/design/tokens.css',
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
