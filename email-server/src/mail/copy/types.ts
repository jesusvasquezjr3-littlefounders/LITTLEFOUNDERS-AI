/*
 * The words of every email, one file per language next to this one. A language file must fill this
 * whole shape, so a missing sentence is a build error and never an empty space in somebody's inbox.
 *
 * `{minutes}`, `{email}` and `{year}` are replaced when the email is built. Every string is plain
 * text: it is escaped before it goes into the HTML.
 */
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

/** A code email: the code is shown between `body` and `validity`. */
type CodeCopy = {
  subject: string;
  preview: string;
  title: string;
  body: string[];
  validity: string;
  closing: string;
  noteTitle: string;
  notes: string[];
  reason: string;
};

/** An email with a button, or with nothing to press. */
type MessageCopy = {
  subject: string;
  preview: string;
  title: string;
  body: string[];
  closing: string;
  noteTitle: string;
  notes: string[];
  reason: string;
};

export type Copy = {
  shared: {
    /** The `lang` attribute of the email. */
    lang: string;
    signature: string;
    logoAlt: string;
    heroAlt: string;
    codeLabel: string;
    rights: string;
    /** `unsubscribe` is the link, `unsubscribeRest` the words after it. */
    unsubscribe: string;
    unsubscribeRest: string;
    social: { facebook: string; instagram: string; x: string; linkedin: string };
  };
  signInCode: CodeCopy;
  signUpCode: CodeCopy;
  emailChangeCode: CodeCopy;
  welcome: MessageCopy & { action: string };
  emailChanged: MessageCopy;
  accountClosed: MessageCopy;
};
