// Writes every email in every language to email-server/preview/ (not tracked), to open in a browser and look at.
// Nothing is sent. The images come straight from frontend/public, so no server has to be running.
//
//   npm run preview                                   all of them
//   npm run preview -- --site http://localhost:5173   take the images from a running site instead
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOCALES } from '../src/mail/copy/types.js';
import { renderEmail, TEMPLATES, type SendBody } from '../src/mail/templates.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'preview');
const siteFlag = process.argv.indexOf('--site');
const siteUrl = siteFlag > 0 ? String(process.argv[siteFlag + 1]) : pathToFileURL(resolve(root, '../frontend/public')).href;

const unsubscribe = { page: 'https://littlefounders.ai/unsubscribe?token=preview', oneClick: 'https://api-b2c.littlefounders.ai/api/v1/email/unsubscribe/one-click?token=preview' };
const base = { to: 'reader@example.test', unsubscribe };
const code = { code: '482915', minutes: 15 };

function sample(template: (typeof TEMPLATES)[number], locale: (typeof LOCALES)[number]): SendBody {
  switch (template) {
    case 'sign-in-code': return { ...base, locale, template, data: code };
    case 'sign-up-code': return { ...base, locale, template, data: code };
    case 'email-change-code': return { ...base, locale, template, data: code };
    case 'welcome': return { ...base, locale, template, data: {} };
    case 'email-changed': return { ...base, locale, template, data: { newEmail: 'jordan.new@example.test' } };
    case 'account-closed': return { ...base, locale, template, data: {} };
  }
}

mkdirSync(out, { recursive: true });

const links: string[] = [];

for (const template of TEMPLATES) {
  for (const locale of LOCALES) {
    const email = renderEmail(sample(template, locale), { siteUrl });
    const name = `${template}.${locale}`;

    writeFileSync(join(out, `${name}.html`), email.html);
    writeFileSync(join(out, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}`);
    links.push(`<li><a href="${name}.html">${template} (${locale})</a>: ${email.subject} · <a href="${name}.txt">text</a> · ${(Buffer.byteLength(email.html) / 1024).toFixed(1)} KB</li>`);
  }
}

writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font:16px/1.6 system-ui;margin:32px"><h1>Email previews</h1><ul>${links.join('')}</ul>`);
console.log(`${links.length} emails in ${out}`);
