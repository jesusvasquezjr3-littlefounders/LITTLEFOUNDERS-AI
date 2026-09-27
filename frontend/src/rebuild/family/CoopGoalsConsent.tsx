import { useId } from 'react';
import type enFamily from '../../i18n/en-US/rebuild-family.json';
import { Button, Card, InlineNotice, LoadingState, Switch } from '../design/controls';
import './console/console.css';

/*
 * L-04 (owner decision OD-27 (1)): the verified Tutor's opt-in for goals
 * together, for a parent-created child aged 13 to 17. Off by default (E.10's
 * pattern for a peer feature: a guardian opt-in per child). The card says
 * what it allows (lesson goals with up to 4 mutual connections) and what it
 * never allows (chat, scores, rankings); turning it off takes the child out of
 * every goal at once, and the card says so before it happens. For a child
 * whose birth date does not prove 13 to 17 the card only says why it is not
 * offered. Core decides every rule again; this is presentation only.
 */

export type CoopGoalsConsentCopy = typeof enFamily.familyCoopGoals;
export type CoopConsentView =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; ageFits: boolean; enabled: boolean; openGoals: number };

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export function CoopGoalsConsent({ copy, name, view, saving, saveFailed, onChange, onRetry }: {
  copy: CoopGoalsConsentCopy; name: string; view: CoopConsentView; saving: boolean; saveFailed: boolean;
  onChange: (enabled: boolean) => void; onRetry: () => void;
}) {
  const noteId = useId();
  return <Card heading={copy.title} headingLevel={3} as="section">
    <div className="lf-coop-consent" data-console-part="coop-goals">
      {view.kind === 'loading' ? <LoadingState label={copy.loading} lines={2} />
        : view.kind === 'failed' ? <>
          <InlineNotice tone="error">{copy.failed}</InlineNotice>
          <div className="lf-actions"><Button onClick={onRetry}>{copy.retry}</Button></div>
        </>
          : !view.ageFits && !view.enabled ? <p data-copy-role="body">{copy.notTeen}</p>
            : <>
              <p data-copy-role="body">{fill(copy.body, { name })}</p>
              <p data-copy-role="body">{copy.rules}</p>
              <Switch label={copy.label} checked={view.enabled} pending={saving} stateLabels={{ on: copy.on, off: copy.off }}
                help={view.enabled ? fill(copy.offNote, { name }) : undefined} onCheckedChange={onChange} />
              {view.enabled && view.openGoals > 0 ? <p id={noteId} data-copy-role="body">{fill(copy.active, { name, count: view.openGoals })}</p> : null}
              {saveFailed ? <InlineNotice tone="error" live>{copy.saveFailed}</InlineNotice> : null}
            </>}
    </div>
  </Card>;
}
