import { useId, useState } from 'react';
import type enProfile from '../../i18n/en-US/rebuild-profile.json';
import { Button, Dialog, InlineNotice, RadioGroup, TextAreaField } from '../design/controls';

/*
 * E.3's report, on a profile (P6). Child-safe by construction: one of Core's
 * five predefined categories and an optional note capped at the 140
 * characters Core accepts. The reporter is always the session; the dialog
 * names nobody. E.10: the note is not a message to the person; the dialog
 * says only the safety team reads it. A failure keeps what was chosen and
 * typed; the route reports success only on Core's receipt.
 */

export type ReportCopy = typeof enProfile.report;
export const REPORT_CATEGORIES = ['unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export const REPORT_NOTE_MAX = 140;

export function ReportDialog({ copy, triggerLabel, onSend, disabled = false }: {
  copy: ReportCopy; triggerLabel: string; onSend: (category: ReportCategory, note: string | null) => Promise<boolean>;
  /** The trigger waits while another action on the same row is in flight. */
  disabled?: boolean;
}) {
  const name = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'reason' | 'failed' | null>(null);

  const close = () => { if (!sending) { setOpen(false); setError(null); } };
  const send = async () => {
    if (!category) { setError('reason'); return; }
    setSending(true);
    setError(null);
    const trimmed = note.trim();
    const sent = await onSend(category, trimmed === '' ? null : trimmed.slice(0, REPORT_NOTE_MAX));
    setSending(false);
    if (sent) { setOpen(false); setCategory(null); setNote(''); } else setError('failed');
  };

  return <>
    <Button aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>{triggerLabel}</Button>
    <Dialog open={open} heading={copy.title} description={copy.body} onClose={sending ? undefined : close}
      actions={<>
        <Button onClick={close} disabled={sending}>{copy.cancel}</Button>
        <Button variant="accent" pending={sending} pendingLabel={copy.sending} onClick={() => void send()}>{copy.send}</Button>
      </>}>
      <div className="lf-report-form">
        <RadioGroup legend={copy.reason} name={`${name}-category`} value={category} disabled={sending}
          error={error === 'reason' ? copy.reasonRequired : undefined}
          onValueChange={(value) => { setCategory(value); if (error === 'reason') setError(null); }}
          options={REPORT_CATEGORIES.map((value) => ({ value, label: copy.categories[value] }))} />
        <TextAreaField label={copy.note} help={copy.noteHelp} value={note} maxLength={REPORT_NOTE_MAX} disabled={sending}
          onChange={(event) => setNote(event.target.value)} />
        {error === 'failed' ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
      </div>
    </Dialog>
  </>;
}
