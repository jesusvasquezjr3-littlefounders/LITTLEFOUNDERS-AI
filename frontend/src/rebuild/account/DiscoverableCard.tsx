import { Card, ConfirmDialog, Copy, InlineNotice, Switch } from '../design/controls';

/*
 * P3, a 16- or 17-year-old's choice to be found (OD-27 (2), S-03; Product 10 E.8).
 *
 * Private stays the default for every teen. Core offers the choice
 * (`social.discoverable.canChoose`) only to a teen whose age evidence proves
 * 16 and whose profile is not flagged (E.13); this card is shown only then,
 * or while the choice is on (turning it off always works). Turning it on
 * widens who can see a minor, so it asks first and states the consequence;
 * turning it off is one press. What does not change is said on the card:
 * people still ask before they follow (the teen decides, E.8), and nobody can
 * write to them (E.10). Copy-only, no transport: the route owns the data plane.
 *
 * OD-9 section 4.2 (GAP-FIX-R3): for a migrated teen, being discoverable is a
 * data practice a Tutor must consent to first. Core names that reason
 * (`reason: 'consentRequired'`) only when it is the one thing missing; the
 * card then shows, without a switch, that a Tutor must allow it first.
 */

export interface DiscoverableCopy {
  title: string; privateBody: string; onBody: string; rules: string; label: string; on: string; off: string;
  confirmTitle: string; confirmBody: string; confirmKeep: string; confirmYes: string;
  saving: string; saved: string; failed: string; offline: string; notEligible: string; consentRequired: string;
}

export type DiscoverableStatus = 'saved' | 'failed' | 'offline' | 'notEligible' | 'consentRequired' | null;

/** Why an otherwise eligible teen is not offered the choice (OD-9 4.2). */
export type DiscoverableReason = 'consentRequired' | null;

export interface DiscoverableView {
  enabled: boolean; canChoose: boolean; reason: DiscoverableReason; confirming: boolean; saving: boolean; status: DiscoverableStatus;
}

/** Shown only where Core offers the choice, while it is on, or where a Tutor's consent is the one thing missing. */
export function discoverableVisible(state: { enabled: boolean; canChoose: boolean; reason: DiscoverableReason } | null): boolean {
  return !!state && (state.canChoose || state.enabled || state.reason === 'consentRequired');
}

export function DiscoverableCard({ copy, view, onToggle, onConfirm, onKeep }: {
  copy: DiscoverableCopy;
  view: DiscoverableView;
  /** The switch was pressed: `next` is the state the teen asked for. */
  onToggle: (next: boolean) => void;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const notice = view.status === 'saved' ? <InlineNotice tone="success">{copy.saved}</InlineNotice>
    : view.status === 'failed' ? <InlineNotice tone="error">{copy.failed}</InlineNotice>
      : view.status === 'offline' ? <InlineNotice tone="error">{copy.offline}</InlineNotice>
        : view.status === 'notEligible' ? <InlineNotice tone="info">{copy.notEligible}</InlineNotice>
          : view.status === 'consentRequired' ? <InlineNotice tone="info">{copy.consentRequired}</InlineNotice> : null;
  // The standing reason, when no switch is offered and no receipt already says it.
  const waiting = !view.canChoose && !view.enabled && view.reason === 'consentRequired' && view.status !== 'consentRequired';
  return <Card heading={copy.title}>
    <div className="lf-settings-form" data-setting="discoverable">
      <Copy role="body">{view.enabled ? copy.onBody : copy.privateBody}</Copy>
      <Copy role="body">{copy.rules}</Copy>
      {view.canChoose || view.enabled
        ? <Switch label={copy.label} checked={view.enabled} pending={view.saving} stateLabels={{ on: copy.on, off: copy.off }}
          disabled={!view.enabled && !view.canChoose} onCheckedChange={onToggle} />
        : null}
      {waiting ? <InlineNotice tone="info">{copy.consentRequired}</InlineNotice> : null}
      <div className="lf-account-live" aria-live="polite">
        {view.saving ? <InlineNotice tone="info">{copy.saving}</InlineNotice> : notice}
      </div>
    </div>
    <ConfirmDialog open={view.confirming} heading={copy.confirmTitle} consequence={copy.confirmBody} keepLabel={copy.confirmKeep}
      confirmLabel={copy.confirmYes} pendingLabel={copy.saving} pending={view.saving} onKeep={onKeep} onConfirm={onConfirm} />
  </Card>;
}
