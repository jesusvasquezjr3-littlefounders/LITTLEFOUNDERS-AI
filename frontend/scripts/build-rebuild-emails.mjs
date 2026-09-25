import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { generateTokens } from './build-rebuild-tokens.mjs';

/*
 * The account emails on the one design system (OD-4, Frontend Bible 02 D8:
 * "one set of tokens, components and shapes for every surface (marketing,
 * learner app, parent experience, staff console, emails, …)").
 *
 * GoTrue sends five account emails from `public/email-templates/*.html`
 * (confirmation, email change, invite, magic link, recovery). Before S03.8
 * they carried the legacy palette (#456dff, a navy stage, a coral glow
 * button), the Figtree typeface, a raster logo with gradient text and two
 * stock child figures (02 rules 2 and 21, 07 §3), 11–13 px text (rule 11) and
 * over-budget copy (06). They are now GENERATED here:
 *
 *   - colours, radii, spacing and type come from the tokens this repo
 *     generates from the Bible's own YAML (`build-rebuild-tokens.mjs`), light
 *     mode only, because an email client, not the product, decides whether and
 *     how to darken a message (proposal in the S03 sprint record);
 *   - every string comes from `src/i18n/<locale>/emails.json` (en-US, es-MX,
 *     pt-BR, key parity enforced by the i18n check) and is budgeted by
 *     `design/emailsContract.test.ts` with the app's copy budget (06 §3);
 *   - every text element declares its `data-copy-role` (02 rule 19);
 *   - the wordmark is text in the brand typeface, not an image.
 *
 * Email-client HTML is not the app: tables for layout, inline styles, a
 * viewport media query for phones (container queries do not exist in mail
 * clients) and an Outlook VML button. The Go template keeps GoTrue's contract:
 * `{{ .ConfirmationURL }}` and the learner's locale from `.Data "locale"`.
 *
 *   node scripts/build-rebuild-emails.mjs           write the five templates
 *   node scripts/build-rebuild-emails.mjs --check   fail when a template drifted (spec:check)
 */

const bible = new URL('../../docs/littlefounders-spec/frontend/frontend-bible/02-FOUNDATIONS.md', import.meta.url);
const i18n = (locale) => new URL(`../src/i18n/${locale}/emails.json`, import.meta.url);
const templates = new URL('../public/email-templates/', import.meta.url);

export const EMAIL_LOCALES = ['en-US', 'es-MX', 'pt-BR'];
/** GoTrue's template file for each email, and the copy block it reads. */
export const EMAILS = [
  { file: 'confirmation.html', key: 'confirmation' },
  { file: 'email_change.html', key: 'emailChange' },
  { file: 'invite.html', key: 'invite' },
  { file: 'magic_link.html', key: 'magicLink' },
  { file: 'recovery.html', key: 'recovery' },
];
/** The copy role of every key (06 §3); the contract test budgets each string by it. */
export const EMAIL_ROLES = {
  title: 'heading', preheader: 'body', heading: 'heading', body: 'body', note: 'body', action: 'action', safety: 'body',
  fallback: 'body', tagline: 'body', rights: 'legal',
};

/** The light-mode token values, parsed from the generated token sheet (one source: the Bible's YAML). */
export function emailTokens(markdown = readFileSync(bible, 'utf8')) {
  const css = generateTokens(markdown);
  const light = css.slice(css.indexOf('.lf-rebuild {'), css.indexOf('}'));
  const tokens = Object.fromEntries([...light.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const type = (name) => {
    const [, weight, size, lineHeight, family] = tokens[`type-${name}`].match(/^(\d+) ([\d.]+(?:px|rem))\/([\d.]+) (\w+)/);
    const px = size.endsWith('rem') ? `${Number.parseFloat(size) * 16}px` : size;
    // Email clients ignore the `font` shorthand in places; longhands, with safe fallbacks after the brand face.
    return `font-family:'${family}',Arial,Helvetica,sans-serif;font-size:${px};font-weight:${weight};line-height:${lineHeight};`;
  };
  return { ...tokens, type };
}

export function loadEmailCopy() {
  return Object.fromEntries(EMAIL_LOCALES.map((locale) => [locale, JSON.parse(readFileSync(i18n(locale), 'utf8'))]));
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One string in the learner's locale: the Go template picks es-MX, pt-BR or en-US (the default). */
function localized(copy, pick) {
  const [en, es, pt] = EMAIL_LOCALES.map((locale) => {
    const value = pick(copy[locale]);
    if (typeof value !== 'string' || !value) throw new Error(`Missing email copy for ${locale}`);
    if (value.includes('{{') || value.includes('}}')) throw new Error(`Email copy may not contain template syntax: ${value}`);
    return escape(value);
  });
  return `{{ if eq $l "es-MX" }}${es}{{ else if eq $l "pt-BR" }}${pt}{{ else }}${en}{{ end }}`;
}

export function renderEmail({ key }, copy, t) {
  const say = (name) => localized(copy, (locale) => (name in locale[key] ? locale[key][name] : locale.common[name]));
  const has = (name) => EMAIL_LOCALES.every((locale) => typeof copy[locale][key][name] === 'string');
  const url = '{{ .ConfirmationURL }}';
  const text = t.type('body');
  const small = t.type('caption');
  // 02 §8: the call to action is at least a 56 px target; it is the accent pill (07 §3 "the pill is an action").
  const button = `${t.type('button-lg')}color:${t['on-accent']};background:${t.accent};border-radius:9999px;display:inline-block;line-height:${t['target-base']};min-width:240px;padding:0 ${t['spacing-8']};text-align:center;text-decoration:none;`;
  return `{{ $l := index .Data "locale" }}<!DOCTYPE html>
<html lang="${localized(Object.fromEntries(EMAIL_LOCALES.map((l) => [l, { lang: l }])), (locale) => locale.lang)}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!-- Generated by frontend/scripts/build-rebuild-emails.mjs from the Bible 02 tokens and src/i18n/*/emails.json. Do not edit by hand. -->
  <title>${say('title')} · LittleFounders</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&amp;family=Nunito:wght@500;700;800&amp;display=swap" rel="stylesheet">
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0;mso-table-rspace:0}
    body{margin:0!important;padding:0!important;width:100%!important;background:${t.base}}
    a{color:${t['primary-strong']}}
    @media only screen and (max-width:620px){
      .lf-container{width:100%!important}
      .lf-pad{padding-left:${t['spacing-6']}!important;padding-right:${t['spacing-6']}!important}
      .lf-btn-row{width:100%!important}
      .lf-btn{display:block!important;min-width:0!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${t.base};">
  <div data-copy-role="body" style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${t.base};">${say('preheader')}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.base};">
    <tr>
      <td align="center" style="padding:${t['spacing-8']} ${t['spacing-4']};">
        <table role="presentation" class="lf-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" data-copy-role="brand" style="padding:0 0 ${t['spacing-6']};${t.type('display-lg')}color:${t.primary};">LittleFounders</td>
          </tr>
          <tr>
            <td class="lf-pad" style="background:${t.surface};border-radius:${t['rounded-lg']};padding:${t['spacing-10']} ${t['spacing-10']} ${t['spacing-8']};">
              <h1 data-copy-role="heading" style="margin:0 0 ${t['spacing-4']};${t.type('display-lg')}color:${t.content};">${say('heading')}</h1>
              <p data-copy-role="body" style="margin:0 0 ${t['spacing-4']};${text}color:${t.content};">${say('body')}</p>
${has('note') ? `              <p data-copy-role="body" style="margin:0 0 ${t['spacing-4']};${text}color:${t['content-muted']};">${say('note')}</p>\n` : ''}              <table role="presentation" class="lf-btn-row" cellpadding="0" cellspacing="0" style="margin:${t['spacing-6']} 0 0;">
                <tr><td align="center" bgcolor="${t.accent}" style="border-radius:9999px;">
                  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:${t['target-base']};v-text-anchor:middle;width:280px;" arcsize="50%" stroke="f" fillcolor="${t.accent}"><w:anchorlock/><center style="color:${t['on-accent']};font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">${say('action')}</center></v:roundrect><![endif]-->
                  <!--[if !mso]><!--><a class="lf-btn" data-copy-role="action" href="${url}" style="${button}">${say('action')}</a><!--<![endif]-->
                </td></tr>
              </table>
              <p data-copy-role="body" style="margin:${t['spacing-8']} 0 ${t['spacing-2']};${small}color:${t['content-muted']};">${say('fallback')}</p>
              <p data-copy-role="data" style="margin:0;${small}word-break:break-all;"><a href="${url}" style="color:${t['primary-strong']};text-decoration:underline;">${url}</a></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${t['spacing-8']} 0 0;">
                <tr><td style="background:${t.sunken};border-radius:${t['rounded-sm']};padding:${t['spacing-4']} ${t['spacing-5']};">
                  <p data-copy-role="body" style="margin:0;${small}color:${t.content};">${say('safety')}</p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:${t['spacing-8']} ${t['spacing-6']} 0;">
              <p data-copy-role="body" style="margin:0 0 ${t['spacing-2']};${small}color:${t['content-muted']};">${say('tagline')}</p>
              <p data-copy-role="data" style="margin:0 0 ${t['spacing-2']};${small}"><a href="https://littlefounders.ai" style="color:${t['primary-strong']};text-decoration:none;">littlefounders.ai</a></p>
              <p data-copy-role="legal" style="margin:0;${small}color:${t['content-muted']};">${say('rights')}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function generateEmails() {
  const t = emailTokens();
  const copy = loadEmailCopy();
  return Object.fromEntries(EMAILS.map((email) => [email.file, renderEmail(email, copy, t)]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  const generated = generateEmails();
  const check = process.argv.includes('--check');
  const drifted = [];
  for (const [file, html] of Object.entries(generated)) {
    const target = new URL(file, templates);
    if (check) {
      let current = '';
      try { current = readFileSync(target, 'utf8'); } catch { /* missing counts as drift */ }
      if (current !== html) drifted.push(file);
    } else writeFileSync(target, html);
  }
  if (drifted.length) throw new Error(`Account email templates drifted from the design system or emails.json: ${drifted.join(', ')}. Run node frontend/scripts/build-rebuild-emails.mjs`);
  console.log(check ? `Account email templates match the design system (${Object.keys(generated).length} templates, 3 locales).` : `Wrote ${Object.keys(generated).length} account email templates.`);
}
