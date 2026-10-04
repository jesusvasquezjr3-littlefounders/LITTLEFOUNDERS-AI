import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPackCopy, packCopyDirs } from './check-horizonte-copy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const budget = await import(pathToFileURL(`${root}frontend/src/rebuild/design/copyBudget.ts`).href);

const good = { show: { role: 'action', 'en-US': 'Show as table', 'es-MX': 'Mostrar como tabla', 'pt-BR': 'Mostrar como tabela' } };

test('accepts a three-locale string inside its budget', () => {
  assert.deepEqual(checkPackCopy('golden', good, budget), []);
});

test('reports a missing locale, an unknown role, an over-budget string and an untranslated one', () => {
  const problems = checkPackCopy('golden', {
    missing: { role: 'action', 'en-US': 'Check', 'es-MX': 'Revisar' },
    role: { role: 'shout', 'en-US': 'Check', 'es-MX': 'Revisar', 'pt-BR': 'Verificar' },
    long: { role: 'option', 'en-US': 'One two three four five six', 'es-MX': 'Uno dos tres cuatro cinco seis', 'pt-BR': 'Um dois tres quatro cinco seis' },
    same: { role: 'body', 'en-US': 'Fill the frame', 'es-MX': 'Fill the frame', 'pt-BR': 'Preencha o quadro' },
    dash: { role: 'body', 'en-US': 'Fill — then check', 'es-MX': 'Llena y revisa', 'pt-BR': 'Preencha e confira' },
  }, budget);
  assert.ok(problems.includes('golden.missing: no pt-BR text'));
  assert.ok(problems.includes('golden.role: missing or unknown data-copy-role'));
  assert.ok(problems.some((problem) => problem.startsWith('golden.long (en-US): word-budget')));
  assert.ok(problems.includes('golden.same (es-MX): identical to en-US, not a native translation'));
  assert.ok(problems.some((problem) => problem.startsWith('golden.dash (en-US): em-dash')));
});

test('a longer budget applies when the entry declares an older band', () => {
  const entry = { role: 'option', 'en-US': 'One two three four five six', 'es-MX': 'Uno dos tres cuatro cinco seis', 'pt-BR': 'Um dois tres quatro cinco seis' };
  assert.deepEqual(checkPackCopy('x', { a: { ...entry, band: '10-12' } }, budget), []);
});

test('a fixed sentence cannot sit in an unbudgeted data string', () => {
  const sentence = { 'en-US': 'One turn lays a line a bit more than 3 diameters long.', 'es-MX': 'Una vuelta tiende una línea de poco más de 3 diámetros.', 'pt-BR': 'Uma volta estende uma linha de um pouco mais de 3 diâmetros.' };
  const problems = checkPackCopy('golden', {
    prose: { role: 'data', ...sentence },
    body: { role: 'body', ...sentence },
    readout: { role: 'data', 'en-US': '{count} of {total} bridges crossed: {list}.', 'es-MX': '{count} de {total} puentes cruzados: {list}.', 'pt-BR': '{count} de {total} pontes atravessadas: {list}.' },
    name: { role: 'data', 'en-US': 'Left pan', 'es-MX': 'Platillo izquierdo', 'pt-BR': 'Prato esquerdo' },
    label: { role: 'data', 'en-US': 'Total.', 'es-MX': 'Total.', 'pt-BR': 'Total.' },
  }, budget);
  assert.deepEqual(problems, ['golden.prose: prose in a data string; give it the body role']);
});

test('enumerates every pack copy module by directory scan', () => {
  const packs = packCopyDirs();
  assert.ok(packs.includes('golden') && packs.includes('space2') && packs.length >= 18);
});

console.log('check-horizonte-copy OK');
