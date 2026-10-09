import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import type { Locale } from '../design/copyBudget';
import './site.css';

/*
 * The public site's shared pieces. Nothing here reads a session, a router or
 * analytics: the app passes the calls to action in, so every surface stays
 * free of behaviour it does not own.
 */

/** The public site's own strings in a locale. */
export function siteCopy(locale: Locale) {
  return rebuildNamespaceCopy[locale].site;
}

/**
 * "I just want to learn" / "Start free". `origin` names the button that was
 * pressed. This is the seam where real behaviour attaches later.
 */
export type StartAction = { onStart: (origin: string) => void };

/** "I'm a Parent". This is the seam where real behaviour attaches later. */
export type TutorAction = { onStart: () => void };
