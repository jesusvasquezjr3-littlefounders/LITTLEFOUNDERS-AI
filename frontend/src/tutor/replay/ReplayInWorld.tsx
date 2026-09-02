import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import { MarkdownLite } from '@/lesson-engine/core/MarkdownLite';
import { HudPlate } from '../hud/HudPlate';
import { LessonPlate, type LessonPlateDetent } from '../hud/LessonPlate';
import { useScrollEdges } from '../hud/useScrollEdges';
import { SpeechCaption } from '../SpeechCaption';
import { TutorFace } from '../TutorFace';
import { TutorWhiteboard } from '../TutorWhiteboard';
import { useStageDock, type ReplayLayerProps } from '../stage/StageShell';
import { DemoStepsSummary } from './DemoStepsSummary';
import type { ReplayBeat } from './replayScript';

/*
 * A PAST CONVERSATION, HAPPENING AGAIN ON THE ISLAND.
 *
 * WHAT THIS REPLACED, and why the replacement is not a redesign of the same
 * thing. Replay used to be a disclosure inside a list: press "Play it again"
 * and the row expanded into stacked `<p>`s with a native `<audio controls>`
 * beside each tutor line. Every fact was on the screen and none of the SESSION
 * was — no island, no character, no camera, no emotion, no gesture, and eleven
 * separate grey browser widgets a learner had to press one at a time, in order,
 * to hear a conversation they had already had. The owner's note is the whole
 * brief: "no se ven fluidas e inmersivas como una sesion con tutor natural,
 * debe sentirse como una repeticion".
 *
 * So a replay is now a PHASE of the same stage. The same island, the same
 * character, the same light, the same shot vocabulary, and the same caption
 * over the same crown carrying the same 2D face — because /ORACLE.md §12 says
 * a replay reconstructs the session, and everything needed to do that was
 * already in the schema: a stored turn carries its text, its `emotion`, its
 * `action` and the Depot URL of the clip that was synthesized for it.
 *
 * WHAT IS HONEST ABOUT IT, deliberately and in four places, because a replay
 * that pretends to be a session is worse than a list:
 *
 *   1. THE MICROPHONE IS NOT THERE. It is the hero control of every phase where
 *      speaking is possible and it is absent from this one by decision, not by
 *      accident (`stage/micForPhase.ts` → `present: false`, the same field the
 *      goodbye uses). A learner reaching for it finds a transport instead. That
 *      is a physical statement, before any sentence.
 *   2. THE TRANSPORT STANDS WHERE THE MICROPHONE STANDS. Play, pause, back a
 *      line, forward a line, in the dock, at the bottom of the screen, in the
 *      exact rectangle the orb occupies in a live session. Nobody mistakes a
 *      play button for a way to talk.
 *   3. THE PLATE SAYS SO IN WORDS. One sentence, on the one reading surface of
 *      the phase, where a sentence is allowed to be a sentence: this is a
 *      recording, the tutor cannot hear you here, and here is how to talk to
 *      them for real.
 *   4. THE WAY OUT IS AN OFFER, NOT A REFUSAL. The chip that leaves the replay
 *      reads "Talk to <name>" and lands on the introduction, which is one press
 *      from a live conversation. The interface never says "you can't"; it says
 *      what you can do instead, in the place where you wanted to do it.
 *
 * WHERE EACH HALF OF THE CONVERSATION APPEARS, and it is a rule rather than a
 * layout. The TUTOR speaks above their own head, exactly as they do live — the
 * caption on the crown, mirrored in the 2D bubble, both channels intact,
 * because a deaf learner must get the same replay a hearing one gets and that
 * is not a nice-to-have (/ORACLE.md §1 step 4). EVERYTHING THAT IS NOT THE
 * TUTOR'S VOICE — the learner's own turns, the activities, a system note —
 * appears in the DOCK, at the bottom, which is where the learner's own words
 * came from when the session was live: they typed them into the composer that
 * stood in that rectangle, or held the orb that stood there. The geometry
 * teaches itself, and nothing has to be labelled "them" and "you".
 *
 * IT DOES NOT DRIVE THE SCENE, for the same reason no other layer does. The
 * pose, the clip and the shot are derived from the director one level up and
 * handed to the single canvas there (`TutorExperience`), so a replay ending
 * cannot take the island down with it.
 */

export type ReplayInWorldProps = ReplayLayerProps;

export function ReplayInWorld({ director, loading, error, onDone, ready }: ReplayInWorldProps) {
  const { t, i18n } = useTranslation();
  const dock = useStageDock();

  /*
   * PEEK, and the learner is the only one who may move it (/DESIGN.md → Screen
   * Recipes → Tutor: "Nothing may raise the sheet except the learner").
   *
   * The rule was written for an arriving activity in a live session and it
   * binds here for the same reason: at 375 px raising the sheet spends 45% of
   * the phone on a panel, on a route whose entire premise is that the island is
   * the page. It is also why an activity BEAT puts its prompt in the dock
   * rather than assuming the plate will be open — the beat's content has to be
   * legible wherever the learner has left the sheet, and the plate is the place
   * they go to read the whole conversation, not the place a beat is performed.
   */
  const [detent, setDetent] = useState<LessonPlateDetent>('peek');

  const publishFootprint = useCallback((px: number) => dock?.setFootprint(px), [dock]);

  const beat = director?.beat ?? null;

  /*
   * The tutor is TALKING whenever a tutor beat is running, whether or not we
   * still have the recording of it.
   *
   * This is the one place the replay deliberately does NOT mirror the live
   * session's definition. Live, `speaking` means "the clip is playing", because
   * a mouth moving over silence is a lie about what the learner can hear. Here
   * the line is being performed either way — the caption is typing, the beat is
   * timed, the character is mid-sentence — and freezing the 2D mouth on every
   * line whose audio aged out would make a silent replay look broken rather
   * than quiet. The 3D mouth stays honest by construction: `useLipSync` reads
   * the audio element, so with no clip there is nothing for it to read, and the
   * bubble is the only articulation — which is exactly the arrangement `liruf`
   * and `dina` are in on every line of every session (/TUTOR_3D.md §3.1).
   */
  const speaking = (director?.playing ?? false) && beat?.kind === 'tutor';

  const captionText = beat?.kind === 'tutor' ? beat.text : null;

  if (loading) {
    return (
      <DockRows dock={dock}>
        <HudPlate shape="plate" role="status">
          <span className="lf-body">{t('tutor.history.loading')}</span>
        </HudPlate>
        <LeaveChip label={t('tutor.replay.back')} onClick={onDone} />
      </DockRows>
    );
  }

  if (error || !director) {
    return (
      <DockRows dock={dock}>
        <HudPlate shape="plate" role="status">
          <span className="lf-body">{t('tutor.history.loadFailed')}</span>
        </HudPlate>
        <LeaveChip label={t('tutor.replay.back')} onClick={onDone} />
      </DockRows>
    );
  }

  const { script, index, playing, finished } = director;
  const total = script.beats.length;

  if (total === 0) {
    return (
      <DockRows dock={dock}>
        <HudPlate shape="plate" role="status">
          <span className="lf-body">{t('tutor.replay.empty')}</span>
        </HudPlate>
        <LeaveChip label={t('tutor.replay.back')} onClick={onDone} />
      </DockRows>
    );
  }

  const character = script.session.character;
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
    new Date(script.session.startedAt),
  );

  /*
   * THE FACE THE CAPTION CARRIES, and it is mounted only while a tutor beat is
   * running — which is the same rule the caption itself follows.
   *
   * The bubble this replaces held the LAST thing the tutor said even while the
   * beat was an activity or the learner's own turn, because a head beside an
   * empty grey bar reads as a rendering failure. A caption has no such problem:
   * when nobody is talking it is simply not there, which is the honest picture
   * of a moment when nobody is talking.
   */
  const face = {
    character,
    emotion: beat?.emotion ?? ('neutral' as const),
    action: beat?.action ?? ('idle' as const),
    actionKey: director.beatKey,
    speaking,
  };

  return (
    <>
      {ready ? (
        /*
         * THE TUTOR'S OWN VOICE, IN THE PLACE IT LIVES IN A LIVE SESSION.
         *
         * The same component, the same crown anchor, the same typewriter, the
         * same live region. `turnSeq` is the director's beat key rather than the
         * index, so a learner who presses play on the line they are already on
         * really does see it typed out again — an index would not change and the
         * caption would sit there, already finished, while the audio replayed
         * underneath it.
         */
        <SpeechCaption text={captionText} turnSeq={director.beatKey} face={face} />
      ) : (
        /*
         * NO SCENE, SO NO PROJECTION — and the tutor's words may not go with it.
         *
         * The same arrangement `ConversationView` uses, and the same reason: an
         * anchored node on a device with no usable WebGL is never positioned, so
         * mounting the caption there would drop the only `aria-live` region the
         * phase has. /ORACLE.md §12 asks for exactly this fallback in as many
         * words — "the flat list surviving as the no-WebGL fallback" — and the
         * flat list is the plate below; this is the current line above it.
         */
        captionText && (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto flex w-full max-w-[min(34rem,92vw)] flex-col items-center gap-2 px-4">
            <HudPlate shape="plate" floorClassName="gap-3">
              <TutorFace {...face} className="h-11 w-11 self-start sm:h-14 sm:w-14" />
              <span
                className="lf-speech min-w-0 flex-1 text-start"
                aria-live="polite"
                aria-atomic="true"
              >
                {captionText}
              </span>
            </HudPlate>
          </div>
        )
      )}

      <LessonPlate
        label={t('tutor.replay.plateLabel')}
        resizeLabel={t('tutor.conversation.resizePanel')}
        detent={detent}
        onDetentChange={setDetent}
        onFootprint={publishFootprint}
        onCornerHeld={dock?.setCornerPlate}
        /*
         * The resting row names the CONVERSATION rather than the screen. With
         * the sheet down on a phone this is the only place the date appears, and
         * the date is the answer to the only question a learner has while a
         * replay is starting: is this the right one.
         */
        peekLabel={t('tutor.replay.peekOpen', { date: when })}
        /*
         * THE HONEST SENTENCE REACHES A PHONE TOO.
         *
         * The plate's body is not mounted at PEEK — that is the whole point of
         * PEEK — so the paragraph below is unreachable on a phone until the
         * learner opens the sheet. A sighted learner still has the four other
         * statements the phase makes (no microphone, a play button in its
         * place, "Replay ·" on this very row, and a chip offering the live
         * conversation instead). A learner using a screen reader has none of
         * them as a sentence, so this row announces it once, politely, on
         * arrival. It is the same string; it is not a second explanation.
         */
        peekStatus={t('tutor.replay.notASession', {
          name: t(`tutor.character.${character}.name`),
          date: when,
        })}
        /*
         * NO HEADER CONTROL, unlike the live conversation's "Finish".
         *
         * There is exactly one way out of a replay and it is the chip in the
         * dock, which says what it actually offers ("Talk to Dr. Rho") rather
         * than naming the act of leaving. A second copy of it on the sheet's
         * resting row would be two controls for one intention, eleven pixels
         * apart at 375, and the one on the sheet would be the one that says
         * less.
         */
      >
        {/*
          NO 2D BUBBLE ON THIS PLATE (2026-08-22, /DESIGN.md §Lumen → *One line,
          one printing, two channels*). It printed the tutor's line a second
          time, in the same words, one screenful below the caption that was
          already carrying it. The mouth it existed for has moved INTO that
          caption (`TutorFace`), so the replay says each line exactly once and
          the plate spends its height on the recording rather than on an echo.
        */}
        {/*
          THE SENTENCE. It is on this surface and nowhere else, because this is
          the one reading surface of the phase (/DESIGN.md §Lumen) and therefore
          the one place `content-muted` survives the material's alpha. Chrome
          density is a single ink by construction, so the same sentence on a dock
          plate would have had to shout it.
        */}
        <p className="lf-body text-content-muted">
          {t('tutor.replay.notASession', { name: t(`tutor.character.${character}.name`), date: when })}
        </p>

        {/*
          SILENCE, SAID ONCE, ABOUT THE RIGHT THING.

          A whole conversation with no audio is a fact about the RECORDING and
          is stated once. A single line whose clip is gone — retention swept the
          bucket, or it was never synthesized — is a fact about THAT LINE and is
          stated while it is on. Never both: `silent` is only true when no tutor
          beat has audio at all, in which case there is no per-line news to give.
        */}
        {script.silent ? (
          <p className="lf-body text-content-muted">{t('tutor.replay.noSoundSaved')}</p>
        ) : (
          beat?.kind === 'tutor' &&
          beat.audioUrl === null && (
            <p className="lf-body text-content-muted">{t('tutor.replay.lineNoSound')}</p>
          )
        )}

        {beat?.activity && <ActivityDetail beat={beat} />}

        {/*
          THE WHITEBOARD, REPLAYED — never recomputed, exactly the values
          drawn live. Found by adversarial review, round 35 (2026-08-30,
          HIGH): a session that used the whiteboard lost it silently here;
          `beat.index` stands in for the live `seq` prop, which only needs
          to change per beat so the growth animation replays once per line
          rather than being skipped as "the same board as before".
        */}
        {beat?.whiteboard && <TutorWhiteboard board={beat.whiteboard} seq={beat.index} className="min-h-0 flex-auto" />}

        {/*
          THE TUTOR'S HANDS, REPLAYED AS A SUMMARY — never re-animated.
          Found while investigating ORACLE.md §19.5's "replaying
          `demonstrate` animations" backlog item, 2026-09-01: a session
          where the tutor moved a coin on the open money tray left no trace
          on replay at all, migration 0067 and `replayScript.ts` now carry
          the steps this far. See `DemoStepsSummary`'s own comment for why
          this stops at a plain sentence rather than re-driving the tray.
        */}
        {beat?.demonstrate && <DemoStepsSummary steps={beat.demonstrate} />}

        <ReplayTranscript
          beats={script.beats}
          current={index}
          onJump={director.jumpTo}
          label={t('tutor.replay.transcriptLabel')}
          youLabel={t('tutor.replay.you')}
          tutorLabel={t(`tutor.character.${character}.name`)}
          activityLabel={t('tutor.replay.activity')}
          noteLabel={t('tutor.replay.note')}
          jumpLabel={t('tutor.replay.jumpTo')}
        />
      </LessonPlate>

      <DockRows dock={dock}>
        {/*
          THE HALF OF THE CONVERSATION THAT IS NOT THE TUTOR'S VOICE, AND IT
          FLOATS RATHER THAN STACKING.
          ─────────────────────────────────────────────────────────────────────
          The plate itself is the design decision: the learner's own turns, the
          activities and the system notes appear in the rectangle the composer
          and the orb share in a live session, because that is where the
          learner's words came from when it was live. It is a live region,
          because the caption above the crown — which IS one — is not mounted on
          these beats, and a screen-reader learner would otherwise hear the
          tutor's half of the conversation and silence where their own answers
          were.

          THE ZERO-HEIGHT WRAPPER IS A CAMERA FIX, and it was found by looking.
          The dock publishes its rectangle on the `mic` safe-area slot and the
          composition solver aims the character into the band above it, so a row
          that appears and disappears makes the CAMERA move — and this row
          appears on every learner turn, which in a replay is every few seconds.
          Driven at 375x812 the character visibly rose and sank through the
          performance, breathing in time with whose turn it was, on a route
          whose own spec says the character's on-screen height may not change
          because a surface arrived (/ORACLE.md §9.3).

          So the row contributes NO height: a `h-0 relative` box, with the plate
          absolutely positioned out of the top of it. The dock measures the same
          rectangle from the first beat to the last, the camera holds still, and
          the plate still sits exactly where a stacked one would have.
        */}
        <div className="relative h-0 w-full">
          {(finished || (beat && beat.kind !== 'tutor')) && (
            <div className="absolute bottom-1 left-0 flex w-full justify-center">
              {finished ? (
                /*
                 * THE END IS AN OFFER, not a dead stop, and it takes the same
                 * slot rather than a row of its own — for the same reason the
                 * slot exists at all. It is mutually exclusive with the beat
                 * plate by construction: a finished performance is not
                 * mid-beat.
                 */
                <HudPlate shape="plate" className="pointer-events-none" role="status">
                  <span className="lf-body">{t('tutor.replay.ended')}</span>
                </HudPlate>
              ) : (
                beat && (
                  <HudPlate shape="plate" className="pointer-events-none w-full max-w-[min(38ch,92vw)]">
                    <span
                      className="flex w-full flex-col items-start gap-1 text-left"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <span className="lf-action">
                        {beat.kind === 'learner' ? (
                          t('tutor.replay.youSaid')
                        ) : beat.kind === 'activity' ? (
                          <ActivitySummary beat={beat} />
                        ) : (
                          t('tutor.replay.note')
                        )}
                      </span>
                      {beat.text !== '' && (
                        <span className="lf-body">
                          {beat.kind === 'activity' ? <MarkdownLite as="span" text={beat.text} /> : beat.text}
                        </span>
                      )}
                    </span>
                  </HudPlate>
                )
              )}
            </div>
          )}
        </div>

        {/*
          THE TRANSPORT, WHERE THE MICROPHONE STANDS.

          Three controls a seven-year-old already knows from every video they
          have ever watched, and a position readout a sixteen-year-old can
          navigate by. The play button is the largest thing in the dock because
          it is the one control of the phase, exactly as the orb is in the
          phases that have one — and it is round for the same reason the orb is
          round: it is an object you press, not a label you read.

          RANDOM ACCESS IS THE TRANSCRIPT, not a scrubber. A conversation of
          eighteen beats needs eighteen targets, and a scrubber that fits them
          into 343 px gives each one 19 px — under half the tap floor, on a
          control aimed at children. Every line in the log on the plate above is
          a button that plays from there, which scales to any length, is legible
          about what it jumps to, and is already the screen-reader spine.
        */}
        <div className="flex w-full flex-col items-center gap-2">
          {/*
            ONE LINE AND A RIBBON, and the line is the position rather than the
            date. Chrome density is a single ink and effectively a single size —
            the material re-renders `lf-caption` at `lf-action`'s metrics inside
            it on purpose — so a second line here would be two labels shouting
            at each other. The date belongs to the reading plate and to the
            sheet's resting row, both of which can carry a quieter voice.
          */}
          <HudPlate shape="plate" className="pointer-events-none w-full max-w-[min(38ch,92vw)]">
            <span className="flex w-full flex-col gap-2">
              <span className="lf-action">{t('tutor.replay.position', { current: index + 1, total })}</span>
              <ProgressRibbon current={index + 1} total={total} />
            </span>
          </HudPlate>

          <div className="flex items-center justify-center gap-3">
            <HudPlate
              as="button"
              shape="chip"
              aria-label={t('tutor.replay.previousLine')}
              disabled={index === 0}
              onClick={director.previous}
              className="pointer-events-auto"
            >
              <Icon name="skip_previous" />
            </HudPlate>

            <HudPlate
              as="button"
              shape="orb"
              floor="accent"
              aria-label={
                finished ? t('tutor.replay.fromStart') : playing ? t('tutor.replay.pause') : t('tutor.replay.play')
              }
              onClick={director.toggle}
              className="pointer-events-auto h-[4.5rem] w-[4.5rem]"
              floorClassName="h-full w-full"
            >
              {/*
                The icon changes with the state and so does the NAME above it.
                An icon-only control whose accessible name says "play" while it
                is showing a pause glyph is the one accessibility bug that is
                also a usability bug for everybody.
              */}
              <Icon
                name={finished ? 'replay' : playing ? 'pause' : 'play_arrow'}
                fill
                className="text-[2rem]"
              />
            </HudPlate>

            <HudPlate
              as="button"
              shape="chip"
              aria-label={t('tutor.replay.nextLine')}
              disabled={finished}
              onClick={director.next}
              className="pointer-events-auto"
            >
              <Icon name="skip_next" />
            </HudPlate>
          </div>
        </div>

        {/*
          THE TWO THINGS A LEARNER PLAUSIBLY WANTS WHEN IT IS OVER, and the
          second of them is the honest answer to the one thing a replay cannot
          do. Same shape as the goodbye (`ClosingInWorld`), so the two ends of
          the route rhyme.

          The row exists in every state, so adding a chip to it at the end does
          not move the dock's bottom edge — see the zero-height slot above for
          why that matters.
        */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {finished && (
            <HudPlate as="button" shape="chip" onClick={director.restart} className="pointer-events-auto">
              <span className="lf-action">{t('tutor.replay.fromStart')}</span>
            </HudPlate>
          )}
          <LeaveChip label={t('tutor.replay.talkInstead', { name: t(`tutor.character.${character}.name`) })} onClick={onDone} />
        </div>
      </DockRows>
    </>
  );
}

// ── The pieces ──────────────────────────────────────────────────────────────

/**
 * The one chip that leaves the replay.
 *
 * It reads "Talk to Dina", not "Close", and that phrasing is the honesty
 * requirement discharged as an OFFER: the sentence a learner needs is "you
 * cannot speak to this one", and the least broken way to say it is to put the
 * way to speak for real in the place where they reached for it. It falls back
 * to a plain "Back" on the two failure surfaces above, where there is no
 * character name to promise anything about.
 */
function LeaveChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <HudPlate as="button" shape="chip" onClick={onClick} className="pointer-events-auto lf-settle-2">
      <span className="lf-action">{label}</span>
    </HudPlate>
  );
}

/**
 * How far through, drawn.
 *
 * Counted in BEATS rather than in milliseconds (`progressOf`), and
 * `aria-hidden` because the line under it already says "Line 4 of 18" in words.
 * A progressbar role here would announce a number the learner can read, every
 * time it moves, on top of the caption's own live region.
 */
function ProgressRibbon({ current, total }: { current: number; total: number }) {
  const filled = total === 0 ? 0 : Math.min(Math.max(current / total, 0), 1);
  return (
    <span aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full bg-content/20">
      <span
        className="block h-full rounded-full bg-content motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-[var(--lf-ease)]"
        style={{ width: `${filled * 100}%` }}
      />
    </span>
  );
}

/**
 * What an activity looked like, and how it went.
 *
 * WHAT IT DOES NOT DO IS THE INTERESTING PART. It does not mount the Lesson
 * Engine renderer. A replayed activity that a learner can answer again is not a
 * replay of anything — it is a second attempt at a graded exercise, posted to a
 * route that pays XP, wearing the clothes of a memory. And it could not show
 * the right answer even if it wanted to: `tutor_segments.answer` is the
 * server-only key and never reaches a browser (/ORACLE.md §8, migration 0047).
 *
 * Nor does it show WHICH option the learner picked, because nothing anywhere
 * stores that. The score, the attempts and the XP are stored, so the score, the
 * attempts and the XP are what it says. Inventing a tick beside a plausible
 * choice would be a confident wrong picture where an absent one merely omits
 * (/AGENTS.md §1.14).
 */
function ActivityDetail({ beat }: { beat: ReplayBeat }) {
  const { t } = useTranslation();
  const activity = beat.activity;
  if (!activity) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-sunken px-3 py-2">
      <p className="lf-label text-content">{t('tutor.replay.activity')}</p>
      {activity.prompt !== '' && (
        <div className="lf-body text-content">
          <MarkdownLite text={activity.prompt} />
        </div>
      )}
      <p className="lf-caption text-content-muted">
        <ActivitySummary beat={beat} />
      </p>
    </div>
  );
}

/**
 * How an activity went, from the only three facts that exist.
 *
 * A component rather than a `t()` helper because it is needed in two places at
 * two densities, and threading `TFunction` through a signature is how a
 * translation call ends up mistyped as `(key: string) => string` and silently
 * loses its interpolation.
 */
function ActivitySummary({ beat }: { beat: ReplayBeat }) {
  const { t } = useTranslation();
  const activity = beat.activity;
  if (!activity) return <>{t('tutor.replay.activity')}</>;
  if (activity.score === null) return <>{t('tutor.replay.activityUnanswered')}</>;
  const scored = t('tutor.replay.activityScored', { score: activity.score });
  const xp = activity.xpAwarded > 0 ? ` · ${t('tutor.history.xp', { count: activity.xpAwarded })}` : '';
  return <>{`${scored}${xp}`}</>;
}

/**
 * Every line of the conversation, in order, and every one of them a way in.
 *
 * IT IS NOT `TutorTranscript`, and the difference is the point rather than a
 * fork. That component is a LOG: it prints what has been said, pins itself to
 * the bottom, and announces additions. This is a MAP: it shows the whole
 * conversation including the part that has not replayed yet, marks where the
 * performance currently is, and every row is a button that moves it there. A
 * log whose rows were secretly buttons would be a worse version of both.
 *
 * THE FUTURE IS SHOWN, at `content-muted`, and that is a deliberate departure
 * from how a live session reads. Live, the next line does not exist yet. Here
 * it does — the learner lived it — and hiding it would make the only navigation
 * on the phase one-directional. It is the same reasoning a video scrubber shows
 * the whole timeline; the muting is what keeps "where we are" legible inside
 * it. The plate is the phase's reading surface, so muted ink survives the
 * material's alpha here and only here (/DESIGN.md §Lumen).
 */
function ReplayTranscript({
  beats,
  current,
  onJump,
  label,
  youLabel,
  tutorLabel,
  activityLabel,
  noteLabel,
  jumpLabel,
}: {
  beats: readonly ReplayBeat[];
  current: number;
  onJump: (index: number) => void;
  label: string;
  youLabel: string;
  tutorLabel: string;
  activityLabel: string;
  noteLabel: string;
  jumpLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /*
   * THE LOG FOLLOWS THE PERFORMANCE, and it scrolls the CONTAINER rather than
   * calling `scrollIntoView`.
   *
   * `scrollIntoView` walks every scrollable ancestor, and this one is inside a
   * bottom sheet inside a `fixed inset-0` stage: on a phone it scrolls the
   * stage layer itself and drags the island out from under the camera. The
   * arithmetic below moves exactly one element and cannot reach past it.
   */
  useEffect(() => {
    const box = scrollRef.current;
    const row = activeRef.current;
    if (!box || !row) return;
    const top = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2;
    box.scrollTop = Math.max(0, top);
  }, [current]);

  // The log is taller than its box on any real conversation, and a row cut in
  // half at the bottom edge reads as a rendering seam rather than as "there is
  // more". Same recipe the live plate uses (/DESIGN.md §Lumen -> Room to answer
  // in).
  useScrollEdges(scrollRef);

  if (beats.length === 0) return null;

  return (
    <div className="lf-scroll-edge max-h-48 min-h-0">
      <div
        ref={scrollRef}
        role="group"
        aria-label={label}
        /*
         * `relative` IS LOAD BEARING, and its absence was measured at 1280x800.
         * `offsetTop` is relative to the nearest POSITIONED ancestor, and without
         * this that ancestor is the lesson plate's own fixed frame — so the
         * arithmetic below added the header, the bubble and two paragraphs to
         * every row's offset and scrolled the log three lines past the beat it
         * was trying to centre. On the first beat of a replay the learner was
         * shown the middle of their own conversation.
         */
        /*
         * `max-h-48` sits on THIS element as well as on the frame above it. The
         * frame owns the edges (a pseudo-element inside a scroller scrolls with
         * the content); the scroller owns the scrolling, and a scroller with no
         * ceiling of its own would simply grow and never scroll.
         */
        className="relative max-h-48 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1"
      >
        {beats.map((beat) => {
          const isCurrent = beat.index === current;
          const speaker =
            beat.kind === 'tutor'
              ? tutorLabel
              : beat.kind === 'learner'
                ? youLabel
                : beat.kind === 'activity'
                  ? activityLabel
                  : noteLabel;

          return (
            <button
              key={beat.id}
              ref={isCurrent ? activeRef : undefined}
              type="button"
              onClick={() => onJump(beat.index)}
              /*
               * The whole sentence is in the accessible name, after the action,
               * because "Play from here" on eighteen adjacent rows is eighteen
               * identical controls to anybody navigating by name. The visible
               * label comes second in the DOM and first in the reading order of
               * the row itself, which is the arrangement `ConversationView` uses
               * for the adaptation answers and for the same reason.
               */
              aria-label={`${jumpLabel}: ${speaker}. ${beat.text}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'block w-full min-h-11 rounded-md px-3 py-2 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                beat.kind === 'learner' ? 'bg-accent-soft' : 'bg-surface-sunken',
                // Past and present at full ink; what has not played yet is quiet.
                beat.index <= current ? 'text-content' : 'text-content-muted',
                isCurrent && 'ring-2 ring-primary',
              )}
            >
              <span aria-hidden="true" className="lf-label block text-content-muted">
                {speaker}
              </span>
              <span aria-hidden="true" className="lf-body block">
                {beat.text === '' ? activityLabel : beat.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The dock's upper slot, or wherever this is standing when there is no shell.
 *
 * The same three-state reading `ClosingInWorld` and `ConversationView` use: no
 * dock at all means a unit test or a device with no stage, and the controls
 * render where they are rather than disappearing; a dock whose slot has not
 * attached yet is true for exactly the first render, and rendering in place for
 * that one frame would flash the whole transport across the top-left corner of
 * the island.
 */
function DockRows({ dock, children }: { dock: ReturnType<typeof useStageDock>; children: ReactNode }) {
  const rows = <div className="flex w-full flex-col items-center gap-2">{children}</div>;
  if (!dock) return rows;
  if (!dock.above) return null;
  return createPortal(rows, dock.above);
}
