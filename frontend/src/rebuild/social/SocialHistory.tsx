import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';

export const FOLLOW_HISTORY_ACTIONS = ['social.follow', 'social.unfollow', 'social.block', 'social.unblock'] as const;
/* E.2 (GAP-FIX-R4): the child's goals-together events (OD-27 (1)), as Core reads them from the audit log. */
export const COOP_HISTORY_ACTIONS = [
  'social.coop_goal_created', 'social.coop_member_invited', 'social.coop_member_joined', 'social.coop_member_ended',
  'social.coop_goal_closed', 'social.coop_guardian_enabled', 'social.coop_guardian_disabled',
] as const;
export type SocialHistoryAction = (typeof FOLLOW_HISTORY_ACTIONS)[number] | (typeof COOP_HISTORY_ACTIONS)[number];

export interface SocialHistoryEntry {
  id: number; action: SocialHistoryAction; sourceName: string | null; targetName: string | null; createdAt: string; reason?: string | null;
}
export interface SocialHistoryCopy {
  title: string; close: string; loading: string; failed: string; empty: string; retry: string; more: string; hidden: string;
  follow: string; unfollow: string; block: string; unblock: string;
  coopCreated: string; coopInvited: string; coopJoined: string; coopLeft: string; coopRemoved: string; coopDeclined: string;
  coopWithdrawn: string; coopEnded: string; coopClosed: string; coopOn: string; coopOff: string;
}

type CoopKey = 'coopCreated' | 'coopInvited' | 'coopJoined' | 'coopLeft' | 'coopRemoved' | 'coopDeclined' | 'coopWithdrawn' | 'coopEnded' | 'coopClosed' | 'coopOn' | 'coopOff';
const ENDED: Record<string, CoopKey> = { left: 'coopLeft', removed: 'coopRemoved', declined: 'coopDeclined', withdrawn: 'coopWithdrawn' };

/** The sentence key of one goals-together event; every other ending (lapsed, a connection ended, the Tutor turned it off) reads as "no longer in". */
export function coopSentence(entry: Pick<SocialHistoryEntry, 'action' | 'reason'>): CoopKey | null {
  switch (entry.action) {
    case 'social.coop_goal_created': return 'coopCreated';
    case 'social.coop_member_invited': return 'coopInvited';
    case 'social.coop_member_joined': return 'coopJoined';
    case 'social.coop_member_ended': return ENDED[entry.reason ?? ''] ?? 'coopEnded';
    case 'social.coop_goal_closed': return 'coopClosed';
    case 'social.coop_guardian_enabled': return 'coopOn';
    case 'social.coop_guardian_disabled': return 'coopOff';
    default: return null;
  }
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key]! : whole));
}

export function SocialHistory({ copy, locale, dark, open, entries, loading, failed, hasMore, onToggle, onMore, onRetry }: {
  copy: SocialHistoryCopy; locale: string; dark: boolean; open: boolean; entries: SocialHistoryEntry[];
  loading: boolean; failed: boolean; hasMore: boolean; onToggle: () => void; onMore: () => void; onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <section className="lf-rebuild lf-social-graph" data-social-audit="history" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{entries.map(entry => {
          const sentence = coopSentence(entry);
          return <li key={entry.id} data-history-action={entry.action}>
            {sentence
              ? <Copy role="body">{fill(copy[sentence], { source: entry.sourceName || copy.hidden, target: entry.targetName || copy.hidden })}</Copy>
              : <>
                <Copy role="option">{entry.sourceName || copy.hidden}</Copy>
                <Copy role="body">{copy[entry.action.slice(7) as 'follow' | 'unfollow' | 'block' | 'unblock']}</Copy>
                <Copy role="option">{entry.targetName || copy.hidden}</Copy>
              </>}
            <time dateTime={entry.createdAt} data-copy-role="data">{date.format(new Date(entry.createdAt))}</time>
          </li>;
        })}</ul>
        {!loading && entries.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
        {hasMore && <Button disabled={loading} onClick={onMore}>{copy.more}</Button>}
      </>}
    </>}
  </section>;
}
