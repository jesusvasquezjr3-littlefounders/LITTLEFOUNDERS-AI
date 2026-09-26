import { Button, Copy, ErrorState, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './moneyHabits.css';

/*
 * S07.4 (D.13): the three states of one payout waiting to be split, before
 * the SplitChooser opens: closed (one line with "Split them"), loading the
 * child's usual split and goals, and a load that failed (with a retry). The
 * route wrapper (routes/app/tasks/AllocationPanel.tsx) keeps only the data
 * and the transport and renders these, so no rebuilt class name lives in the
 * legacy tree, where its global CSS could restyle a shared control (S03).
 * No celebration: a coin split is not an OD-7 milestone.
 */

export interface AllocationStatesCopy {
  ready: string; splitNow: string; frozen: string; loading: string; failed: string; retry: string;
}

export function AllocationStates({ state, copy, locale, dark, amount, title, frozen = false, onOpen, onRetry }: {
  state: 'closed' | 'loading' | 'failed';
  copy: AllocationStatesCopy;
  locale: string;
  dark: boolean;
  amount: number;
  /** The chore's title, when it is a chore reward. */
  title?: string;
  frozen?: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const ready = copy.ready.replace('{count}', String(amount));
  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="allocation" data-allocation-state={state} data-theme={dark ? 'dark' : 'light'}
    lang={locale} aria-label={ready}>
    {state === 'closed' ? <>
      <div className="lf-family-hub-row">
        <span data-copy-role="data">{title ? <span className="ugc">{title} · </span> : null}{ready}</span>
        <Button variant="accent" disabled={frozen} onClick={onOpen}>{copy.splitNow}</Button>
      </div>
      {frozen && <Copy role="body">{copy.frozen}</Copy>}
    </> : state === 'failed'
      ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
      : <LoadingState label={copy.loading} lines={2} />}
  </section>;
}
