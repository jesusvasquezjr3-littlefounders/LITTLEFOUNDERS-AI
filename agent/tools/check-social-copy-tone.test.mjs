import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTone, findings } from './check-family-copy-tone.mjs';
import { SOCIAL_LEXICON, socialInputs } from './check-social-copy-tone.mjs';

/*
 * GAP-FIX-R4 (Appendix J Part 3 Stage 4, F.3): the social-layer tone gate
 * must catch each category in each locale, read every profile group (a new
 * one fails until it is listed), refuse a social surface that renders copy
 * outside its scope or a raw Core message, and keep its exceptions honest.
 */

const live = socialInputs();

test('the live repository passes', () => {
  const result = checkTone(live);
  assert.deepEqual(result.failures, []);
  assert.ok(result.checked > 1500, `only ${result.checked} strings in scope`);
});

test('every rebuild-profile group, the goals-together copy and the Family connection groups are in scope', () => {
  const profile = Object.keys(live.readLocale('en-US', 'rebuild-profile'));
  for (const group of ['report', 'peopleList', 'publicProfile', 'privateProfile', 'teenConnections', 'profileSafety', 'discoverable', 'accountDeletion', 'ageRecord']) {
    assert.ok(profile.includes(group), group);
  }
  for (const group of profile) assert.ok(live.lexicon.scope.subtrees.includes(`rebuild-profile:${group}`), group);
  for (const subtree of ['rebuild-learn:together', 'rebuild-family:socialGraph', 'rebuild-family:socialHistory', 'rebuild-family:socialRequests',
    'rebuild-family:socialNotices', 'rebuild-family:socialConnectionActions', 'rebuild-family:familyCoopGoals']) {
    assert.ok(live.lexicon.scope.subtrees.includes(subtree), subtree);
  }
  for (const surface of ['frontend/src/rebuild/social', 'frontend/src/rebuild/account', 'frontend/src/routes/app/profile', 'frontend/src/app-routes/TogetherRoute.tsx']) {
    assert.ok(live.lexicon.scope.surfaces.includes(surface), surface);
  }
});

const cases = [
  ['en-US', 'Your profile is always protected.', 'guarantee'],
  ['en-US', 'Reporting keeps you safe.', 'guarantee'],
  ['en-US', 'Send them a message.', 'messaging'],
  ['en-US', 'Open your inbox.', 'messaging'],
  ['en-US', 'Ask your guardian first.', 'glossary'],
  ['en-US', 'The AI tutor will help.', 'glossary'],
  ['en-US', 'Your balance is low.', 'bank_register'],
  ['en-US', 'This violates our terms of service.', 'legal_register'],
  ['en-US', 'Reported!! Thanks.', 'shouting'],
  ['en-US', 'Error REPORT_FAILED.', 'shouting'],
  ['es-MX', 'Tu perfil está protegido.', 'guarantee'],
  ['es-MX', 'Envíale un mensaje.', 'messaging'],
  ['es-MX', 'Pregunta a tu tutor legal.', 'glossary'],
  ['es-MX', 'El asistente te ayuda.', 'glossary'],
  ['es-MX', 'Esto es una infracción.', 'legal_register'],
  ['es-MX', 'Tu saldo cambió.', 'bank_register'],
  ['pt-BR', 'Seu perfil está protegido.', 'guarantee'],
  ['pt-BR', 'Mande uma mensagem.', 'messaging'],
  ['pt-BR', 'Pergunte ao seu responsável legal.', 'glossary'],
  ['pt-BR', 'Isso é uma violação.', 'legal_register'],
  ['pt-BR', 'Seu saldo mudou.', 'bank_register'],
];

for (const [locale, text, category] of cases) {
  test(`flags ${category} in ${locale}: ${text}`, () => {
    assert.ok(findings(text, locale, live.lexicon).some((f) => f.category === category), JSON.stringify(findings(text, locale, live.lexicon)));
  });
}

test('passes plain social copy in each locale', () => {
  assert.deepEqual(findings('Only people you approve can follow you.', 'en-US', live.lexicon), []);
  assert.deepEqual(findings('Solo las personas que apruebas pueden seguirte.', 'es-MX', live.lexicon), []);
  assert.deepEqual(findings('Só quem você aprova pode te seguir.', 'pt-BR', live.lexicon), []);
});

test('a string that slips into a profile group fails the gate', () => {
  const readLocale = (locale, ns) => {
    const file = live.readLocale(locale, ns);
    return locale === 'en-US' && ns === 'rebuild-profile' ? { ...file, peopleList: { ...file.peopleList, empty: 'Message a friend to start.' } } : file;
  };
  const { failures } = checkTone({ ...live, readLocale });
  assert.deepEqual(failures, ['rebuild-profile:peopleList.empty [en-US] messaging: "Message" in "Message a friend to start."']);
});

test('a string that slips into the goals-together copy fails the gate', () => {
  const readLocale = (locale, ns) => {
    const file = live.readLocale(locale, ns);
    return locale === 'pt-BR' && ns === 'rebuild-learn' ? { ...file, together: { ...file.together, intro: 'Sua meta está garantida.' } } : file;
  };
  const { failures } = checkTone({ ...live, readLocale });
  assert.deepEqual(failures, ['rebuild-learn:together.intro [pt-BR] guarantee: "garantida" in "Sua meta está garantida."']);
});

test('a new rebuild-profile group fails until it is in scope, even before a surface names it', () => {
  const readLocale = (locale, ns) => (ns === 'rebuild-profile' ? { ...live.readLocale(locale, ns), profileBadges: { title: 'Badges' } } : live.readLocale(locale, ns));
  const { failures } = checkTone({ ...live, readLocale });
  assert.deepEqual(failures, [`rebuild-profile:profileBadges is a copy group outside the tone gate's scope; add it to scope in ${SOCIAL_LEXICON}`]);
});

test('a social surface that renders a Family group outside the scope fails', () => {
  const surfaceSources = [...live.surfaceSources, ['frontend/src/rebuild/social/Fake.tsx', 'const copy = family.familyTasks;']];
  const { failures } = checkTone({ ...live, surfaceSources });
  assert.deepEqual(failures, [`frontend/src/rebuild/social/Fake.tsx: renders rebuild-family:familyTasks, which is outside the tone gate's scope; add it to scope in ${SOCIAL_LEXICON}`]);
});

test('the goals-together surface that reads another learn group fails', () => {
  const surfaceSources = [...live.surfaceSources, ['frontend/src/rebuild/learning/TogetherView.tsx', 'const t = learnCopy[locale].placement;']];
  const { failures } = checkTone({ ...live, surfaceSources });
  assert.deepEqual(failures, [`frontend/src/rebuild/learning/TogetherView.tsx: renders rebuild-learn:placement, which is outside the tone gate's scope; add it to scope in ${SOCIAL_LEXICON}`]);
});

test('a social surface rendering a raw Core message fails; comparing one does not', () => {
  const surfaceSources = [...live.surfaceSources, ['frontend/src/rebuild/social/Fake.tsx', 'setNotice(result.error.message);'],
    ['frontend/src/rebuild/social/Probe.tsx', "return error?.message === 'Network error';"]];
  const { failures } = checkTone({ ...live, surfaceSources });
  assert.deepEqual(failures, ['frontend/src/rebuild/social/Fake.tsx: renders a raw Core error message; map the code to copy instead']);
});

test('a stale exception fails, so it cannot excuse the next string', () => {
  const lexicon = { ...live.lexicon, exceptions: [...live.lexicon.exceptions, { key: 'rebuild-profile:report.title', category: 'messaging', why: 'A made-up exception for the test.' }] };
  const { failures } = checkTone({ ...live, lexicon });
  assert.deepEqual(failures, ['exception rebuild-profile:report.title (messaging) excuses nothing any more; remove it']);
});

test('removing a reviewed exception brings its finding back', () => {
  const lexicon = { ...live.lexicon, exceptions: live.lexicon.exceptions.filter((e) => e.key !== 'rebuild-learn:together.intro') };
  const { failures } = checkTone({ ...live, lexicon });
  assert.ok(failures.some((f) => f.startsWith('rebuild-learn:together.intro [en-US] messaging')), failures.join('\n'));
});

test('B.14 UI lexicon runs as the b14_ui category', () => {
  assert.ok(findings('Act now, last chance.', 'en-US', live.lexicon).some((f) => f.category === 'b14_ui'));
});
