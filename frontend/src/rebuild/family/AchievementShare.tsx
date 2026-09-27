import { useId } from 'react';
import { Button, Copy, InlineNotice, type NoticeTone } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './achievementShare.css';

/*
 * The guardian's "Share achievement" action (Product 10 F.1 per OD-20, F.3).
 *
 * The action produces a PICTURE the parent sends themselves; no link is made.
 * F.3's point-of-action disclosure sits directly under the button, un-buried
 * and linked to it with aria-describedby, and names the real mechanics of
 * the image flow: what the picture shows (first name and achievement, with
 * the LittleFounders name on it), that no link exists, and that a sent
 * picture stays with whoever receives it. Mentor-voiced, never a legal
 * warning (Law 2), and inside the Copy Budget in all three locales.
 *
 * Presentational only: the caller owns transport (achievementImage.ts) and
 * passes the status. No celebration here — sharing is not on the OD-7
 * milestone list; the earned badge was the milestone.
 */

export type AchievementShareStatus = 'idle' | 'preparing' | 'shared' | 'downloaded' | 'cancelled' | 'failed';

export interface AchievementShareCopy {
  share: string;
  shareGoal: string;
  preparing: string;
  shared: string;
  downloaded: string;
  failed: string;
  disclosure: string;
  keepNote: string;
}

export function AchievementShare({ copy, locale, dark, variant = 'achievement', status, onShare }: {
  copy: AchievementShareCopy;
  locale: string;
  dark: boolean;
  variant?: 'achievement' | 'goal';
  status: AchievementShareStatus;
  onShare: () => void;
}) {
  const disclosureId = useId();
  const label = variant === 'goal' ? copy.shareGoal : copy.share;
  const notice = status === 'preparing' ? copy.preparing
    : status === 'shared' ? copy.shared
      : status === 'downloaded' ? copy.downloaded
        : null;
  const tone: NoticeTone = status === 'preparing' ? 'info' : 'success';
  return <section className="lf-rebuild lf-achievement-share" data-share-audit="achievement" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={label}>
    <Button variant="berry" aria-describedby={disclosureId} pending={status === 'preparing'} onClick={onShare}>{label}</Button>
    <div id={disclosureId} className="lf-achievement-share-disclosure">
      <Copy role="body">{copy.disclosure}</Copy>
      <Copy role="body">{copy.keepNote}</Copy>
    </div>
    {/* The status region stays mounted so each state is announced once; a failure is its own alert. */}
    <div className="lf-achievement-share-feedback">
      <div role="status">{notice ? <InlineNotice tone={tone}>{notice}</InlineNotice> : null}</div>
      {status === 'failed' ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
    </div>
  </section>;
}
