import { z } from 'zod';
import { enUS } from './copy/en-US.js';
import { esMX } from './copy/es-MX.js';
import { ptBR } from './copy/pt-BR.js';
import { LOCALES, type Copy, type Locale } from './copy/types.js';
import { renderHtml, renderText, type Message, type Surroundings } from './layout.js';

/*
 * The emails LittleFounders sends. A caller names one, gives the language and the few values it
 * needs, and gets back a subject, the HTML and the plain text. Nobody outside this folder writes a
 * word of an email or a line of its HTML.
 *
 *   sign-in-code        a code for an address that already has an account
 *   sign-up-code        a code for an address that is opening one
 *   welcome             once, when a new account is complete
 *   email-change-code   a code sent to the address an account wants to move to
 *   email-changed       tells the old address that the account moved
 *   account-closed      confirms an account was closed
 *
 * `account` emails are part of using the account and always arrive. `product` emails are optional:
 * they carry the one-click unsubscribe headers, and the caller does not send them to somebody who
 * unsubscribed.
 */
const COPY: Record<Locale, Copy> = { 'en-US': enUS, 'es-MX': esMX, 'pt-BR': ptBR };

const Code = z.object({ code: z.string().regex(/^\d{6}$/), minutes: z.number().int().min(1).max(60) }).strict();
const Nothing = z.object({}).strict();

const Common = {
  to: z.email().max(254),
  locale: z.enum(LOCALES),
  userId: z.uuid().optional(),
  // Both addresses are made by the caller, which holds the key that signs them.
  unsubscribe: z.object({ page: z.url().max(2000), oneClick: z.url().max(2000) }).strict().optional(),
};

export const SendBody = z.discriminatedUnion('template', [
  z.object({ ...Common, template: z.literal('sign-in-code'), data: Code }).strict(),
  z.object({ ...Common, template: z.literal('sign-up-code'), data: Code }).strict(),
  z.object({ ...Common, template: z.literal('email-change-code'), data: Code }).strict(),
  z.object({ ...Common, template: z.literal('welcome'), data: Nothing }).strict(),
  z.object({ ...Common, template: z.literal('email-changed'), data: z.object({ newEmail: z.email().max(254) }).strict() }).strict(),
  z.object({ ...Common, template: z.literal('account-closed'), data: Nothing }).strict(),
]);

export type SendBody = z.infer<typeof SendBody>;
export type TemplateName = SendBody['template'];

export const TEMPLATES = ['sign-in-code', 'sign-up-code', 'email-change-code', 'welcome', 'email-changed', 'account-closed'] as const satisfies readonly TemplateName[];

const KIND: Record<TemplateName, 'account' | 'product'> = {
  'sign-in-code': 'account',
  'sign-up-code': 'account',
  'email-change-code': 'account',
  welcome: 'product',
  'email-changed': 'account',
  'account-closed': 'account',
};

export type RenderedEmail = { subject: string; html: string; text: string; headers: Record<string, string> };

const fill = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** `j•••@example.com`: enough for the owner to recognize an address, not enough to hand it to anyone else. */
function masked(email: string): string {
  const at = email.lastIndexOf('@');

  return at < 1 ? email : `${email.slice(0, 1)}•••${email.slice(at)}`;
}

type Words = { subject: string; preview: string; title: string; body: string[]; closing: string; noteTitle: string; notes: string[]; reason: string };

export function renderEmail(input: SendBody, around: Surroundings): RenderedEmail {
  const copy = COPY[input.locale];
  const values: Record<string, string> = { year: String(new Date().getUTCFullYear()) };
  let words: Words;
  let action: Message['action'];

  switch (input.template) {
    case 'sign-in-code':
    case 'sign-up-code':
    case 'email-change-code': {
      const code = input.template === 'sign-in-code' ? copy.signInCode : input.template === 'sign-up-code' ? copy.signUpCode : copy.emailChangeCode;

      values.minutes = String(input.data.minutes);
      words = code;
      action = { kind: 'code', label: copy.shared.codeLabel, code: input.data.code, validity: fill(code.validity, values) };
      break;
    }

    case 'welcome':
      words = copy.welcome;
      action = { kind: 'button', label: copy.welcome.action, url: around.siteUrl };
      break;

    case 'email-changed':
      values.email = masked(input.data.newEmail);
      words = copy.emailChanged;
      break;

    case 'account-closed':
      words = copy.accountClosed;
      break;
  }

  const message: Message = {
    lang: copy.shared.lang,
    subject: fill(words.subject, values),
    preview: fill(words.preview, values),
    title: fill(words.title, values),
    body: words.body.map((text) => fill(text, values)),
    ...(action ? { action } : {}),
    closing: words.closing,
    signature: copy.shared.signature,
    note: { title: words.noteTitle, items: words.notes.map((text) => fill(text, values)) },
    footer: {
      rights: fill(copy.shared.rights, values),
      reason: words.reason,
      ...(input.unsubscribe ? { unsubscribe: { label: copy.shared.unsubscribe, rest: copy.shared.unsubscribeRest, url: input.unsubscribe.page } } : {}),
      social: copy.shared.social,
    },
    alt: { logo: copy.shared.logoAlt, hero: copy.shared.heroAlt },
  };

  // The header a mail program turns into its own "unsubscribe" button (RFC 8058), on optional emails only.
  const headers: Record<string, string> = KIND[input.template] === 'product' && input.unsubscribe
    ? { 'List-Unsubscribe': `<${input.unsubscribe.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : {};

  return { subject: message.subject, html: renderHtml(message, around), text: renderText(message), headers };
}
