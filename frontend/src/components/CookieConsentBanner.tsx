import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { sileo } from 'sileo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSiteCopy } from '@/i18n/useCopy';
import { getCookieConsent, setCookieConsent } from '@/lib/visitor';

/*
 * The cookie choice. Privacy-preserving by default: nothing optional runs
 * until the visitor accepts, rejecting is as easy and as prominent as
 * accepting (two equal buttons, neither pre-selected), and a choice can be
 * changed at any time from the footer's "Cookie preferences".
 *
 * What it controls is what the product does (lib/visitor): one decision
 * covers both optional kinds (where a visit came from, and visit
 * measurement), so the preferences say so instead of drawing two switches that
 * could not be set apart. Separate choices per kind are an owner question.
 *
 * The banner is a non-modal region docked at the bottom; it never takes focus
 * from the page. The preferences are a modal sheet (focus trap, Escape, focus
 * returns). A decision is confirmed with a toast.
 */

type CookieChoice = 'granted' | 'denied' | 'unset';

const OPEN_PREFERENCES_EVENT = 'lf:open-cookie-preferences';

/** Reopens the cookie preferences (the site footer uses this). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export function CookieConsentBanner({ onDecision }: { onDecision?: (granted: boolean) => void }) {
  const copy = useSiteCopy().cookies;
  const headingId = useId();
  const [choice, setChoice] = useState<CookieChoice>(getCookieConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => {
      setChoice(getCookieConsent());
      setPreferencesOpen(true);
    };

    window.addEventListener(OPEN_PREFERENCES_EVENT, open);

    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const decide = (granted: boolean) => {
    setCookieConsent(granted ? 'granted' : 'denied');
    setChoice(granted ? 'granted' : 'denied');
    setPreferencesOpen(false);
    onDecision?.(granted);
    sileo.success({ title: granted ? copy.toastGranted : copy.toastDenied });
  };

  const current = choice === 'granted' ? copy.currentGranted : choice === 'denied' ? copy.currentDenied : copy.currentUnset;

  const decisions = <>
    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => decide(false)}>{copy.reject}</Button>
    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => decide(true)}>{copy.accept}</Button>
  </>;

  return <>
    <AnimatePresence>
      {choice === 'unset' && !preferencesOpen ? <motion.section key="banner" aria-labelledby={headingId}
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--r-sheet)] bg-[var(--v-paper)] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)] sm:px-6"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-4">
          <div className="grid min-w-0 flex-[1_1_20em] gap-1">
            <h2 id={headingId} className="text-[length:var(--fs-title)] font-bold">{copy.title}</h2>
            <p className="text-[length:var(--fs-small)] text-[var(--muted-foreground)]">{copy.body}</p>
          </div>
          <div className="flex flex-[1_1_auto] flex-wrap gap-3">
            {decisions}
            <Button type="button" variant="ghost" aria-haspopup="dialog" onClick={() => setPreferencesOpen(true)}>{copy.preferences}</Button>
          </div>
        </div>
      </motion.section> : null}
    </AnimatePresence>

    <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader className="!flex-col !items-stretch gap-2">
          <SheetTitle>{copy.sheetTitle}</SheetTitle>
          <SheetDescription>{copy.sheetIntro}</SheetDescription>
        </SheetHeader>
        <p role="status" className="rounded-[var(--r-card-sm)] bg-[var(--status-info-bg)] px-4 py-3 text-[length:var(--fs-small)] font-semibold text-[var(--status-info-ink)]">{current}</p>
        <ul className="grid gap-3">
          {([
            [copy.necessaryTitle, copy.necessaryBody, copy.alwaysOn, 'olive'],
            [copy.attributionTitle, copy.attributionBody, copy.optional, 'blue'],
            [copy.measurementTitle, copy.measurementBody, copy.optional, 'blue'],
          ] as const).map(([title, body, tag, tone]) => <li key={title} className="grid justify-items-start gap-2 rounded-[var(--r-card-sm)] bg-[var(--v-beige)] p-4">
            <h3 className="text-[length:var(--fs-lead)] font-bold">{title}</h3>
            <Badge variant={tone}>{tag}</Badge>
            <p className="text-[length:var(--fs-small)]">{body}</p>
          </li>)}
        </ul>
        <p className="text-[length:var(--fs-small)]">{copy.together}</p>
        <SheetFooter className="flex gap-3">{decisions}</SheetFooter>
      </SheetContent>
    </Sheet>
  </>;
}
