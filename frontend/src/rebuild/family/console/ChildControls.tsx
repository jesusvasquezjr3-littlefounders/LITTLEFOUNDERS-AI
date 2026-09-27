import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, ButtonGroup, Copy, DestructiveAction, InlineNotice, LoadingState, Switch, TextField } from '../../design/controls';
import {
  createChild, fetchMicrophone, grantMicrophone, PASSPHRASE_MIN, removeChild, renameChild, revokeMicrophone, setChildPassphrase, setInsightsConsent,
  USERNAME_PATTERN, type Child, type ConsoleTransport, type MicrophoneState,
} from './consoleApi';
import { fill, type ChildAccountCopy, type ChildConsentCopy, type ConsoleLocale } from './consoleParts';

/*
 * The Tutor's own controls for one child on the rebuilt Family console
 * (W2F.1), rebuilt from the design system (02 rule 23; they replace the
 * legacy AddKidCard, ManageKidPanel, the legacy consent switch and the legacy
 * microphone control):
 *
 *   AddChild           creates a parent-managed child: a first name, a
 *                      username and a passphrase, plus an optional birth date
 *                      for the age band; no email, surname or address (§1.9).
 *                      The confirmation repeats the username, never the
 *                      passphrase. Nothing celebrates (not an OD-7 milestone).
 *   ManageChild        rename, a new passphrase, and removal. The username
 *                      never changes (the sign-in address derives from it).
 *                      Removal is a hard delete, so the button stays disabled
 *                      until the Tutor types the child's username; a child
 *                      with no username cannot be confirmed by any input.
 *                      A removal Core holds (E.6) is said to be on hold, and
 *                      the child stays. A self-registered teen manages their
 *                      own sign-in, so none of this is offered for them.
 *   InsightsConsent    the §1.9 usage-data consent: a switch that applies at
 *                      once and keeps the server-confirmed state on failure.
 *   MicrophoneConsent  deliberately NOT a switch: allowing the microphone
 *                      shows the exact wording first and asks for a second,
 *                      deliberate press; Core stores that wording verbatim.
 *                      Turning it off is one press. While policy offers no
 *                      microphone to minors there is nothing to allow, and it
 *                      says so; a consent given earlier stays revocable.
 */

type Busy = 'idle' | 'saving';

const BIRTH_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validBirthDate(value: string): boolean {
  if (!BIRTH_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
}

const CREATE_ERRORS: Record<string, keyof ChildAccountCopy> = {
  USERNAME_IN_USE: 'usernameTaken', PROFILE_FIELD_UNSAFE: 'unsafe', KID_LIMIT_REACHED: 'limit', VALIDATION_ERROR: 'invalid',
};

/** The confirmation after a child is added: the username to sign in with, never the passphrase. */
export function ChildAdded({ copy, name, username, onDone }: { copy: ChildAccountCopy; name: string; username: string; onDone: () => void }) {
  const heading = useId();
  return <section className="lf-console-control" data-console-control="child-added" aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.doneTitle}</h2>
    <InlineNotice tone="success" live>{fill(copy.doneBody, { name, username: `@${username}` })}</InlineNotice>
    <ButtonGroup><Button onClick={onDone}>{copy.done}</Button></ButtonGroup>
  </section>;
}

export function AddChild({ copy, locale, transport, startOpen = false, onAdded, onOpenChange }: {
  copy: ChildAccountCopy;
  locale: ConsoleLocale;
  transport: ConsoleTransport;
  startOpen?: boolean;
  onAdded: (child: Child) => void;
  /** The empty family shows the open form on its own, in place of the empty state. */
  onOpenChange?: (open: boolean) => void;
}) {
  const heading = useId();
  const [open, setOpenState] = useState(startOpen);
  const setOpen = (next: boolean) => { setOpenState(next); onOpenChange?.(next); };
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState<Busy>('idle');
  const [error, setError] = useState<string | null>(null);

  // Normalised as it is typed, as Core normalises it: capitals are not a mistake.
  const handle = username.trim().toLowerCase();
  const handleInvalid = handle.length > 0 && !USERNAME_PATTERN.test(handle);
  const birthInvalid = birthDate.length > 0 && !validBirthDate(birthDate);
  const ready = name.trim().length > 0 && USERNAME_PATTERN.test(handle) && passphrase.length >= PASSPHRASE_MIN && !birthInvalid;

  function reset() { setName(''); setUsername(''); setPassphrase(''); setBirthDate(''); setError(null); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy === 'saving') return;
    setBusy('saving'); setError(null);
    const result = await createChild(transport, { displayName: name.trim(), username: handle, passphrase, birthDate: birthDate || null, locale });
    setBusy('idle');
    if (!result.ok) { setError(copy[CREATE_ERRORS[result.code] ?? 'failed']); return; }
    const created = result.data.kid;
    reset();
    setOpen(false);
    // A new child has no chores, coins or streak yet: known zeros by construction, not fetched.
    onAdded({ userId: created.userId, displayName: created.displayName ?? name.trim(), username: created.username ?? handle, analyticsConsent: false,
      pendingApprovalCount: 0, walletTotal: 0, taskStreakDays: 0, accountType: 'child', profileReview: null });
  }

  if (!open) {
    return <div className="lf-console-control lf-console-control--bare" data-console-control="add-child">
      <ButtonGroup><Button variant="brand" aria-expanded={false} onClick={() => setOpen(true)}>{copy.add}</Button></ButtonGroup>
    </div>;
  }

  return <section className="lf-console-control" data-console-control="add-child" aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.addTitle}</h2>
    <Copy role="body">{copy.privacy}</Copy>
    <form className="lf-console-form" noValidate onSubmit={(event) => void submit(event)}>
      {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
      <TextField label={copy.name} autoComplete="off" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label={copy.username} help={copy.usernameHelp} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={20} required
        value={username} onChange={(e) => setUsername(e.target.value)} error={handleInvalid ? copy.usernameInvalid : undefined} />
      <TextField type="password" label={copy.passphrase} help={copy.passphraseHelp} autoComplete="new-password" minLength={PASSPHRASE_MIN} required
        revealLabels={{ show: copy.show, hide: copy.hide }} value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
        error={passphrase.length > 0 && passphrase.length < PASSPHRASE_MIN ? copy.passphraseShort : undefined} />
      <TextField type="date" label={copy.birthDate} help={copy.birthDateHelp} value={birthDate} max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setBirthDate(e.target.value)} error={birthInvalid ? copy.invalid : undefined} />
      <ButtonGroup>
        <Button type="submit" variant="success" disabled={!ready} pending={busy === 'saving'} pendingLabel={copy.creating}>{copy.create}</Button>
        <Button onClick={() => { reset(); setOpen(false); }}>{copy.cancel}</Button>
      </ButtonGroup>
    </form>
  </section>;
}

export function ManageChild({ child, copy, transport, onRenamed, onRemoved }: {
  child: Child;
  copy: ChildAccountCopy;
  transport: ConsoleTransport;
  onRenamed: (userId: string, displayName: string) => void;
  onRemoved: (userId: string) => void;
}) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(child.displayName ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'idle' | 'name' | 'passphrase' | 'remove'>('idle');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const label = child.displayName ?? child.username ?? '';

  if (child.accountType === 'teen') {
    return <div className="lf-console-control" data-console-control="manage-child" data-self-managed="true">
      <Copy role="body">{fill(copy.teenNote, { name: label })}</Copy>
    </div>;
  }

  // Core refuses every account change for a self-registered teen (ACCOUNT_SELF_MANAGED). When the family list could not say
  // which kind of account this is (accountType null), the controls show, and that refusal is explained, never a bare failure.
  const refusal = (code: string) => code === 'ACCOUNT_SELF_MANAGED' ? fill(copy.teenNote, { name: label }) : copy.failed;

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next || busy !== 'idle') return;
    setBusy('name'); setNotice(null);
    const result = await renameChild(transport, child.userId, next);
    setBusy('idle');
    if (!result.ok) { setNotice({ tone: 'error', text: result.code === 'PROFILE_FIELD_UNSAFE' ? copy.unsafe : refusal(result.code) }); return; }
    setNotice({ tone: 'success', text: copy.nameSaved });
    onRenamed(child.userId, next);
  }

  async function savePassphrase(event: FormEvent) {
    event.preventDefault();
    if (passphrase.length < PASSPHRASE_MIN || busy !== 'idle') return;
    setBusy('passphrase'); setNotice(null);
    const result = await setChildPassphrase(transport, child.userId, passphrase);
    setBusy('idle');
    if (!result.ok) { setNotice({ tone: 'error', text: refusal(result.code) }); return; }
    setPassphrase('');
    setNotice({ tone: 'success', text: fill(copy.passphraseSaved, { name: label }) });
  }

  // No username, nothing to type: the gate refuses the whole action rather than matching a blank field.
  const confirmed = child.username !== null && confirm.trim().toLowerCase() === child.username;

  async function remove() {
    if (!confirmed || busy !== 'idle') return;
    setBusy('remove'); setNotice(null);
    const result = await removeChild(transport, child.userId);
    setBusy('idle');
    if (!result.ok) { setNotice({ tone: 'error', text: refusal(result.code) }); return; }
    if (!result.data.deleted) { setNotice({ tone: 'info', text: copy.removeHeld }); return; }
    onRemoved(child.userId);
  }

  if (!open) {
    return <div className="lf-console-control" data-console-control="manage-child">
      <ButtonGroup><Button aria-expanded={false} onClick={() => setOpen(true)}>{copy.manage}</Button></ButtonGroup>
    </div>;
  }

  return <section className="lf-console-control" data-console-control="manage-child" aria-labelledby={heading}>
    <h3 id={heading} data-copy-role="heading">{copy.manage}</h3>
    <div role="status">{notice && notice.tone !== 'error' ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}</div>
    {notice?.tone === 'error' ? <InlineNotice tone="error" live>{notice.text}</InlineNotice> : null}
    <form className="lf-console-form" noValidate onSubmit={(event) => void saveName(event)}>
      <TextField label={copy.name} help={copy.renameHelp} maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
      <ButtonGroup><Button type="submit" disabled={name.trim().length === 0 || name.trim() === child.displayName} pending={busy === 'name'}
        pendingLabel={copy.saving}>{copy.saveName}</Button></ButtonGroup>
    </form>
    <form className="lf-console-form" noValidate onSubmit={(event) => void savePassphrase(event)}>
      <TextField type="password" label={copy.newPassphrase} help={copy.passphraseHelp} autoComplete="new-password" minLength={PASSPHRASE_MIN}
        revealLabels={{ show: copy.show, hide: copy.hide }} value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
        error={passphrase.length > 0 && passphrase.length < PASSPHRASE_MIN ? copy.passphraseShort : undefined} />
      <ButtonGroup><Button type="submit" disabled={passphrase.length < PASSPHRASE_MIN} pending={busy === 'passphrase'}
        pendingLabel={copy.saving}>{copy.savePassphrase}</Button></ButtonGroup>
    </form>
    <section className="lf-console-danger" data-console-control="remove-child" aria-label={copy.remove}>
      <h4 data-copy-role="heading">{copy.remove}</h4>
      <InlineNotice tone="error">{fill(copy.removeWarning, { name: label })}</InlineNotice>
      {child.username
        ? <TextField label={fill(copy.removeConfirm, { username: child.username })} autoCapitalize="none" spellCheck={false} autoComplete="off"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        : <Copy role="body">{copy.removeBlocked}</Copy>}
      {/* Two gates: the typed username enables the action, and the design system's confirmation asks once more (02 §9.5). */}
      <ButtonGroup>
        {confirmed
          ? <DestructiveAction label={copy.removeAction} pending={busy === 'remove'} onConfirm={remove}
            confirm={{ heading: copy.remove, consequence: fill(copy.removeWarning, { name: label }), keepLabel: copy.keep, confirmLabel: copy.removeAction, pendingLabel: copy.removing }} />
          : <Button disabled>{copy.removeAction}</Button>}
      </ButtonGroup>
    </section>
    <ButtonGroup><Button onClick={() => { setOpen(false); setNotice(null); setConfirm(''); setPassphrase(''); }}>{copy.close}</Button></ButtonGroup>
  </section>;
}

export function InsightsConsent({ child, copy, transport, onChanged }: {
  child: Child;
  copy: ChildConsentCopy;
  transport: ConsoleTransport;
  onChanged: (userId: string, on: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function toggle(next: boolean) {
    if (pending) return;
    setPending(true); setFailed(false);
    const result = await setInsightsConsent(transport, child.userId, next);
    setPending(false);
    // On failure the server-confirmed state stays on screen.
    if (!result.ok) { setFailed(true); return; }
    onChanged(child.userId, result.data.analyticsConsent);
  }
  return <div className="lf-console-control" data-console-control="insights">
    <Switch label={copy.insights} help={copy.insightsHelp} checked={child.analyticsConsent} pending={pending}
      stateLabels={{ on: copy.on, off: copy.off }} onCheckedChange={(next) => void toggle(next)} />
    {failed ? <InlineNotice tone="error" live>{copy.insightsFailed}</InlineNotice> : null}
  </div>;
}

type MicLoad = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; state: MicrophoneState };

export function MicrophoneConsent({ kidId, name, copy, locale, transport }: {
  kidId: string;
  /** The child's first name, shown in the confirmation so the Tutor sees who they consent for. */
  name: string;
  copy: ChildConsentCopy;
  locale: ConsoleLocale;
  transport: ConsoleTransport;
}) {
  const heading = useId();
  const consentId = useId();
  const [load, setLoad] = useState<MicLoad>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);

  async function read() {
    const current = ++generation.current;
    const result = await fetchMicrophone(transport, kidId);
    if (current !== generation.current) return;
    // A failed re-read never erases a state already confirmed by a write.
    setLoad((previous) => result.ok ? { status: 'ready', state: result.data } : previous.status === 'ready' ? previous : { status: 'failed' });
  }

  useEffect(() => {
    setLoad({ status: 'loading' }); setConfirming(false); setFailed(false);
    void read();
    return () => { generation.current++; };
    // One read per child.
  }, [kidId]);

  async function grant() {
    setBusy(true); setFailed(false);
    // The wording shown is the wording stored: the rendered string, not a key.
    const result = await grantMicrophone(transport, kidId, copy.micConsent, locale);
    setBusy(false);
    if (!result.ok) { setFailed(true); return; }
    setConfirming(false);
    setLoad((previous) => ({ status: 'ready', state: { active: true, grantedAt: result.data.grantedAt, policy: previous.status === 'ready' ? previous.state.policy : 'allowed' } }));
    void read();
  }

  async function revoke() {
    setBusy(true); setFailed(false);
    const result = await revokeMicrophone(transport, kidId);
    setBusy(false);
    if (!result.ok) { setFailed(true); return; }
    setLoad((previous) => ({ status: 'ready', state: { active: false, grantedAt: null, policy: previous.status === 'ready' ? previous.state.policy : 'allowed' } }));
    void read();
  }

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const state = load.status === 'ready' ? load.state : null;
  const blocked = state?.policy === 'blocked';
  const status = !state ? null
    : blocked ? (state.active ? copy.micPaused : copy.micUnavailable)
      : state.active && state.grantedAt ? fill(copy.micSince, { date: date.format(new Date(state.grantedAt)) })
        : fill(copy.micOff, { name });

  return <section className="lf-console-control" data-console-control="microphone" aria-labelledby={heading} aria-busy={load.status === 'loading'}>
    <h3 id={heading} data-copy-role="heading">{copy.micTitle}</h3>
    {load.status === 'loading' ? <LoadingState label={copy.micLoading} lines={1} />
      : load.status === 'failed' ? <InlineNotice tone="error">{copy.micLoadFailed}</InlineNotice>
        : <Copy role="body">{status}</Copy>}
    {state?.active
      ? <ButtonGroup><Button disabled={busy} pending={busy} pendingLabel={copy.micSaving} onClick={() => void revoke()}>{copy.micTurnOff}</Button></ButtonGroup>
      : state && !blocked && !confirming
        ? <ButtonGroup><Button aria-expanded={false} aria-controls={consentId} onClick={() => setConfirming(true)}>{copy.micAllow}</Button></ButtonGroup>
        : null}
    {state && !state.active && !blocked && confirming ? <div id={consentId} className="lf-console-consent" data-console-consent="microphone">
      <h4 data-copy-role="heading">{fill(copy.micFor, { name })}</h4>
      {/* The wording that will be stored with the record, shown in full before it is (06 §3.3 legal). */}
      <p data-copy-role="legal">{copy.micConsent}</p>
      <ButtonGroup>
        <Button variant="success" pending={busy} pendingLabel={copy.micSaving} onClick={() => void grant()}>{copy.micConfirm}</Button>
        <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.micCancel}</Button>
      </ButtonGroup>
    </div> : null}
    {failed ? <InlineNotice tone="error" live>{copy.micFailed}</InlineNotice> : null}
  </section>;
}
