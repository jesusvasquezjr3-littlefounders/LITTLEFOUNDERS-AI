import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchCoinAccount, fetchTutorFreeze } from '../banking/bankingApi';
import { fetchDecisionQueue, fetchKidAutonomy, fetchMyAutonomy } from './familyAutonomyApi';
import { fetchCoGuardians, fetchGuardianActions, fetchKidGoals, fetchKidRedemptions, fetchOwnCatalog, type Session } from './familyHubApi';
import { fetchKidBonus, fetchKidStreak } from './familyMoneyApi';
import { fetchDataPolicy, fetchKidResearch } from './governanceApi';
import { fetchKidShare, fetchKidUsualSplit } from './moneyHabitsApi';

/*
 * GAP-FIX-R5 (Bible 02 §7 item 10, 03 §5, 06 §7; Appendix H Part 3 Stage 4): the three UI audits measure each Block D panel only
 * if the audit's synthetic Core answers the panel's reads in a shape the page accepts. A shape the page's validator refuses shows
 * the panel's error state, and the audit then measures an error notice instead of the panel, with every gate green. This pins
 * every read the family lane's press-opened and frozen states depend on against the real validators the pages use.
 */
const frontend = resolve(__dirname, '../../..');
const KID_A = '22222222-2222-4222-8222-222222222222';
const KID_B = '33333333-3333-4333-8333-333333333333';

const READS: Array<[scenario: string, path: string]> = [
  ['family-two', `/family/kids/${KID_A}/guardians`],
  ['family-two', `/tasks/${KID_A}/wallet/guardian-actions`],
  ['family-two', `/tasks/${KID_A}/goals`],
  ['family-two', '/tasks/redemptions'],
  ['family-two', '/tasks/catalog'],
  ['family-two', `/tasks/${KID_A}/streak`],
  ['family-two', `/tasks/${KID_A}/share`],
  ['family-two', `/tasks/${KID_A}/wallet/split`],
  ['family-two', `/tasks/${KID_A}/autonomy`],
  ['family-two', `/family-hub/kids/${KID_A}/research`],
  ['family-two', '/family-hub/data-policy'],
  ['money-tutor', '/tasks/decisions/queue'],
  ['money-tutor', `/banking/savings-bonus/${KID_A}`],
  ['money-tutor', `/banking/savings-bonus/${KID_B}`],
  ['money-tutor', `/banking/accounts/${KID_A}/freeze`],
  ['money-tutor-frozen', `/banking/accounts/${KID_A}/freeze`],
  ['money-child-frozen', '/banking/overview'],
  ['money-child-level2', '/tasks/autonomy'],
];
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

type Answer = { status: number; body: { data: unknown; error: unknown } } | null;
function answers(): Record<string, Answer> {
  // The lane file loads in Node itself, as the audit driver loads it (it resolves fixtures by file URL).
  const script = `const m = await import('./scripts/audits/lanes/family.mjs');
    const reads = ${JSON.stringify(READS)}; const out = {};
    for (const locale of ${JSON.stringify(LOCALES)}) for (const [scenario, path] of reads) {
      const answer = m.respond({ core: {}, spec: m.scenarios[scenario], locale, path, request: { method: 'GET' },
        ok: (data) => ({ status: 200, body: { data, error: null } }) });
      out[locale + '|' + scenario + '|' + path] = answer ?? null;
    }
    console.log(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: frontend, encoding: 'utf8' })) as Record<string, Answer>;
}

const recorded = answers();
const session = (locale: string, scenario: string): Session => ({
  token: 'synthetic',
  transport: async (path) => {
    const answer = recorded[`${locale}|${scenario}|${path.split('?')[0]}`];
    if (!answer) throw new Error(`the family lane's synthetic Core does not answer ${path} in ${scenario}`);
    return answer.body as never;
  },
});

describe.each(LOCALES)('the family audit lane\'s synthetic Core (%s)', (locale) => {
  const s = (scenario: string) => session(locale, scenario);

  it('answers every per-child Tutor panel on /family in the shape the panel accepts', async () => {
    const guardians = await fetchCoGuardians(KID_A, s('family-two'));
    expect(guardians.ok).toBe(true);
    // OD-21: the co-Tutors panel meets a pending second Tutor, not only verified ones.
    if (guardians.ok) expect(guardians.data.guardians.map((g) => g.status)).toEqual(expect.arrayContaining(['verified', 'pending']));
    for (const outcome of await Promise.all([
      fetchGuardianActions(KID_A, s('family-two')), fetchKidGoals(KID_A, s('family-two')), fetchKidRedemptions(KID_A, s('family-two')),
      fetchOwnCatalog(s('family-two')), fetchKidStreak(KID_A, s('family-two')), fetchKidShare(KID_A, s('family-two')),
      fetchKidUsualSplit(KID_A, s('family-two')), fetchKidAutonomy(KID_A, s('family-two')), fetchKidResearch(KID_A, s('family-two')),
      fetchDataPolicy(s('family-two')),
    ])) expect(outcome).toMatchObject({ ok: true });
  });

  it('answers the Tutor queue, both bonus framings and the freeze card on /tasks and /family-wallet', async () => {
    expect(await fetchDecisionQueue(s('money-tutor'))).toMatchObject({ ok: true });
    const young = await fetchKidBonus(KID_A, s('money-tutor'));
    const teen = await fetchKidBonus(KID_B, s('money-tutor'));
    expect(young).toMatchObject({ ok: true, data: { framing: 'per_ten' } });
    expect(teen).toMatchObject({ ok: true, data: { framing: 'percent' } });
    expect(await fetchTutorFreeze(KID_A, s('money-tutor'))).toMatchObject({ ok: true, data: { account: { freeze: { frozen: false } } } });
  });

  it('answers a frozen card for the Tutor (the child froze it) and for the child (a Tutor froze it, only a Tutor lifts it)', async () => {
    expect(await fetchTutorFreeze(KID_A, s('money-tutor-frozen')))
      .toMatchObject({ ok: true, data: { account: { freeze: { frozen: true, by: 'child', canChange: true } } } });
    expect(await fetchCoinAccount(s('money-child-frozen')))
      .toMatchObject({ ok: true, data: { account: { freeze: { frozen: true, by: 'tutor', canChange: false } } } });
  });

  it('answers a child at level 2, who may step down', async () => {
    expect(await fetchMyAutonomy(s('money-child-level2'))).toMatchObject({ ok: true, data: { autonomy: { level: 2 } } });
  });
});
