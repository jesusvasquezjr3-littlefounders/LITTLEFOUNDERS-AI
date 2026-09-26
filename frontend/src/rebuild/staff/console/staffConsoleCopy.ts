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

const COPY: Record<Locale, ConsoleCopy> = { 'en-US': enStaff.staffConsole, 'es-MX': esStaff.staffConsole, 'pt-BR': ptStaff.staffConsole };
const SECTIONS: Record<Locale, SectionNames> = { 'en-US': enCore.appShell.staff, 'es-MX': esCore.appShell.staff, 'pt-BR': ptCore.appShell.staff };

export function consoleCopyFor(locale: Locale): { copy: ConsoleCopy; sections: SectionNames; locale: Locale } {
  return { copy: COPY[locale], sections: SECTIONS[locale], locale };
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
