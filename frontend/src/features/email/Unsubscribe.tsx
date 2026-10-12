import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as z from 'zod/mini';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { usePageTitle } from '@/components/pageTitle';
import { Button } from '@/components/ui/button';
import { body, grid, heading } from '@/features/landing/type';
import { useCoreCopy } from '@/i18n/useCopy';
import { api } from '@/lib/api';

/*
 * Where the "Unsubscribe" link at the bottom of an email leads (`/unsubscribe?token=…`). The token
 * in the address is the whole permission, so this works without signing in. Opening the page
 * changes nothing: the person presses the button. That way a mail scanner that follows every link
 * unsubscribes nobody, and the person sees what stops and what does not before deciding.
 *
 * One primary button at a time: unsubscribe, then (as the undo) subscribe again. Crawlers are told
 * not to index it, and the token never leaves this page except to Core.
 */
const Answer = z.object({ subscribed: z.boolean() });

type State = 'asking' | 'unsubscribed' | 'subscribed';

export function Unsubscribe() {
  const copy = useCoreCopy().unsubscribe;
  const titleId = useId();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('asking');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  usePageTitle(copy.pageTitle);

  useEffect(() => {
    const meta = document.createElement('meta');

    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.append(meta);

    return () => meta.remove();
  }, []);

  async function save(subscribed: boolean) {
    setBusy(true);
    setFailed(false);

    try {
      await api('/api/v1/email/unsubscribe', Answer, { method: 'POST', body: { token, subscribed } });
      setState(subscribed ? 'subscribed' : 'unsubscribed');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const words = token.length < 20
    ? { title: copy.invalidTitle, text: copy.invalidText }
    : state === 'asking' ? { title: copy.title, text: copy.text }
      : state === 'unsubscribed' ? { title: copy.doneTitle, text: copy.doneText }
        : { title: copy.againTitle, text: copy.againText };

  return <div className="py-4 md:py-6">
    <Breadcrumbs trail={[{ label: copy.pageTitle }]} />
    <section aria-labelledby={titleId} className={`${grid} items-center gap-y-4 pt-8 pb-16 text-center md:pt-12 md:pb-24`}>
      <div className="col-span-4 grid min-w-0 justify-items-center gap-4 md:col-span-8 lg:col-span-12" aria-live="polite">
        <h1 id={titleId} className={heading}>{words.title}</h1>
        <p className={`${body} text-center`}>{words.text}</p>
        <div className="grid w-full max-w-sm sm:block sm:w-auto sm:max-w-none">
          {token.length < 20
            ? <Button asChild size="lg" className="w-full sm:w-auto"><Link to="/">{copy.home}</Link></Button>
            : state === 'asking'
              ? <Button type="button" size="lg" className="w-full sm:w-auto" loading={busy} onClick={() => { void save(false); }}>{copy.button}</Button>
              : state === 'unsubscribed'
                ? <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" loading={busy} onClick={() => { void save(true); }}>{copy.again}</Button>
                : <Button asChild size="lg" className="w-full sm:w-auto"><Link to="/">{copy.home}</Link></Button>}
        </div>
        <p role="alert" className={`${body} min-h-6 text-center text-[var(--v-danger-ink)]`}>{failed ? copy.error : ''}</p>
      </div>
    </section>
  </div>;
}
