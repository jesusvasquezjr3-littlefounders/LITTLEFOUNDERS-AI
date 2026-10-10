/*
 * The one frame every email is built in, top to bottom: the logo, a title, the picture of the four
 * characters, the message, a code or a button, a closing line, a pale yellow box of notes, and the
 * footer (the logo in ink, the social marks, the rights line, why the email arrived and how to stop
 * the optional ones). A new email fills a `Message` and gets all of it.
 *
 * The picture has no background and no border: it is transparent and sits on the email's own
 * color, light or dark, the way the scenes sit on the page in the product.
 *
 * Mail programs are not browsers. So: tables for structure, every style written on its element,
 * PNG and JPEG only, and nothing that needs a script. The <style> block only adds what the better
 * programs understand: the brand typeface, the narrow-screen sizes and the dark colors. Where it is
 * ignored the email is still whole, in the light colors and a system typeface.
 *
 * Colors, the typeface and the button are the frontend's (frontend/src/styles/lf-theme.css).
 */
export type Message = {
  lang: string;
  subject: string;
  /** The line an inbox shows after the subject. */
  preview: string;
  title: string;
  body: string[];
  action?: { kind: 'code'; label: string; code: string; validity: string } | { kind: 'button'; label: string; url: string };
  closing: string;
  signature: string;
  note: { title: string; items: string[] };
  footer: {
    rights: string;
    reason: string;
    unsubscribe?: { label: string; rest: string; url: string };
    social: { facebook: string; instagram: string; x: string; linkedin: string };
  };
  alt: { logo: string; hero: string };
};

export type Surroundings = {
  /** Where the images and the typeface are served from: the site's own address. */
  siteUrl: string;
};

const LIGHT = {
  canvas: '#f4f5fd', paper: '#ffffff', ink: '#11132a', text: '#4a4d63', quiet: '#595c71',
  well: '#f0f2fb', note: '#ffefc9', primary: '#5c55fd', onPrimary: '#ffffff',
};
const DARK = { canvas: '#0b0d1b', paper: '#131627', ink: '#f5f6fe', text: '#b3b6cb', quiet: '#9b9eb4', well: '#1c1f32', note: '#362801' };
const FONT = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text made safe to place in HTML, in an attribute or between tags. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

const table = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

function styles(fontUrl: string): string {
  return `
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:200 800;font-display:swap;src:url('${fontUrl}') format('woff2');}
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{text-decoration:none;}
@media (max-width:620px){
.lf-outer{padding:20px 10px 28px !important;}
.lf-card{padding:28px 20px 24px !important;border-radius:20px !important;}
.lf-title{font-size:25px !important;line-height:32px !important;}
.lf-code{font-size:32px !important;line-height:40px !important;letter-spacing:6px !important;padding-left:6px !important;}
.lf-well{padding:18px 20px !important;}
.lf-note{padding:18px 18px !important;}
.lf-button{padding:17px 26px !important;}
}
@media (prefers-color-scheme:dark){
.lf-canvas{background-color:${DARK.canvas} !important;}
.lf-card{background-color:${DARK.paper} !important;}
.lf-well{background-color:${DARK.well} !important;}
.lf-note{background-color:${DARK.note} !important;}
.lf-ink{color:${DARK.ink} !important;}
.lf-text{color:${DARK.text} !important;}
.lf-quiet{color:${DARK.quiet} !important;}
.lf-light-only{display:none !important;}
.lf-dark-only{display:block !important;max-height:none !important;overflow:visible !important;}
}`.trim();
}

const paragraph = (text: string, last: boolean): string =>
  `<p class="lf-text" style="margin:0 0 ${last ? 0 : 14}px;font-family:${FONT};font-size:16px;line-height:26px;font-weight:400;color:${LIGHT.text};">${escapeHtml(text)}</p>`;

function actionHtml(action: NonNullable<Message['action']>): string {
  if (action.kind === 'button') {
    return `
<table ${table} align="center" style="margin:0 auto;"><tr>
<td align="center" bgcolor="${LIGHT.primary}" style="border-radius:999px;background-color:${LIGHT.primary};">
<a class="lf-button" href="${escapeHtml(action.url)}" target="_blank" style="display:inline-block;padding:17px 40px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;color:${LIGHT.onPrimary};text-decoration:none;border-radius:999px;">${escapeHtml(action.label)}</a>
</td></tr></table>`;
  }

  // One piece of text, spaced by the typeface and not split into boxes, so it is copied whole.
  return `
<table ${table} align="center" style="margin:0 auto;"><tr>
<td class="lf-well" align="center" bgcolor="${LIGHT.well}" style="border-radius:20px;background-color:${LIGHT.well};padding:20px 36px;">
<p class="lf-quiet" style="margin:0 0 4px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:${LIGHT.quiet};">${escapeHtml(action.label)}</p>
<p class="lf-code lf-ink" style="margin:0;font-family:${FONT};font-size:40px;line-height:48px;font-weight:800;letter-spacing:10px;padding-left:10px;color:${LIGHT.ink};">${escapeHtml(action.code)}</p>
</td></tr></table>
<p class="lf-quiet" style="margin:14px 0 0;font-family:${FONT};font-size:14px;line-height:22px;font-weight:400;color:${LIGHT.quiet};">${escapeHtml(action.validity)}</p>`;
}

export function renderHtml(message: Message, around: Surroundings): string {
  const site = around.siteUrl.replace(/\/+$/, '');
  const asset = (name: string): string => `${site}/email/v1/${name}`;
  const { footer, note } = message;
  const body = message.body.map((text, index) => paragraph(text, index === message.body.length - 1)).join('\n');
  const notes = note.items
    .map((text, index) => `<p class="lf-ink" style="margin:${index === 0 ? 0 : 8}px 0 0;font-family:${FONT};font-size:14px;line-height:22px;font-weight:400;color:${LIGHT.ink};">${escapeHtml(text)}</p>`)
    .join('\n');
  const social = (['facebook', 'instagram', 'x', 'linkedin'] as const)
    .map((name) => `<td style="padding:0 8px;"><img src="${asset(`social-${name}.png`)}" width="24" height="24" alt="${escapeHtml(footer.social[name])}" style="display:block;width:24px;height:24px;"></td>`)
    .join('');
  const unsubscribe = footer.unsubscribe
    ? `<p class="lf-quiet" style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${LIGHT.quiet};"><a class="lf-quiet" href="${escapeHtml(footer.unsubscribe.url)}" target="_blank" style="color:${LIGHT.quiet};font-weight:700;text-decoration:underline;">${escapeHtml(footer.unsubscribe.label)}</a> ${escapeHtml(footer.unsubscribe.rest)}</p>`
    : '';

  return `<!doctype html>
<html lang="${escapeHtml(message.lang)}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(message.subject)}</title>
<style>${styles(`${site}/fonts/plus-jakarta-sans-latin-v1.woff2`)}</style>
</head>
<body class="lf-canvas" style="margin:0;padding:0;background-color:${LIGHT.canvas};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${LIGHT.canvas};">${escapeHtml(message.preview)}</div>
<table ${table} width="100%" class="lf-canvas" bgcolor="${LIGHT.canvas}" style="width:100%;background-color:${LIGHT.canvas};"><tr>
<td class="lf-outer" align="center" style="padding:32px 16px 40px;">
<table ${table} width="600" style="width:100%;max-width:600px;">

<tr><td align="center" style="padding:0 0 24px;">
<img src="${asset('logo.png')}" width="168" height="31" alt="${escapeHtml(message.alt.logo)}" style="display:block;width:168px;height:auto;max-width:100%;">
</td></tr>

<tr><td class="lf-card" align="center" bgcolor="${LIGHT.paper}" style="background-color:${LIGHT.paper};border-radius:24px;padding:40px 40px 32px;text-align:center;">

<h1 class="lf-title lf-ink" style="margin:0 0 8px;font-family:${FONT};font-size:30px;line-height:38px;font-weight:800;letter-spacing:-0.4px;color:${LIGHT.ink};">${escapeHtml(message.title)}</h1>

<img src="${asset('hero.png')}" width="520" alt="${escapeHtml(message.alt.hero)}" style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto;">

<table ${table} width="100%" style="width:100%;"><tr><td align="center" style="padding:12px 0 0;text-align:center;">
${body}
</td></tr>
${message.action ? `<tr><td align="center" style="padding:24px 0 0;text-align:center;">${actionHtml(message.action)}
</td></tr>` : ''}
<tr><td align="center" style="padding:28px 0 0;text-align:center;">
<p class="lf-text" style="margin:0;font-family:${FONT};font-size:16px;line-height:26px;color:${LIGHT.text};">${escapeHtml(message.closing)}</p>
<p class="lf-ink" style="margin:2px 0 0;font-family:${FONT};font-size:16px;line-height:26px;font-weight:700;color:${LIGHT.ink};">${escapeHtml(message.signature)}</p>
</td></tr>
<tr><td style="padding:28px 0 0;">
<table ${table} width="100%" style="width:100%;"><tr>
<td class="lf-note" align="center" bgcolor="${LIGHT.note}" style="background-color:${LIGHT.note};border-radius:16px;padding:20px 24px;text-align:center;">
<p class="lf-ink" style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:800;color:${LIGHT.ink};">${escapeHtml(note.title)}</p>
${notes}
</td></tr></table>
</td></tr></table>

</td></tr>

<tr><td align="center" style="padding:32px 16px 0;text-align:center;">
<div class="lf-light-only"><img src="${asset('logo-ink.png')}" width="136" height="28" alt="${escapeHtml(message.alt.logo)}" style="display:block;width:136px;height:28px;margin:0 auto;"></div>
<div class="lf-dark-only" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><img src="${asset('logo-white.png')}" width="136" height="28" alt="${escapeHtml(message.alt.logo)}" style="display:block;width:136px;height:28px;margin:0 auto;"></div>
<table ${table} align="center" style="margin:18px auto 0;"><tr>${social}</tr></table>
<p class="lf-quiet" style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${LIGHT.quiet};">${escapeHtml(footer.rights)}</p>
<p class="lf-quiet" style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${LIGHT.quiet};">${escapeHtml(footer.reason)}</p>
${unsubscribe}
</td></tr>

</table>
</td></tr></table>
</body>
</html>
`;
}

/** The same email for a program that shows no HTML, and for the part of every email a filter reads. */
export function renderText(message: Message): string {
  const lines: string[] = [message.title, '', ...message.body, ''];

  if (message.action?.kind === 'code') lines.push(`${message.action.label}: ${message.action.code}`, message.action.validity, '');
  if (message.action?.kind === 'button') lines.push(`${message.action.label}: ${message.action.url}`, '');

  lines.push(message.closing, message.signature, '', message.note.title, ...message.note.items.map((item) => `- ${item}`), '', '--', message.footer.rights, message.footer.reason);

  if (message.footer.unsubscribe) lines.push(`${message.footer.unsubscribe.label} ${message.footer.unsubscribe.rest} ${message.footer.unsubscribe.url}`);

  return `${lines.join('\n')}\n`;
}
