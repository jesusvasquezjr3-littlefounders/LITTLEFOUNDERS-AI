import { DestructiveAction } from '../design/controls';
import { ReportDialog, type ReportCategory, type ReportCopy } from './ReportDialog';
import type enFamily from '../../i18n/en-US/rebuild-family.json';

/*
 * E.1/E.3/E.13 (GAP-FIX-R3 social): what the verified Tutor can do about one
 * account connected to their child, on the Family social list and on a
 * safety notice. Ending asks first (the consequence is stated: a new follow
 * needs the Tutor's approval again) and is offered only where Core says it
 * applies (a guardian-tier child with a current connection); reporting uses
 * the same bounded dialog as a profile. Copy-only, no transport.
 */

export type ConnectionActionsCopy = typeof enFamily.socialConnectionActions;

export interface ConnectionActionHandlers {
  copy: ConnectionActionsCopy;
  reportCopy: ReportCopy;
  /** The account whose action is running; every row's actions wait for it. */
  busyId: string | null;
  onEnd: (userId: string) => Promise<void>;
  onReport: (userId: string, category: ReportCategory, note: string | null) => Promise<boolean>;
}

export function ConnectionActions({ actions, userId, name, canEnd }: {
  actions: ConnectionActionHandlers; userId: string; name: string; canEnd: boolean;
}) {
  const { copy } = actions;
  return <div className="lf-social-request-actions" role="group" aria-label={name} data-social-actions={userId}>
    {canEnd ? <DestructiveAction label={copy.endAction} pending={actions.busyId === userId}
      confirm={{ heading: copy.endHeading.replace('{name}', name), consequence: copy.endConsequence,
        keepLabel: copy.endKeep, confirmLabel: copy.endConfirm, pendingLabel: copy.endPending }}
      onConfirm={() => actions.onEnd(userId)} /> : null}
    <ReportDialog copy={actions.reportCopy} triggerLabel={copy.report} onSend={(category, note) => actions.onReport(userId, category, note)} />
  </div>;
}
