import { useId } from 'react';
import { Button, Copy, InlineNotice, LoadingState, SegmentedControl } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialGraph.css';

export interface SocialGraphCopy {
  title: string; followers: string; following: string; loading: string; empty: string;
  failed: string; retry: string; more: string; close: string;
}
export interface SocialMember { userId: string; displayName: string; username: string | null }
export function SocialGraph({ copy, locale, dark, open, direction, users, loading, failed, hasMore, onOpen, onClose, onDirection, onMore, onRetry }: {
  copy: SocialGraphCopy; locale: string; dark: boolean; open: boolean; direction: 'followers' | 'following';
  users: SocialMember[]; loading: boolean; failed: boolean; hasMore: boolean;
  onOpen: () => void; onClose: () => void; onDirection: (direction: 'followers' | 'following') => void;
  onMore: () => void; onRetry: () => void;
}) {
  const name = useId();
  return <section className="lf-rebuild lf-social-graph" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title}>
    <Button aria-expanded={open} onClick={open ? onClose : onOpen}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.title}</Copy>
      <SegmentedControl legend={copy.title} legendHidden name={`${name}-direction`} value={direction}
        onValueChange={onDirection} options={(['followers', 'following'] as const).map(value => ({ value, label: copy[value] }))} />
      {failed ? <><InlineNotice tone="error" live>{copy.failed}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button></> : <>
        <ul aria-label={copy[direction]}>{users.map(user => <li key={user.userId}>
          <Copy role="option">{user.displayName || user.username}</Copy>
          {user.username && <Copy role="body">@{user.username}</Copy>}
        </li>)}</ul>
        {!loading && users.length === 0 && <Copy role="body">{copy.empty}</Copy>}
        {loading && <LoadingState label={copy.loading} lines={2} />}
        {hasMore && <Button disabled={loading} onClick={onMore}>{copy.more}</Button>}
      </>}
    </>}
  </section>;
}
