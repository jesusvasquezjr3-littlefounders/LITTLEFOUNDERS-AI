import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from './copyBudget';

/*
 * The account emails are on the one design system (OD-4, 02 D8; S03.8).
 * `scripts/build-rebuild-emails.mjs` generates the five GoTrue templates from
 * the Bible tokens and `src/i18n/<locale>/emails.json`; this reads the real
 * artefacts in `public/email-templates/` and holds them to the rules a
 * rebuilt screen is held to: token colours only, the two brand typefaces, no
 * glow, gradient or raster art, a 14 px text floor, a 56 px call to action,
 * a declared copy role and the copy budget for every string in all three
 * locales, and AA contrast for every text colour on its background.
 */

const frontend = process.cwd();
const FILES = ['confirmation.html', 'email_change.html', 'invite.html', 'magic_link.html', 'recovery.html'];
const html = Object.fromEntries(FILES.map((file) => [file, readFileSync(join(frontend, 'public/email-templates', file), 'utf8')]));
const tokenSheet = readFileSync(join(frontend, 'src/rebuild/design/tokens.css'), 'utf8');
const light = Object.fromEntries([...tokenSheet.slice(0, tokenSheet.indexOf('}')).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)]
  .map(([, name, value]) => [name!, value!.toLowerCase()]));

/** `{{ if eq $l "es-MX" }}ES{{ else if eq $l "pt-BR" }}PT{{ else }}EN{{ end }}` → { en-US, es-MX, pt-BR }. */
const TRIPLE = /\{\{ if eq \$l "es-MX" \}\}(.*?)\{\{ else if eq \$l "pt-BR" \}\}(.*?)\{\{ else \}\}(.*?)\{\{ end \}\}/g;
const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;|&zwnj;/g, '');
/** The body without the Outlook-only VML button (it repeats the action text inside a <center>). */
const body = (source: string) => source.slice(source.indexOf('<body')).replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '');

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('account emails on the one design system (OD-4, 02 D8)', () => {
  it('are exactly what the generator makes from the Bible tokens and emails.json (no hand edits)', () => {
    expect(() => execFileSync(process.execPath, [join(frontend, 'scripts/build-rebuild-emails.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  for (const file of FILES) describe(file, () => {
    const source = html[file]!;

    it('uses only light-mode token colours, the two brand typefaces, and no glow, gradient, image or legacy face', () => {
      const tokenValues = new Set(Object.values(light));
      expect((source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((value) => value.toLowerCase()).filter((value) => !tokenValues.has(value))).toEqual([]);
      expect(source).not.toMatch(/rgba?\(|hsla?\(|box-shadow|gradient|<img|Figtree|background-image/i);
      const families = [...source.matchAll(/font-family:\s*([^;"]+)/g)].map(([, value]) => value!.split(',')[0]!.replace(/'/g, '').trim());
      expect([...new Set(families)].sort()).toEqual(['Arial', 'Fredoka', 'Nunito']); // Arial only inside Outlook's VML button
      expect(source).toMatch(/fonts\.googleapis\.com\/css2\?family=Fredoka[^"]*family=Nunito/);
    });

    it('keeps visible text at 14 px or more and the call to action at a 56 px target (02 rule 11, §8)', () => {
      const sizes = [...body(source).matchAll(/font-size:\s*(\d+)px/g)].map(([, value]) => Number(value));
      // The one 1 px run is the hidden preview text (display:none), which no one sees in the message.
      expect(sizes.filter((size) => size < 14)).toEqual([1]);
      expect(source).toMatch(/<div data-copy-role="body" style="display:none;[^"]*font-size:1px/);
      expect(source).toMatch(/class="lf-btn" data-copy-role="action"[^>]*line-height:56px/);
    });

    it('declares a copy role on every localized string and says the language', () => {
      const visible = body(source);
      const triples = [...visible.matchAll(TRIPLE)].length;
      const declared = [...visible.matchAll(/data-copy-role="[a-z]+"[^>]*>(?:<a [^>]*>)?\{\{ if eq \$l "es-MX" \}\}/g)].length;
      expect(triples).toBeGreaterThan(5);
      expect(declared).toBe(triples);
      expect(source).toMatch(/<html lang="\{\{ if eq \$l "es-MX" \}\}es-MX\{\{ else if eq \$l "pt-BR" \}\}pt-BR\{\{ else \}\}en-US\{\{ end \}\}"/);
      expect(source.startsWith('{{ $l := index .Data "locale" }}')).toBe(true);
      expect(source).toContain('href="{{ .ConfirmationURL }}"');
    });

    it('keeps every string within its copy budget in en-US, es-MX and pt-BR, with no em dash (06 §3, 02 rule 16)', () => {
      const found: string[] = [];
      const check = (role: CopyRole, triple: RegExpMatchArray) => {
        const [, es, pt, en] = triple;
        for (const [locale, text] of [['en-US', en], ['es-MX', es], ['pt-BR', pt]] as [Locale, string][]) {
          for (const issue of checkCopy(decode(text), role, { locale, ageBand: 'adult', surface: 'app' })) found.push(`${locale} ${role} "${decode(text)}": ${issue}`);
        }
      };
      for (const element of body(source).matchAll(/data-copy-role="([a-z]+)"[^>]*>(?:<a [^>]*>)?(\{\{ if eq[\s\S]*?\{\{ end \}\})/g)) {
        for (const triple of element[2]!.matchAll(TRIPLE)) check(element[1] as CopyRole, triple);
      }
      const title = source.match(/<title>(.*?) · LittleFounders<\/title>/)?.[1] ?? '';
      for (const triple of title.matchAll(TRIPLE)) check('heading', triple);
      expect(found).toEqual([]);
      expect(source).not.toContain('—');
    });
  });

  it('every text colour reaches AA on the background it sits on', () => {
    const pairs: [string, string, number][] = [
      ['content', 'surface', 4.5], ['content-muted', 'surface', 4.5], ['content-muted', 'base', 4.5], ['content', 'sunken', 4.5],
      ['primary-strong', 'surface', 4.5], ['primary-strong', 'base', 4.5], ['on-accent', 'accent', 4.5],
      ['primary', 'base', 3], // the 28 px bold wordmark is large text (WCAG 1.4.3)
    ];
    const failing = pairs.filter(([text, background, minimum]) => contrast(light[text]!, light[background]!) < minimum)
      .map(([text, background]) => `${text} on ${background}: ${contrast(light[text]!, light[background]!).toFixed(2)}`);
    expect(failing).toEqual([]);
  });
});
