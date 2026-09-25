import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTone, findings, flatten, liveInputs } from './check-family-copy-tone.mjs';

/*
 * D.8's gate must catch each category in each locale, keep its exceptions
 * honest (a stale exception fails), and refuse a surface that would show a
 * family a raw Core message instead of in-scope copy.
 */

const live = liveInputs();

test('the live repository passes', () => {
  const result = checkTone(live);
  assert.deepEqual(result.failures, []);
  assert.ok(result.checked > 1000, `only ${result.checked} strings in scope`);
});

test('flattens nested copy', () => {
  assert.deepEqual(flatten({ a: { b: 'x', c: ['y'] } }), [['a.b', 'x'], ['a.c.0', 'y']]);
});

const cases = [
  ['en-US', 'Insufficient funds for this reward.', 'bank_register'],
  ['en-US', 'Your request was declined.', 'bank_register'],
  ['en-US', 'Your coins are safe here.', 'guarantee'],
  ['en-US', 'This card is protected.', 'guarantee'],
  ['en-US', 'You earned money today.', 'glossary'],
  ['en-US', 'Your guardian froze it.', 'glossary'],
  ['en-US', 'Nice!! Great job.', 'shouting'],
  ['en-US', 'Error ACCOUNT_FROZEN.', 'shouting'],
  ['es-MX', 'Fondos insuficientes.', 'bank_register'],
  ['es-MX', 'Solicitud rechazada.', 'bank_register'],
  ['es-MX', 'Tus monedas están seguras.', 'guarantee'],
  ['es-MX', 'Ganaste dinero.', 'glossary'],
  ['pt-BR', 'Transação recusada.', 'bank_register'],
  ['pt-BR', 'Suas moedas estão protegidas.', 'guarantee'],
  ['pt-BR', 'Você ganhou dinheiro.', 'glossary'],
];

for (const [locale, text, category] of cases) {
  test(`flags ${category} in ${locale}: ${text}`, () => {
    assert.ok(findings(text, locale, live.lexicon).some((f) => f.category === category), JSON.stringify(findings(text, locale, live.lexicon)));
  });
}

test('passes plain mentor copy in each locale', () => {
  assert.deepEqual(findings('Your coins wait here until it is unfrozen.', 'en-US', live.lexicon), []);
  assert.deepEqual(findings('Tus monedas esperan aquí.', 'es-MX', live.lexicon), []);
  assert.deepEqual(findings('Suas moedas esperam aqui.', 'pt-BR', live.lexicon), []);
});

test('ignores placeholders when matching words', () => {
  assert.deepEqual(findings('{funds} coins', 'en-US', live.lexicon), []);
});

test('a string that slips into a namespace fails the gate', () => {
  const readLocale = (locale, ns) => {
    const file = live.readLocale(locale, ns);
    return locale === 'en-US' && ns === 'coinAccount' ? { ...file, young: { ...file.young, nothingLost: 'Your coins are guaranteed.' } } : file;
  };
  const { failures } = checkTone({ ...live, readLocale });
  assert.deepEqual(failures, ['coinAccount:young.nothingLost [en-US] guarantee: "guaranteed" in "Your coins are guaranteed."']);
});

test('a stale exception fails, so it cannot excuse the next string', () => {
  const lexicon = { ...live.lexicon, exceptions: [...live.lexicon.exceptions, { key: 'coinAccount:young.freeze', category: 'guarantee', why: 'A made-up exception for the test.' }] };
  const { failures } = checkTone({ ...live, lexicon });
  assert.deepEqual(failures, ['exception coinAccount:young.freeze (guarantee) excuses nothing any more; remove it']);
});

test('a surface rendering a raw Core message fails', () => {
  const surfaceSources = [...live.surfaceSources, ['frontend/src/routes/app/banking/Fake.tsx', 'setNotice(res.error.message);']];
  const { failures } = checkTone({ ...live, surfaceSources });
  assert.deepEqual(failures, ['frontend/src/routes/app/banking/Fake.tsx: renders a raw Core error message; map the code to copy instead']);
});
