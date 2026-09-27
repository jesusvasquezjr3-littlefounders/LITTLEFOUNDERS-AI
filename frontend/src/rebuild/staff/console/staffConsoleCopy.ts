import enStaff from '../../../i18n/en-US/rebuild-staff.json';
import esStaff from '../../../i18n/es-MX/rebuild-staff.json';
import ptStaff from '../../../i18n/pt-BR/rebuild-staff.json';
import enCore from '../../../i18n/en-US/rebuild-core.json';
import esCore from '../../../i18n/es-MX/rebuild-core.json';
import ptCore from '../../../i18n/pt-BR/rebuild-core.json';
import { useRebuildEnvironment } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';

/*
 * The staff console's copy (`rebuild-staff.json` → `staffConsole`, Lane 6),
 * keyed <screen>.<role>.<key> so the copy-budget test reads each string's role
 * from its path. The section names are the staff navigation's own labels
 * (`rebuild-core.json` → `appShell.staff`, Lane 0), read, never copied, so a
 * page title and its menu entry cannot drift apart.
 */

export type ConsoleCopy = typeof enStaff.staffConsole;
export type SectionNames = typeof enCore.appShell.staff;
/** The C.5 / C.6 panels' copy (`staffLiveContent`) and the C.24 dashboard's (`staffMentorQuality`), mounted by W2T.2. */
export type LiveCopy = typeof enStaff.staffLiveContent;
export type QualityCopy = typeof enStaff.staffMentorQuality;

const COPY: Record<Locale, ConsoleCopy> = { 'en-US': enStaff.staffConsole, 'es-MX': esStaff.staffConsole, 'pt-BR': ptStaff.staffConsole };
const SECTIONS: Record<Locale, SectionNames> = { 'en-US': enCore.appShell.staff, 'es-MX': esCore.appShell.staff, 'pt-BR': ptCore.appShell.staff };
const LIVE: Record<Locale, LiveCopy> = { 'en-US': enStaff.staffLiveContent, 'es-MX': esStaff.staffLiveContent, 'pt-BR': ptStaff.staffLiveContent };
const QUALITY: Record<Locale, QualityCopy> = { 'en-US': enStaff.staffMentorQuality, 'es-MX': esStaff.staffMentorQuality, 'pt-BR': ptStaff.staffMentorQuality };

export function consoleCopyFor(locale: Locale): { copy: ConsoleCopy; sections: SectionNames; locale: Locale; live: LiveCopy; quality: QualityCopy } {
  return { copy: COPY[locale], sections: SECTIONS[locale], locale, live: LIVE[locale], quality: QUALITY[locale] };
}

/** The copy in the surface's language (the shell's RebuildRoot sets it from the app's i18n). */
export function useConsoleCopy() {
  return consoleCopyFor(useRebuildEnvironment().locale);
}

/** Fills `{name}` placeholders; a missing value leaves nothing behind. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

/** A label from a closed vocabulary, or the raw value (a code the console does not know yet is shown, never hidden). */
export function labelOf(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}
