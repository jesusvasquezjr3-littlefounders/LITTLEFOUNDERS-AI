import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MorphIcon } from 'morphicons/react';
import { ArrowLeft, X } from 'lucide';
import { Button } from '@/components/ui/button';
import { Field, FieldControl, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { nextPlace } from '@/features/app/nextPlace';
import { useSession } from '@/features/auth/session';
import { body, heading } from '@/features/landing/type';
import { StepArt } from '@/features/onboarding/StepArt';
import { furthest, sceneFor, stepsFor, type StepId } from '@/features/onboarding/steps';
import { ADULT_AGE, isReservedName, MAX_AGE, MENTORS, MIN_AGE, NAME, onboarding, useOnboardingAnswers, type Answers, type Mentor, type Path } from '@/features/onboarding/store';

/** The words of one screen. Which of the optional ones exist depends on the step. */
type Screen = { title: string; text: string; button?: string; now?: string; later?: string; done?: string };

import { useCoreCopy, useOnboardingCopy } from '@/i18n/useCopy';
import { ENTER } from '@/lib/motionPresets';
import { cn } from '@/lib/utils';

/*
 * The onboarding: what a person walks through after pressing "I just want to learn" or "I'm a
 * parent" on the home page, before any account exists (D-021). One idea per screen: the mentors
 * greet, ask the age and a name, the person chooses a mentor, the mentor shows what the product
 * is, and the last screen offers to create the account now or later. Design and rules:
 * docs/features/F-003-onboarding.md.
 *
 * It is a page of its own, outside the site's shell, so nothing competes with the one thing each
 * screen asks. Every screen has one primary button, disabled until there is an answer (D-020), a
 * way back, and a bar that says how far along the person is.
 *
 * The answers are kept in this browser only (store.ts) and are never put in the address: the
 * address carries the name of the step and nothing else.
 */
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');

/** The bar moves fastest at the start, which is what keeps people going (docs/design/RESEARCH-FOUNDATION.md). */
const shownProgress = (done: number, total: number) => 1 - (1 - done / total) ** 1.6;

export function Onboarding({ path }: { path: Path }) {
  const navigate = useNavigate();
  const stored = useOnboardingAnswers();
  const answers = stored && stored.path === path ? stored : null;
  const wasFinished = useRef(false);
  const { status, account } = useSession();
  // an account that already has its name or its mentor has nothing to answer here
  const isSettled = status === 'signedIn' && account !== null && !account.needsAge && (account.mentor !== null || account.displayName !== '');

  if (answers?.finished) wasFinished.current = true;

  /*
   * A visit starts the answers for this path, or picks up the ones this browser already has. When
   * they disappear after the last step, the new account has taken them (Handoff.tsx) and the
   * onboarding is over: the person goes to their home in the application (D-051).
   */
  useEffect(() => {
    if (isSettled) return void navigate(nextPlace.path(), { replace: true });

    if (answers) return;

    if (wasFinished.current) void navigate(status === 'signedIn' ? nextPlace.path() : '/', { replace: true });
    else onboarding.begin(path);
  }, [answers, path, navigate, status, isSettled]);

  return answers && !isSettled ? <Walk answers={answers} /> : null;
}

function Walk({ answers }: { answers: Answers }) {
  const copy = useOnboardingCopy();
  const brand = useCoreCopy().appShell.brand;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const authDialog = useAuthDialog();
  const titleId = useId();
  // An account that already said its age is not asked again. All this page needs from the age is
  // whether the person is under 18, and the account's type says that.
  const known = session.status === 'signedIn' && session.account && !session.account.needsAge ? session.account.type : null;
  const age = answers.age ?? (known === 'universal' ? ADULT_AGE : known === 'child' ? ADULT_AGE - 1 : undefined);
  const steps = stepsFor(answers.path, age).filter((candidate) => candidate !== 'age' || known === null);
  const allowed = furthest(steps, answers);
  const asked = steps.findIndex((candidate) => candidate === params.get('step'));
  // No step in the address: a first visit starts at the beginning, a return picks up where it stopped.
  const index = asked === -1 ? (answers.age === undefined && answers.name === undefined ? 0 : allowed) : Math.min(asked, allowed);
  const step: StepId = steps[index] ?? 'welcome';
  const words = { name: answers.name ?? '', mentor: answers.mentor ? copy.mentors[answers.mentor].name : '' };

  useEffect(() => { document.title = `${copy.pageTitle} · ${brand}`; }, [copy.pageTitle, brand]);

  // The address always names the step that is showing, and nothing else.
  useEffect(() => {
    if (params.get('step') !== step) setParams({ step }, { replace: true });
  }, [params, step, setParams]);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const go = (to: number) => setParams({ step: steps[Math.max(0, Math.min(to, steps.length - 1))] ?? 'welcome' });
  const next = () => go(index + 1);

  const screens: Partial<Record<StepId, Screen>> = answers.path === 'parent' ? copy.parent : copy.learner;
  const screen: Screen = screens[step] ?? copy.learner.welcome;
  const scene = sceneFor(step, answers.mentor);
  const alt = scene.startsWith('group') ? copy.artGroup : fill(copy.artMentor, words);

  let content: ReactNode;

  if (step === 'age') {
    content = <AgeForm key="age" initial={answers.age} onAnswer={(age) => { onboarding.answer({ age }); next(); }} />;
  } else if (step === 'name') {
    content = <NameForm key="name" initial={answers.name} onAnswer={(name) => { onboarding.answer({ name }); next(); }} />;
  } else if (step === 'mentor') {
    content = <MentorForm key="mentor" initial={answers.mentor} onAnswer={(mentor) => { onboarding.answer({ mentor }); next(); }} />;
  } else if (step === 'minor') {
    // Under 18 on the parent path: the learner's path starts with the answers already given (store.ts, `begin`).
    content = <Actions><Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => { void navigate('/onboarding?step=name', { replace: true }); }}>{screen.button}</Button></Actions>;
  } else if (step === 'join') {
    // No account is needed to come in (D-021): the person goes on as a guest, with what they chose kept on this device.
    const later = () => { onboarding.answer({ finished: true }); void navigate(nextPlace.path()); };

    content = session.status === 'signedIn'
      ? <Actions><Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => onboarding.answer({ finished: true })}>{screen.done}</Button></Actions>
      : <Actions>
        <Button type="button" size="lg" className="w-full sm:w-auto" onPointerEnter={authDialog.preload} onFocus={authDialog.preload}
          onClick={() => { onboarding.answer({ finished: true }); authDialog.open('join'); }}>{screen.now}</Button>
        <Button type="button" variant="ghost" size="lg" className="w-full sm:w-auto" onClick={later}>{screen.later}</Button>
      </Actions>;
  } else {
    content = <Actions><Button type="button" size="lg" className="w-full sm:w-auto" onClick={next}>{screen.button ?? copy.continue}</Button></Actions>;
  }

  return <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
    <header className="mx-auto flex h-[72px] w-full max-w-[1240px] shrink-0 items-center gap-3 px-4 sm:px-6">
      <Button type="button" variant="outline" data-icon-only className={cn('size-12 min-w-0 shrink-0 p-0', index === 0 && 'invisible')} aria-label={copy.back} title={copy.back}
        disabled={index === 0} onClick={() => go(index - 1)}>
        <MorphIcon icon={ArrowLeft} size={20} strokeWidth={2.4} reducedMotion="user" aria-hidden="true" />
      </Button>
      <div role="progressbar" aria-label={fill(copy.progress, { step: String(index + 1), total: String(steps.length) })} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--v-beige)]">
        <motion.div className="h-full rounded-full bg-[var(--primary)]" initial={false} animate={{ width: `${Math.round(shownProgress(index + 1, steps.length) * 100)}%` }} transition={{ duration: 0.4, ease: ENTER }} />
      </div>
      <Button asChild variant="outline" data-icon-only className="size-12 min-w-0 shrink-0 p-0">
        <Link to="/" aria-label={copy.close} title={copy.close}><MorphIcon icon={X} size={20} strokeWidth={2.4} reducedMotion="user" aria-hidden="true" /></Link>
      </Button>
    </header>

    {/* On phones the composition is on top and the words under it, from the top of the page. From 1024 px they sit
        side by side, the composition the larger of the two, and the pair is centered in the height that is left. */}
    <main aria-labelledby={titleId} className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-x-12 gap-y-4 px-4 pt-2 pb-10 sm:px-6 lg:flex-row lg:items-center lg:justify-center lg:pb-[72px]">
      <AnimatePresence mode="wait" initial={false}>
        {/* Choosing a mentor on a phone: the four cards already show the mentors, and with the group above them only two fit on the screen. */}
        <motion.div key={scene} className={cn('min-w-0 lg:w-[56%]', step === 'mentor' && 'hidden lg:block')} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: ENTER }}>
          <StepArt scene={scene} alt={alt} priority={index === 0} />
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${answers.path}-${step}`} className="grid min-w-0 justify-items-center gap-4 text-center lg:w-[44%] lg:justify-items-start lg:text-start"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: ENTER }}>
          <StepTitle id={titleId} takesFocus={step !== 'age' && step !== 'name'}>{fill(screen.title, words)}</StepTitle>
          <p className={cn(body, 'text-center lg:text-start')}>{fill(screen.text, words)}</p>
          {content}
        </motion.div>
      </AnimatePresence>
    </main>
  </div>;
}

/*
 * A screen's title. It takes the focus when its screen arrives, so a screen reader reads the new screen from its
 * title and the keyboard continues from there (WCAG 2.4.3). It does so when it is put on the page, not when the
 * step changes: the previous screen is still leaving at that moment, and focusing its title would lose the focus
 * with it. A screen with a field gives the focus to the field instead.
 */
function StepTitle({ id, takesFocus, children }: { id: string; takesFocus: boolean; children: ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (takesFocus) title.current?.focus({ preventScroll: true });
  }, [takesFocus]);

  return <h1 id={id} ref={title} tabIndex={-1} className={cn(heading, 'outline-none')}>{children}</h1>;
}

/** Where a step's buttons sit: stacked and full width on phones, in a row from 640 px. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="grid w-full max-w-sm gap-3 pt-2 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center lg:justify-start">{children}</div>;
}

function AgeForm({ initial, onAnswer }: { initial: number | undefined; onAnswer: (age: number) => void }) {
  const copy = useOnboardingCopy();
  const [value, setValue] = useState(initial === undefined ? '' : String(initial));
  const age = /^\d{1,4}$/.test(value) ? Number(value) : null;
  const inRange = age !== null && age >= MIN_AGE && age <= MAX_AGE;
  // An age nobody has gets a friendly sentence, not an error: the person is still choosing what to type.
  const nudge = age === null ? null : age > MAX_AGE ? fill(copy.age.tooOld, { age: String(age) }) : age < MIN_AGE ? copy.age.tooYoung : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (age !== null && inRange) onAnswer(age);
  };

  return <form className="grid w-full max-w-sm gap-4" noValidate onSubmit={submit}>
    <Field className="text-start">
      <FieldLabel>{copy.age.label}</FieldLabel>
      <FieldControl>
        <Input autoFocus type="text" inputMode="numeric" autoComplete="off" maxLength={4} value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))} />
      </FieldControl>
      {nudge ? <FieldDescription role="status">{nudge}</FieldDescription> : null}
    </Field>
    <Button type="submit" size="lg" fullWidth disabled={!inRange}>{copy.continue}</Button>
  </form>;
}

function NameForm({ initial, onAnswer }: { initial: string | undefined; onAnswer: (name: string) => void }) {
  const copy = useOnboardingCopy();
  const [value, setValue] = useState(initial ?? '');
  const name = value.trim().replace(/\s+/g, ' ');
  const isWritten = NAME.test(name);
  const isValid = isWritten && !isReservedName(name);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (isValid) onAnswer(name);
  };

  return <form className="grid w-full max-w-sm gap-4" noValidate onSubmit={submit}>
    <Field className="text-start">
      <FieldLabel>{copy.name.label}</FieldLabel>
      <FieldControl>
        <Input autoFocus type="text" autoComplete="given-name" autoCapitalize="words" spellCheck={false} maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} />
      </FieldControl>
      {name.length > 0 && !isValid ? <FieldDescription role="status">{isWritten ? copy.name.notAllowed : copy.name.invalid}</FieldDescription> : null}
    </Field>
    <Button type="submit" size="lg" fullWidth disabled={!isValid}>{copy.continue}</Button>
  </form>;
}

function MentorForm({ initial, onAnswer }: { initial: Mentor | undefined; onAnswer: (mentor: Mentor) => void }) {
  const copy = useOnboardingCopy();
  const [chosen, setChosen] = useState<Mentor | undefined>(initial);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (chosen) onAnswer(chosen);
  };

  return <form className="grid w-full gap-4" noValidate onSubmit={submit}>
    <div className="grid grid-cols-2 gap-3">
      {MENTORS.map((mentor) => {
        const isChosen = chosen === mentor;

        return <button key={mentor} type="button" aria-pressed={isChosen} onClick={() => setChosen(mentor)}
          className={cn('grid min-h-[var(--ctl-xl)] min-w-0 content-start justify-items-center gap-1 rounded-[20px] bg-[var(--v-paper)] p-3 text-center outline-none transition-shadow [box-shadow:inset_0_0_0_1px_var(--v-border)] focus-visible:[box-shadow:inset_0_0_0_3px_var(--primary)]',
            isChosen && '[box-shadow:inset_0_0_0_3px_var(--primary)]')}>
          <img src={`/onboarding/stills/${mentor}-portrait.png`} alt="" width={560} height={560} loading="lazy" decoding="async" draggable={false} className="pointer-events-none size-24 object-contain sm:size-28" />
          <span className="text-lg leading-tight font-extrabold text-[var(--v-text)]">{copy.mentors[mentor].name}</span>
          <span className="text-sm leading-snug font-medium text-pretty text-[var(--v-ink-soft)]">{copy.mentors[mentor].line}</span>
        </button>;
      })}
    </div>
    <p className="text-sm leading-snug font-medium text-pretty text-[var(--v-text-3)]">{copy.aiNote}</p>
    <div className="grid w-full max-w-sm justify-self-center lg:justify-self-start">
      <Button type="submit" size="lg" fullWidth disabled={!chosen}>{copy.continue}</Button>
    </div>
  </form>;
}
