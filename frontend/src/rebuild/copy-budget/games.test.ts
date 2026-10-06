import { describe, expect, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { CIRCUITS, LENSES, MENTORS, MODES, REPLIES, SPEEDS } from '../games/vocabulary';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/*
 * `rebuild-games.json` (the game host: the KartRush Garage, pit stop and break
 * cards). Youngest (6-9) budget, because the game serves a 6-year-old first.
 *
 * Each group maps its keys to the role the screen renders them in
 * (rebuild/games/*.tsx). A nested key takes the role of its first segment, or,
 * when the group says so, of its last (`closed.limit.heading` is a heading).
 * The test is exhaustive both ways: every string has a role here and every role
 * names a string. Beyond the budget it pins what a game card must never say:
 * no verdict (right, wrong, a mistake), no reward or rank, no clock, and the
 * glossary (the AI is the Mentor).
 */

type Roles = Record<string, CopyRole>;

const play: Roles = {
  pageTitle: 'heading', exit: 'action', loading: 'body', gateHint: 'body', racingHint: 'body', frameTitle: 'data', startLabel: 'action',
  sound: 'body', soundOn: 'option', soundOff: 'option',
};
const garage: Roles = {
  heading: 'heading', greeting: 'mentor', circuitLegend: 'body', modeLegend: 'body', driverLegend: 'body', speedLegend: 'body',
  // Circuit names are proper nouns (rendered as `data`, like a course title); they are budgeted as an option anyway.
  circuits: 'option', modes: 'option', speeds: 'option', go: 'action',
};
const paused: Roles = { heading: 'heading', body: 'body', resume: 'action', restart: 'action', leave: 'action' };
const pitstop: Roles = {
  heading: 'heading', observation: 'mentor', question: 'prompt', replies: 'option', replied: 'body', pending: 'body',
  again: 'action', change: 'action', ask: 'action', close: 'action',
};
const soft: Roles = { heading: 'heading', line: 'mentor', stop: 'action', keep: 'action' };
const closedByLast: Roles = { heading: 'heading', body: 'body' };
const closed: Roles = { home: 'action' };
const errors: Roles = { retry: 'action', home: 'action' };
const rotate: Roles = { heading: 'heading', body: 'body' };
const home: Roles = { heading: 'heading', play: 'action' };

const GROUPS: Record<string, { roles: Roles; byLast?: Roles }> = {
  gamePlay: { roles: play }, gameGarage: { roles: garage }, gamePaused: { roles: paused }, gamePitstop: { roles: pitstop }, gameSoft: { roles: soft },
  gameClosed: { roles: closed, byLast: closedByLast }, gameError: { roles: errors, byLast: closedByLast }, gameRotate: { roles: rotate }, gameHome: { roles: home },
};

/** The longest Mentor name a placeholder takes ("Dr. Rho" counts as two words). */
const filled = (text: string) => text.replace('{name}', 'Dr. Rho');

function roleOf(group: string, path: string): CopyRole | null {
  const { roles, byLast } = GROUPS[group]!;
  return roles[path.split('.')[0]!] ?? byLast?.[path.split('.').at(-1)!] ?? null;
}

/*
 * What these cards never say. A race has no right answer, so no observation, question or reply may grade the learner
 * (the lens is a profile, never a grade); DP-01 and B.20/B.22 keep every clock, rank and reward off a play surface;
 * the glossary keeps the AI a Mentor and the word "Tutor" for the verified parent.
 */
const GLOSSARY = /\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|freeze|congel|—/i;
const REWARDS_AND_CLOCKS = /\bxp\b|\bcoins?\b|monedas|moedas|streak|racha|sequ[eê]ncia|podium|podio|p[oó]dio|\branks?\b|ranking|winner|ganador|vencedor|leaderboard|confetti|countdown|cuenta regresiva|contagem regressiva|\btimer\b|temporizador|cron[oô]metro|\bminutes?\b|\bminutos?\b|\bseconds?\b|\bsegundos?\b/i;
const VERDICTS = /\b(right|wrong|correct|incorrect|mistakes?|failed?|bad|worse|worst|better|best|perfect|should|must|lost|lose|winner)\b|\b(correct[oa]s?|incorrect[oa]s?|errores?|error|fallaste|peor|mejor|perfect[oa]|debes|deber[ií]as|perdiste)\b|\b(correto|incorreto|erros?|errou|falhou|ruim|pior|melhor|perfeito|deve|deveria|perdeu)\b/i;
const JUDGED = new Set(['observation', 'question', 'replies', 'line']);

describe('rebuild-games copy budget', () => {
  for (const [locale, strings] of namespaceCopy('games')) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expectBudgetedGroups(strings, Object.keys(GROUPS));
      for (const group of Object.keys(GROUPS)) {
        const entries = flatten(strings[group]!);
        const used = new Set<string>();
        for (const [path, text] of entries) {
          const role = roleOf(group, path);
          expect(role, `${group}.${path} has no role in this test`).not.toBeNull();
          used.add(path.split('.')[0]!);
          if (role !== 'data') expectFits(filled(text), role!, locale, '6-9', `${group}.${path}`);
          expect(text, `${group}.${path}`).not.toMatch(GLOSSARY);
          expect(text, `${group}.${path}`).not.toMatch(REWARDS_AND_CLOCKS);
          // 06 §5 rule 7: at most one exclamation mark per screen for learners, so only a Mentor's own line takes one.
          const marks = (text.match(/!/g) ?? []).length;
          expect(marks, `${group}.${path}`).toBeLessThanOrEqual(role === 'mentor' ? 1 : 0);
          if (JUDGED.has(path.split('.')[0]!) || /observation|question|replies|line/.test(path)) expect(text, `${group}.${path}`).not.toMatch(VERDICTS);
        }
        // Exhaustive: every role names a string of the group.
        const roots = new Set(entries.map(([path]) => path.split('.')[0]!));
        const named = Object.keys(GROUPS[group]!.roles);
        for (const key of named) expect(roots.has(key), `${group}.${key} is budgeted here but not in the copy`).toBe(true);
        if (!GROUPS[group]!.byLast) expect(roots).toEqual(new Set(named));
      }
    });

    it(`keeps the pit-stop copy complete and each Mentor's line their own in ${locale}`, () => {
      const pit = strings.gamePitstop as unknown as {
        observation: Record<string, Record<string, string>>; question: Record<string, string>; replies: Record<string, Record<string, string>>;
      };
      expect(Object.keys(pit.observation).sort()).toEqual([...LENSES].sort());
      expect(Object.keys(pit.question).sort()).toEqual([...LENSES].sort());
      expect(Object.keys(pit.replies).sort()).toEqual([...LENSES].sort());
      for (const lens of LENSES) {
        expect(Object.keys(pit.observation[lens]!).sort(), `${lens} Mentors`).toEqual([...MENTORS].sort());
        // Four voices, four lines: a copy of one Mentor's line under another's name is not a voice.
        expect(new Set(Object.values(pit.observation[lens]!)).size, `${lens} lines are distinct`).toBe(4);
        expect(Object.keys(pit.replies[lens]!).sort(), `${lens} replies`).toEqual([...REPLIES].sort());
        // An observation says what the learner did; the one question is the question card's job.
        for (const mentor of MENTORS) expect(pit.observation[lens]![mentor], `${lens}.${mentor}`).not.toMatch(/[?¿]/);
        expect(pit.question[lens], lens).toMatch(/[?¿]/);
        // The three replies are three different things to say, and "not sure" is the same word in every lens.
        expect(new Set(Object.values(pit.replies[lens]!)).size, `${lens} replies are distinct`).toBe(3);
      }
      expect(new Set(LENSES.map((lens) => pit.replies[lens]!.unsure)).size).toBe(1);
      const garageCopy = strings.gameGarage as unknown as { greeting: Record<string, string>; circuits: Record<string, string>; modes: Record<string, string>; speeds: Record<string, string> };
      const softCopy = strings.gameSoft as unknown as { line: Record<string, string> };
      expect(Object.keys(garageCopy.greeting).sort()).toEqual([...MENTORS].sort());
      expect(Object.keys(softCopy.line).sort()).toEqual([...MENTORS].sort());
      expect(new Set(Object.values(garageCopy.greeting)).size).toBe(4);
      expect(new Set(Object.values(softCopy.line)).size).toBe(4);
      expect(Object.keys(garageCopy.circuits).sort()).toEqual([...CIRCUITS].sort());
      expect(Object.keys(garageCopy.modes).sort()).toEqual([...MODES].sort());
      expect(Object.keys(garageCopy.speeds).sort()).toEqual([...SPEEDS].sort());
    });

    it(`fits the game's Start label in ${locale} (the contract allows 1 to 24 characters)`, () => {
      const label = (strings.gamePlay as unknown as { startLabel: string }).startLabel;
      expect(Array.from(label).length).toBeGreaterThanOrEqual(1);
      expect(Array.from(label).length).toBeLessThanOrEqual(24);
    });
  }

  it('names the same circuits, modes and speeds in every language', () => {
    const circuits = namespaceCopy('games').map(([, strings]) => Object.keys((strings.gameGarage as unknown as { circuits: object }).circuits));
    expect(circuits).toHaveLength(3);
    for (const names of circuits) expect(names).toEqual([...CIRCUITS]);
  });
});
