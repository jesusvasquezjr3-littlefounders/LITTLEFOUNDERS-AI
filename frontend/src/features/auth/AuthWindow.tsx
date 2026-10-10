import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MorphIcon } from 'morphicons/react';
import { ArrowLeft, Mail, X } from 'lucide';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldControl, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { GoogleMark } from '@/components/icons/google';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { useSession } from '@/features/auth/session';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { ApiFailure } from '@/lib/api';
import { ENTER } from '@/lib/motionPresets';

/*
 * The window where a person signs in or creates an account. There is no sign-in page: one window,
 * opened from the topbar, the bar at the bottom of phones or by the app itself (AuthDialog.tsx,
 * which loads this file the first time the window is opened), and it walks through at most four
 * steps:
 *
 *   choose      Google, or a code by email
 *   identifier  the email (or, to sign in, a username) the code goes to
 *   code        the six digits; entering them signs the person in and, for a new email, creates the account
 *   age         once per account: the age and, under 13, the permission box (D-025, D-027)
 *
 * No step has a password. Each has one primary button, disabled until there is an answer (D-020).
 * The scene at the top is a looping video that takes at most 30 % of the window's height and sits
 * on the window's own color with faded borders. The close button comes last in the focus order.
 */
export type Mode = 'signIn' | 'signUp';

export type Step = 'choose' | 'identifier' | 'code' | 'age';

const CODE_LENGTH = 6;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USERNAME = /^[a-z0-9_]{3,20}$/;

const MIN_AGE = 6;

const MAX_AGE = 100;

const PERMISSION_UNDER = 13;

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');

export type AuthEntry = { mode: Mode; step: Step };

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where this visit to the window starts. The provider remounts the window for each visit. */
  entry: AuthEntry;
  /** What had the focus when the window was opened: it gets the focus back (WCAG 2.4.3). */
  opener: RefObject<Element | null>;
};

export default function AuthWindow({ isOpen, onOpenChange, entry, opener }: Props) {
  const copy = useCoreCopy().auth;
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>(entry.mode);
  const [step, setStep] = useState<Step>(entry.step);
  const [identifier, setIdentifier] = useState('');
  const [resendAt, setResendAt] = useState(0);

  /** After a sign-in: the age step if it is still owed, otherwise done. */
  const finish = useCallback((needsAge: boolean) => {
    if (needsAge) return setStep('age');

    onOpenChange(false);
    sileo.success({ title: copy.welcome });
  }, [copy.welcome, onOpenChange]);

  const title = step === 'age' ? copy.ageTitle : step === 'code' ? copy.codeTitle : step === 'identifier' ? (mode === 'signUp' ? copy.signUpTitle : copy.signInTitle) : copy.title;

  return <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="!w-[min(420px,calc(100%-32px))] !gap-0 overflow-hidden !p-0 text-center"
      onCloseAutoFocus={(event) => {
        const target = opener.current;

        // The button that opened it may be gone (signing in replaces it); then the browser decides.
        if (!(target instanceof HTMLElement) || !target.isConnected) return;

        event.preventDefault();
        target.focus();
      }}>
      <div className="h-[116px] w-full [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent),linear-gradient(to_bottom,black_78%,transparent)] [mask-composite:intersect]">
        <LoopVideo name="signin" className="size-full object-cover" />
      </div>
      <div className="grid gap-5 px-6 pb-6 pt-4">
        <DialogTitle className="!pt-0 text-balance">{title}</DialogTitle>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className="grid gap-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: ENTER }}>
            {step === 'choose' ? <ChooseStep
              onEmail={() => setStep('identifier')}
              onSignUp={() => { setMode('signUp'); setStep('identifier'); }}
              onGoogle={finish}
            /> : null}
            {step === 'identifier' ? <IdentifierStep
              mode={mode}
              initial={identifier}
              locale={locale}
              onBack={() => { setMode('signIn'); setStep('choose'); }}
              onSent={(value, resendAfterSeconds) => { setIdentifier(value); setResendAt(Date.now() + resendAfterSeconds * 1000); setStep('code'); }}
            /> : null}
            {step === 'code' ? <CodeStep
              identifier={identifier}
              locale={locale}
              resendAt={resendAt}
              onResent={(resendAfterSeconds) => setResendAt(Date.now() + resendAfterSeconds * 1000)}
              onBack={() => setStep('identifier')}
              onVerified={finish}
            /> : null}
            {step === 'age' ? <AgeStep onDone={() => finish(false)} /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
      <DialogClose asChild>
        <Button type="button" variant="outline" data-icon-only className="absolute end-2 top-2 size-12 min-w-0 bg-[color-mix(in_srgb,var(--v-canvas)_85%,transparent)] p-0" aria-label={copy.close} title={copy.close}>
          <MorphIcon icon={X} size={22} strokeWidth={2} reducedMotion="user" />
        </Button>
      </DialogClose>
    </DialogContent>
  </Dialog>;
}

/** The sentence a failure deserves, in the reader's language. Codes come from Core (backend/src/lib/http.ts); null is anything else that went wrong. */
function useFailureText() {
  const errors = useCoreCopy().auth.errors;

  return useCallback((failure: ApiFailure | null): string => {
    if (!failure) return errors.generic;

    if (failure.code === 'CODE_INVALID') return errors.codeInvalid;

    if (failure.code === 'TOO_MANY_ATTEMPTS') return errors.tooManyAttempts;

    if (failure.code === 'RATE_LIMITED') return errors.rateLimited;

    if (failure.code === 'EMAIL_NOT_SENT') return errors.emailNotSent;

    if (failure.code === 'BAD_REQUEST') return errors.identifier;

    if (failure.code === 'PERMISSION_REQUIRED') return errors.permissionRequired;

    return errors.generic;
  }, [errors]);
}

const lead = 'm-0 text-[length:var(--fs-body)] text-pretty text-[color:var(--v-text-2)]';

const textLink = 'font-semibold underline underline-offset-4';

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <Button type="button" variant="ghost" size="sm" className={textLink} onClick={onClick}>
    <MorphIcon icon={ArrowLeft} size={18} strokeWidth={2} reducedMotion="user" />{label}
  </Button>;
}

function ChooseStep({ onEmail, onSignUp, onGoogle }: { onEmail: () => void; onSignUp: () => void; onGoogle: (needsAge: boolean) => void }) {
  const copy = useCoreCopy().auth;
  const session = useSession();
  const [waiting, setWaiting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const google = async () => {
    setWaiting(true);
    setProblem(null);

    const result = await session.signInWithGoogle();

    setWaiting(false);

    if (result === 'ok') {
      const account = await session.reload();

      if (account) onGoogle(account.needsAge);

      return;
    }

    // A window closed without a word is not an error worth a sentence.
    if (result === 'failed') setProblem(copy.errors.googleFailed);

    if (result === 'unavailable') setProblem(copy.errors.googleUnavailable);
  };

  return <>
    <DialogDescription className="sr-only">{copy.description}</DialogDescription>
    <div className="grid gap-3">
      <Button type="button" variant="outline" fullWidth loading={waiting} onClick={() => { void google(); }}>
        <GoogleMark className="size-5 shrink-0" />{copy.google}
      </Button>
      <Button type="button" fullWidth onClick={onEmail}>
        <MorphIcon icon={Mail} size={20} strokeWidth={2} reducedMotion="user" />{copy.emailOrUsername}
      </Button>
    </div>
    <p role="status" className={`${lead} ${waiting || problem ? '' : 'sr-only'}`}>{waiting ? copy.googleWaiting : problem}</p>
    <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 text-[length:var(--fs-body)] text-[color:var(--v-text-2)]">
      {copy.newHere}
      <Button type="button" variant="ghost" size="sm" className={textLink} onClick={onSignUp}>{copy.createAccount}</Button>
    </p>
  </>;
}

function IdentifierStep({ mode, initial, locale, onBack, onSent }: { mode: Mode; initial: string; locale: string; onBack: () => void; onSent: (identifier: string, resendAfterSeconds: number) => void }) {
  const copy = useCoreCopy().auth;
  const session = useSession();
  const failureText = useFailureText();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const identifier = value.trim().toLowerCase();

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'signUp' ? !EMAIL.test(identifier) : !EMAIL.test(identifier) && !USERNAME.test(identifier)) {
      setProblem(mode === 'signUp' ? copy.errors.email : copy.errors.identifier);

      return;
    }

    setBusy(true);
    setProblem(null);

    try {
      const sent = await session.requestCode(identifier, locale);

      onSent(identifier, sent.resendAfterSeconds);
    } catch (thrown) {
      setProblem(failureText(thrown instanceof ApiFailure ? thrown : null));
      setBusy(false);
    }
  };

  return <form className="grid gap-5" noValidate onSubmit={(event) => { void submit(event); }}>
    <DialogDescription className={lead}>{mode === 'signUp' ? copy.signUpLead : copy.signInLead}</DialogDescription>
    <Field invalid={problem !== null} className="text-start">
      <FieldLabel>{mode === 'signUp' ? copy.emailLabel : copy.identifierLabel}</FieldLabel>
      <FieldControl>
        <Input
          autoFocus
          type={mode === 'signUp' ? 'email' : 'text'}
          inputMode="email"
          autoComplete={mode === 'signUp' ? 'email' : 'username'}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={value}
          onChange={(event) => { setValue(event.target.value); setProblem(null); }}
        />
      </FieldControl>
      {problem ? <FieldError>{problem}</FieldError> : null}
    </Field>
    <Button type="submit" fullWidth disabled={identifier.length === 0} loading={busy}>{copy.sendCode}</Button>
    <div className="flex justify-center"><BackButton onClick={onBack} label={copy.back} /></div>
  </form>;
}

function CodeStep({ identifier, locale, resendAt, onResent, onBack, onVerified }: {
  identifier: string;
  locale: string;
  resendAt: number;
  onResent: (resendAfterSeconds: number) => void;
  onBack: () => void;
  onVerified: (needsAge: boolean) => void;
}) {
  const copy = useCoreCopy().auth;
  const session = useSession();
  const failureText = useFailureText();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return;

    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(tick);
  }, [resendAt]);

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;

    setBusy(true);
    setProblem(null);
    setNotice(null);

    try {
      onVerified((await session.verifyCode(identifier, value)).needsAge);
    } catch (thrown) {
      setProblem(failureText(thrown instanceof ApiFailure ? thrown : null));
      setCode('');
      setBusy(false);
      // Back to the field, ready for another try: the person should not have to find it again.
      window.requestAnimationFrame(() => input.current?.focus());
    }
  };

  const resend = async () => {
    setProblem(null);
    setNotice(null);

    try {
      onResent((await session.requestCode(identifier, locale)).resendAfterSeconds);
      setNow(Date.now());
      setCode('');
      setNotice(copy.resent);
    } catch (thrown) {
      setProblem(failureText(thrown instanceof ApiFailure ? thrown : null));
    }
  };

  return <form className="grid gap-5" noValidate onSubmit={(event) => { event.preventDefault(); void verify(code); }}>
    <DialogDescription className={`${lead} [overflow-wrap:anywhere]`}>
      {fill(identifier.includes('@') ? copy.codeLeadEmail : copy.codeLeadUsername, { identifier })}
    </DialogDescription>
    <div className="grid justify-items-center gap-2">
      <InputOTP
        ref={input}
        autoFocus
        maxLength={CODE_LENGTH}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={copy.codeLabel}
        aria-describedby={hintId}
        aria-invalid={problem !== null}
        readOnly={busy}
        value={code}
        onChange={(next) => { setCode(next); setProblem(null); }}
        onComplete={(next: string) => { void verify(next); }}
        containerClassName="w-full justify-center"
      >
        <InputOTPGroup className="w-full justify-center">
          {Array.from({ length: CODE_LENGTH }, (_slot, index) => <InputOTPSlot key={index} index={index} className="min-w-0 max-w-12 flex-1" />)}
        </InputOTPGroup>
      </InputOTP>
      <p id={hintId} className="m-0 text-[length:var(--fs-meta)] text-[color:var(--v-text-2)]">{copy.codeHint}</p>
      <p role="alert" className={`m-0 text-[length:var(--fs-body)] font-medium text-pretty ${problem ? '' : 'sr-only'}`}>{problem}</p>
      <p role="status" className={`m-0 text-[length:var(--fs-body)] text-pretty ${notice ? '' : 'sr-only'}`}>{notice}</p>
    </div>
    <Button type="submit" fullWidth disabled={code.length !== CODE_LENGTH} loading={busy}>{copy.verify}</Button>
    <div className="grid justify-items-center gap-1">
      {waitSeconds > 0
        ? <p className="m-0 text-[length:var(--fs-meta)] text-[color:var(--v-text-2)]">{fill(copy.resendIn, { seconds: String(waitSeconds) })}</p>
        : <Button type="button" variant="ghost" size="sm" className={textLink} onClick={() => { void resend(); }}>{copy.resend}</Button>}
      <BackButton onClick={onBack} label={copy.changeIdentifier} />
    </div>
  </form>;
}

function AgeStep({ onDone }: { onDone: () => void }) {
  const copy = useCoreCopy().auth;
  const session = useSession();
  const failureText = useFailureText();
  const [value, setValue] = useState('');
  const [permission, setPermission] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const age = /^\d{1,4}$/.test(value) ? Number(value) : null;
  const inRange = age !== null && age >= MIN_AGE && age <= MAX_AGE;
  const needsPermission = inRange && age < PERMISSION_UNDER;
  // An age nobody has gets a friendly nudge, not an error: the person is still choosing what to type.
  const nudge = age === null ? null : age > MAX_AGE ? fill(copy.ageTooOld, { age: String(age) }) : age < MIN_AGE ? copy.ageTooYoung : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (age === null || !inRange || (needsPermission && !permission)) return;

    setBusy(true);
    setProblem(null);

    try {
      await session.declareAge(age, needsPermission && permission);
      onDone();
    } catch (thrown) {
      setProblem(failureText(thrown instanceof ApiFailure ? thrown : null));
      setBusy(false);
    }
  };

  return <form className="grid gap-5" noValidate onSubmit={(event) => { void submit(event); }}>
    <DialogDescription className={lead}>{copy.ageLead}</DialogDescription>
    <Field invalid={problem !== null} className="text-start">
      <FieldLabel>{copy.ageLabel}</FieldLabel>
      <FieldControl>
        <Input autoFocus type="text" inputMode="numeric" autoComplete="off" maxLength={4} value={value}
          onChange={(event) => { setValue(event.target.value.replace(/\D/g, '')); setProblem(null); }} />
      </FieldControl>
      {nudge ? <FieldDescription role="status">{nudge}</FieldDescription> : null}
      {problem ? <FieldError>{problem}</FieldError> : null}
    </Field>
    {needsPermission ? <Checkbox checked={permission} onCheckedChange={(next) => setPermission(next === true)} className="min-h-12 text-start">
      <span className="min-w-0 text-pretty">{copy.permissionLabel}</span>
    </Checkbox> : null}
    <Button type="submit" fullWidth disabled={!inRange || (needsPermission && !permission)} loading={busy}>{copy.ageContinue}</Button>
  </form>;
}
