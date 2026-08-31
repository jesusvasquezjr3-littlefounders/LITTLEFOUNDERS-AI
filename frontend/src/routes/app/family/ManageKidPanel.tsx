import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * MANAGING AN EXISTING CHILD: rename, rotate the passphrase, remove.
 *
 * The username is deliberately absent and says so out loud. The child's
 * `auth.users` address is DERIVED from their handle, so renaming it here alone
 * would strand the account at sign-in - Core refuses it too, and this panel
 * explains the refusal rather than hiding a field and letting a parent wonder.
 *
 * REMOVAL IS A HARD DELETE and the panel is shaped to make that unmissable: the
 * warning names what goes (progress, streak, conversations), and the button
 * stays disabled until the parent types the child's username. That is the
 * pattern GitHub uses to delete a repository, for the same reason - a
 * destructive action a person can reach by muscle memory is one they will
 * eventually reach by accident. The cascade is the point, not a side effect:
 * erasing a minor's record when their guardian asks is the obligation.
 */

type Mode = 'closed' | 'menu' | 'rename' | 'rotate' | 'remove';

export function ManageKidPanel({
  kid,
  onRenamed,
  onRemoved,
}: {
  kid: { userId: string; displayName: string | null; username: string | null };
  onRenamed: (userId: string, displayName: string) => void;
  onRemoved: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { getToken } = useAuth();

  const [mode, setMode] = useState<Mode>('closed');
  const [displayName, setDisplayName] = useState(kid.displayName ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [rotated, setRotated] = useState(false);

  const label = kid.displayName ?? kid.username ?? '';

  function close() {
    setMode('closed');
    setPassphrase('');
    setConfirm('');
    setErrorCode(null);
    setRotated(false);
  }

  async function run<T>(path: string, init: Parameters<typeof api>[1]): Promise<T | null> {
    setBusy(true);
    setErrorCode(null);
    const token = await getToken();
    const { data, error } = await api<T>(path, { ...init, token });
    setBusy(false);
    if (error) {
      setErrorCode(error.code);
      return null;
    }
    return data;
  }

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (name.length === 0) return;
    const done = await run(`/family/kids/${kid.userId}`, { method: 'PATCH', body: { displayName: name } });
    if (!done) return;
    onRenamed(kid.userId, name);
    close();
  }

  async function submitRotate(e: FormEvent) {
    e.preventDefault();
    if (passphrase.length < 8) return;
    const done = await run(`/family/kids/${kid.userId}/passphrase`, { method: 'POST', body: { passphrase } });
    if (!done) return;
    setPassphrase('');
    setRotated(true);
  }

  async function submitRemove() {
    // A missing username can NEVER be "confirmed" by any input, including a
    // blank one - see the comment on the disabled check below for why this
    // is a structural guard rather than a string comparison against `''`.
    if (!kid.username) return;
    if (confirm.trim().toLowerCase() !== kid.username) return;
    const done = await run(`/family/kids/${kid.userId}`, { method: 'DELETE' });
    if (!done) return;
    onRemoved(kid.userId);
  }

  if (mode === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setMode('menu')}
        className="lf-caption flex min-h-11 w-full items-center gap-2 border-t border-outline/50 px-4 py-2.5 font-bold text-content-muted transition-[background-color] duration-150 hover:bg-surface-sunken/50 hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="tune" className="text-[18px]" aria-hidden />
        {t('family.manageKid.manage')}
      </button>
    );
  }

  return (
    <div className="border-t border-outline/50 px-4 py-4">
      {errorCode && <ErrorBanner code={errorCode} />}

      {mode === 'menu' && (
        <div className="flex flex-col gap-2">
          {(
            [
              ['rename', 'edit', 'rename'],
              ['rotate', 'key', 'rotate'],
              ['remove', 'delete', 'remove'],
            ] as const
          ).map(([next, icon, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(next)}
              className={`lf-body flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left transition-[background-color] duration-150 hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                key === 'remove' ? 'text-error-strong' : 'text-content'
              }`}
            >
              <Icon name={icon} className="text-[18px]" aria-hidden />
              {t(`family.manageKid.${key}`)}
            </button>
          ))}
          <Button variant="secondary" className="mt-1 self-start" onClick={close}>
            {t('family.manageKid.cancel')}
          </Button>
        </div>
      )}

      {mode === 'rename' && (
        <form onSubmit={(e) => void submitRename(e)} noValidate className="flex flex-col gap-4">
          <Field
            label={t('family.addKid.displayName')}
            hint={t('family.manageKid.usernameFixed')}
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || displayName.trim().length === 0}>
              {t('family.manageKid.renameCta')}
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              {t('family.manageKid.cancel')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'rotate' && (
        <form onSubmit={(e) => void submitRotate(e)} noValidate className="flex flex-col gap-4">
          {rotated ? (
            <p className="lf-body text-success-strong">{t('family.manageKid.rotateDone')}</p>
          ) : (
            <Field
              label={t('family.addKid.passphrase')}
              hint={t('family.addKid.passphraseHint')}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          )}
          <div className="flex gap-3">
            {!rotated && (
              <Button type="submit" disabled={busy || passphrase.length < 8}>
                {t('family.manageKid.rotateCta')}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={close}>
              {rotated ? t('family.addKid.doneCta') : t('family.manageKid.cancel')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'remove' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md bg-error-soft px-4 py-3">
            <Icon name="warning" className="mt-0.5 shrink-0 text-error-strong" />
            <p className="lf-caption text-content">{t('family.manageKid.removeWarning', { name: label })}</p>
          </div>
          {/* Typing the handle is the friction. A destructive action a person
              can reach by muscle memory is one they eventually reach by
              accident. `profiles.username` has no NOT NULL constraint
              (database/migrations/0005_profile_identity.sql), so a kid row
              can genuinely reach this screen with `username === null` - a
              real orphan left behind by a mid-creation failure, not just a
              hand-edited row. `?? ''` used to make that state MATCH a blank,
              untouched field, which enabled the Remove button with zero
              characters typed. There is no username to type in that case, so
              the gate does not degrade to a weaker phrase - it refuses the
              whole action and says why, structurally rather than by string
              comparison against `null`. */}
          {kid.username ? (
            <Field
              label={t('family.manageKid.removeConfirm', { username: `@${kid.username}` })}
              autoCapitalize="none"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
              <Icon name="info" className="mt-0.5 shrink-0 text-content-muted" aria-hidden />
              <p className="lf-caption text-content-muted">{t('family.manageKid.removeBlocked')}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              // `danger`, from the Action Color Contract, not a hand-rolled
              // background: the variant is chosen by what the action DOES.
              variant="danger"
              disabled={busy || !kid.username || confirm.trim().toLowerCase() !== kid.username}
              onClick={() => void submitRemove()}
            >
              {t('family.manageKid.removeCta')}
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              {t('family.manageKid.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
