import { Button, Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';
export interface SocialHistoryEntry { id: number; action: 'social.follow' | 'social.unfollow' | 'social.block' | 'social.unblock'; sourceName: string | null; targetName: string | null; createdAt: string }
export interface SocialHistoryCopy { title: string; close: string; loading: string; failed: string; empty: string; retry: string; more: string; hidden: string; follow: string; unfollow: string; block: string; unblock: string }
export function SocialHistory({ copy, locale, dark, open, entries, loading, failed, hasMore, onToggle, onMore, onRetry }: {
  copy: SocialHistoryCopy; locale: string; dark: boolean; open: boolean; entries: SocialHistoryEntry[];
  loading: boolean; failed: boolean; hasMore: boolean; onToggle: () => void; onMore: () => void; onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <section className="lf-rebuild lf-social-graph" data-social-audit="history" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      {failed ? <><div role="alert"><Copy role="body">{copy.failed}</Copy></div><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul>{entries.map(entry => <li key={entry.id}>
          <Copy role="option">{entry.sourceName || copy.hidden}</Copy>
          <Copy role="body">{copy[entry.action.slice(7) as 'follow' | 'unfollow' | 'block' | 'unblock']}</Copy>
          <Copy role="option">{entry.targetName || copy.hidden}</Copy>
          <time dateTime={entry.createdAt}>{date.format(new Date(entry.createdAt))}</time>
        </li>)}</ul>
        {!loading && entries.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <div role="status"><Copy role="body">{copy.loading}</Copy></div>}
        {hasMore && <Button disabled={loading} onClick={onMore}>{copy.more}</Button>}
      </>}
    </>}
  </section>;
}
