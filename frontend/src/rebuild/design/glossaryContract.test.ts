import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Mechanical rules over every rebuilt string and source file (S03.8 lane
 * review). The per-surface copy-budget tests check each surface's own keys;
 * these check ALL of `i18n/<locale>/rebuild.json` and `emails.json`, so a new
 * key cannot slip past a rule because no surface test lists it.
 *
 *   - 02 rule 16: no em dash anywhere in UI copy.
 *   - 02 rule 18, D9, OD-1: no lives or hearts, in any language, in copy or in
 *     a rebuilt component (a counter "of any kind, not even one showing ∞").
 *   - Owner glossary §5 (OD-6, OD-11): the AI is never a bot, chatbot or
 *     assistant; a rest day is never a streak freeze.
 */

const root = process.cwd();
const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

type Tree = { [key: string]: string | Tree };
function strings(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : strings(value, `${prefix}${key}.`));
}
/** Every rebuilt namespace: the app surfaces (rebuild.json) and the account emails (emails.json). */
const NAMESPACES = ['rebuild', 'emails'] as const;
const copy = Object.fromEntries(LOCALES.map((locale) => [locale, NAMESPACES.flatMap((namespace) =>
  strings(JSON.parse(readFileSync(join(root, 'src/i18n', locale, `${namespace}.json`), 'utf8')) as Tree, `${namespace}:`))]));

/** Whole words in any script: JavaScript's \b is ASCII-only and would split "Botões" after "Bot". */
const words = (...terms: string[]) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
const FORBIDDEN: Record<(typeof LOCALES)[number], { rule: string; pattern: RegExp }[]> = {
  'en-US': [
    { rule: 'no lives or hearts (OD-1)', pattern: words('lives', 'hearts?', 'extra life', 'lives left') },
    { rule: 'the AI is the Mentor (OD-6)', pattern: words('bot', 'chatbot', 'assistant', 'AI tutor') },
    { rule: 'rest day, never streak freeze', pattern: words('streak freeze', 'freeze') },
  ],
  'es-MX': [
    { rule: 'no lives or hearts (OD-1)', pattern: words('vidas', 'corazón', 'corazones') },
    { rule: 'the AI is the Mentor (OD-6)', pattern: words('bot', 'chatbot', 'asistente', 'tutor IA', 'tutor de IA') },
    { rule: 'rest day, never streak freeze', pattern: words('congelar', 'congelador', 'congelación') },
  ],
  'pt-BR': [
    { rule: 'no lives or hearts (OD-1)', pattern: words('vidas', 'coração', 'corações') },
    { rule: 'the AI is the Mentor (OD-6)', pattern: words('bot', 'chatbot', 'assistente', 'tutor IA', 'tutor de IA') },
    { rule: 'rest day, never streak freeze', pattern: words('congelar', 'congelamento') },
  ],
};

function sources(dir: string): { file: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.(tsx?|css)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [{ file: relative(root, path).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }];
  });
}
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('rebuilt copy: mechanical rules over every string of rebuild.json and emails.json', () => {
  it('has the same keys in all three locales', () => {
    const keys = (locale: (typeof LOCALES)[number]) => copy[locale]!.map(([key]) => key).sort();
    expect(keys('es-MX')).toEqual(keys('en-US'));
    expect(keys('pt-BR')).toEqual(keys('en-US'));
  });

  it('never uses an em dash (02 rule 16)', () => {
    const found = LOCALES.flatMap((locale) => copy[locale]!.filter(([, value]) => value.includes('—')).map(([key]) => `${locale} ${key}`));
    expect(found).toEqual([]);
  });

  for (const locale of LOCALES) {
    it(`${locale}: no lives or hearts, no bot for the Mentor, no streak freeze`, () => {
      const found = copy[locale]!.flatMap(([key, value]) => FORBIDDEN[locale]
        .filter(({ pattern }) => pattern.test(value)).map(({ rule }) => `${key} "${value}" (${rule})`));
      expect(found).toEqual([]);
    });
  }

  it('the word matcher is Unicode-aware (a Portuguese "Botões" is not a bot) and still catches the real terms', () => {
    expect(FORBIDDEN['pt-BR'][1]!.pattern.test('Botões')).toBe(false);
    expect(FORBIDDEN['pt-BR'][1]!.pattern.test('Fale com o bot')).toBe(true);
    expect(FORBIDDEN['en-US'][0]!.pattern.test('3 lives left')).toBe(true);
    expect(FORBIDDEN['es-MX'][0]!.pattern.test('Te quedan 2 vidas')).toBe(true);
    expect(FORBIDDEN['en-US'][2]!.pattern.test('Use a streak freeze')).toBe(true);
  });
});

describe('rebuilt source: no em dash written into a component (02 rule 16)', () => {
  it('no em dash outside comments, including placeholders and accessible names', () => {
    // Found by the S03.5 audit on the real lesson route: the function machine wrote "—" for an output not yet run.
    // copyBudget.ts is the checker itself.
    const found = sources(join(root, 'src/rebuild')).filter(({ file }) => /\.tsx?$/.test(file) && !file.endsWith('design/copyBudget.ts'))
      .filter(({ text }) => withoutComments(text).includes('—')).map(({ file }) => file);
    expect(found).toEqual([]);
  });
});

describe('rebuilt source: no lives mechanic can be built (D9, 02 rule 18, OD-1)', () => {
  it('no component, prop, state or class names a life or heart counter', () => {
    const pattern = /(?<![A-Za-z])(?:lives|livesLeft|livesRemaining|hearts|heartsLeft|heartCount|lifeCount|lf-lives?|lf-hearts?)(?![A-Za-z])/i;
    // B.26 (S05.3f): the register policy mirrored from Core names the lives language it DETECTS, as `word('...')`
    // lexicon entries. Those detector patterns are not a counter; everything else in that file is still scanned.
    const DETECTOR_LEXICON = 'learnerRegisterPolicy.generated.ts';
    const scanned = (file: string, text: string) => {
      const code = withoutComments(text);
      return file.endsWith(DETECTOR_LEXICON) ? code.replace(/\bword\('(?:[^'\\]|\\.)*'\)/g, "word('')") : code;
    };
    const found = sources(join(root, 'src/rebuild'))
      .filter(({ file, text }) => pattern.test(scanned(file, text)))
      .map(({ file, text }) => `${file}: ${scanned(file, text).match(pattern)![0]}`);
    expect(found).toEqual([]);
  });
});
