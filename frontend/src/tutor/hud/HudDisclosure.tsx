import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { HudPlate } from './HudPlate';
import { useScrollEdges } from './useScrollEdges';

/*
 * ONE NAMED THING, CLOSED UNTIL ASKED FOR.
 *
 * The Tutor's HUD had no way to put something away. Every secondary surface was
 * either mounted for the whole session or hand-rolled its own open/closed
 * coordination, and the bill came in three forms: a 410x501 desktop panel on
 * screen with zero children for most of a lesson, a 928x317 arrival sheet over
 * the island with a 164 px window onto 736 px of content, and four call sites
 * each spelling "only one of us may be open" slightly differently.
 *
 * This is the one primitive that replaces all of it. The island and the
 * whiteboard are what the product is; everything else is a word you can press.
 *
 * THREE STATES, AND NO FOURTH. `closed` is the trigger alone. `open` is the
 * trigger plus its panel. `absent` is not rendered at all — a disclosure with
 * nothing inside it does not exist, which is the fix for tapping "My progress"
 * on a fresh account and being shown an empty pane because the panel component
 * returned null while the chrome around it rendered unconditionally. There is
 * deliberately no DISABLED trigger: a control a child can aim at and press that
 * does nothing is the worst of the available states.
 *
 * THE CHILDREN NEVER UNMOUNT. `{open && <Panel/>}` is prohibited here and it is
 * not a preference: a remount replays every hosted whiteboard's grow-in
 * animation and re-fires its live region, so closing and reopening a panel would
 * re-announce an activity a learner already read and re-run motion they already
 * watched. `PlanNotebookPanel.test.tsx` pins DOM identity across exactly this,
 * which makes that suite the test that proves this rule rather than a detail of
 * one panel.
 *
 * CLOSING IS THREE WRITES, NOT ONE. `hidden`, `inert`, and an inline
 * `display: none`. The first is the semantics, the second is what keeps a
 * keyboard and a screen reader out of a box nobody can see, and the third is
 * there because `[hidden] { display: none }` is a 0-1-0 user-agent rule that
 * ANY author `flex` beats — this codebase has already paid for that twice, once
 * with an exercise laying out at y=925/986/1047 while reporting `hidden ===
 * true`, and once with a name plate painted under the dock, inert, and still
 * pressable. Released back to the empty string and never to a guessed value,
 * the same rule `ScreenAnchor`'s `hide()` states for the same reason.
 *
 * IT IS NOT A MODAL AND MUST NOT BECOME ONE. No scrim, no `aria-modal`, no
 * focus trap, no `document.body.style.overflow`. Three reasons in order of
 * severity: the tutor keeps talking, and a scrim hides the speaker while their
 * words are on screen; the island is itself a control surface, so a modal makes
 * the product inert while it is open; and a child mid-sentence must always be
 * able to reach the microphone, which a focus trap forbids. A disclosure that
 * needs a scrim to be legible is a disclosure whose panel is too big.
 *
 * THE PANEL IS VIEWPORT-FIXED AND NEVER PROJECTOR-POSITIONED, so no camera move
 * can cull it and it publishes no world rect. It rides a host the caller passes
 * — in practice one of the dock's slots, which already republish their own rect
 * to the safe-area registry, so the caption's escape budget and the camera
 * director both compose around an open panel for free and neither needs a new
 * slot. With no host it renders IN PLACE, which is a first-class state rather
 * than a fallback: a portal whose target is absent renders NOTHING, silently,
 * and this route has already shipped a toggle that flipped `aria-expanded`
 * while its list appeared nowhere at all.
 */

/** How tall a panel may get before it scrolls, by width. */
const PANEL_HEIGHT =
  'max-h-[min(52vh,calc(100dvh-14rem))] lg:max-h-[min(60vh,calc(100dvh-12rem))]';

/*
 * The width, and the reason it is not wider. The island has to stay visible on
 * both sides of an open panel on desktop — that is the whole argument for a
 * disclosure over a modal — and on a phone the 4vw of gutter is what stops a
 * reading surface reading as a page.
 */
const PANEL_WIDTH = 'w-[min(30rem,92vw)] lg:w-[min(36rem,42vw)]';

export interface HudDisclosureProps {
  /** Stable identity, used for `aria-controls` and by `useOneOpen`. */
  id: string;
  /**
   * The VISIBLE words on the trigger. Required, and never replaced by a glyph:
   * an unlabelled icon button in the header row is what made "start over" the
   * most likely thing a confused learner pressed.
   */
  label: string;
  /** Material Symbols ligature. Decoration — never the only name. */
  icon?: string;
  /** Portal target. `null`/omitted renders the panel in place. */
  host?: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra frame classes for the trigger. */
  className?: string;
  /** Extra frame classes for the panel — a wider section, mostly. */
  panelClassName?: string;
  children?: ReactNode;
}

export function HudDisclosure({
  id,
  label,
  icon,
  host,
  open,
  onOpenChange,
  className,
  panelClassName,
  children,
}: HudDisclosureProps) {
  const { t } = useTranslation();
  const reactId = useId();
  const panelId = `hud-disclosure-${id}-${reactId}`;
  const labelId = `${panelId}-label`;

  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  useScrollEdges(scrollerRef);

  /*
   * Whether the learner has ever opened this panel. Focus moves into the panel
   * on an OPEN, and must not move on the first render of an already-open
   * disclosure (a phase that restores its own state would otherwise steal focus
   * from wherever the learner actually was).
   */
  const openedOnce = useRef(false);

  /* The three writes. An effect rather than JSX, because React 18.3 has no
   * `inert` prop and because `display` has to be released to the empty string
   * rather than to a value this component would be guessing at. */
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    node.hidden = !open;
    node.inert = !open;
    node.style.display = open ? '' : 'none';
  }, [open]);

  useEffect(() => {
    if (!open) {
      openedOnce.current = false;
      return;
    }
    if (openedOnce.current) return;
    openedOnce.current = true;
    /*
     * The SCROLLER takes focus, not the panel: a fully locked map has no
     * focusable descendant at all, and axe fires `scrollable-region-focusable`
     * on a scrolling box a keyboard cannot reach. It carries `tabIndex={0}` for
     * the same reason.
     */
    scrollerRef.current?.focus();
  }, [open]);

  const close = useCallback(
    (returnFocus: boolean) => {
      onOpenChange(false);
      // The trigger is where the learner was before they opened this, and a
      // keyboard user who loses their place has to start the row again.
      if (returnFocus) triggerRef.current?.focus();
    },
    [onOpenChange],
  );

  /*
   * A disclosure with nothing in it is not rendered. `children` may legitimately
   * be `null` — several of the panels this hosts return null when a learner has
   * no history yet — so the emptiness test is on the resolved node, not on
   * whether a prop was passed.
   */
  if (children === null || children === undefined || children === false) return null;

  const panel = (
    <HudPlate
      as="section"
      ref={panelRef}
      shape="sheet"
      density="reading"
      id={panelId}
      aria-labelledby={labelId}
      className={cn(
        'pointer-events-auto lf-settle flex min-h-0 flex-col',
        PANEL_WIDTH,
        PANEL_HEIGHT,
        panelClassName,
      )}
      floorClassName="!px-0 !py-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        close(true);
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-content/10 px-5 py-3.5">
        <h2 id={labelId} className="lf-action min-w-0 flex-1 text-content">
          {label}
        </h2>
        <button
          type="button"
          onClick={() => close(true)}
          aria-label={t('tutor.disclosure.close', { name: label })}
          className="lf-press lf-focus grid h-11 w-11 shrink-0 place-items-center rounded-md text-content-muted transition-colors hover:text-content"
        >
          <Icon name="close" className="!text-[20px]" />
        </button>
      </div>

      {/* The frame `useScrollEdges` writes its two attributes onto. */}
      <div className="lf-scroll-edge min-h-0 flex-1">
        <div
          ref={scrollerRef}
          tabIndex={0}
          className="lf-focus h-full overflow-y-auto overscroll-contain px-5 py-4"
        >
          {/* One element, so the hook's `firstElementChild` observer sees the
              content grow rather than the scroller it is inside. */}
          <div>{children}</div>
        </div>
      </div>
    </HudPlate>
  );

  return (
    <>
      <HudPlate
        as="button"
        ref={triggerRef}
        shape="chip"
        onClick={() => (open ? close(true) : onOpenChange(true))}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn('pointer-events-auto lf-focus shrink-0', className)}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {icon ? <Icon name={icon} className="!text-[18px]" aria-hidden /> : null}
          <span className="lf-action">{label}</span>
          {/*
            The chevron says WHERE THE PANEL WILL GO, not where the trigger
            is. Closed it points the way the panel opens — down, from a header
            row — and open it points back at the word that will collapse it.
            Photographed the other way round first, which reads as a control
            that has already been used.
          */}
          <Icon
            name={open ? 'expand_less' : 'expand_more'}
            className="!text-[18px] text-content-faint"
            aria-hidden
          />
        </span>
      </HudPlate>
      {host ? createPortal(panel, host) : panel}
    </>
  );
}

/**
 * "Only one of these may be open." Held by the caller, so the rule is expressed
 * once instead of at every call site that used to coordinate two toggles by
 * hand — the arrangement that produced a pair of mutually-exclusive
 * `aria-expanded` buttons sharing one sheet in two different phases.
 *
 * `reset` exists for a PHASE change: a panel left open across the end of a
 * session is a panel describing something that is over.
 */
export function useOneOpen() {
  const [openId, setOpenId] = useState<string | null>(null);
  return {
    openId,
    isOpen: (id: string) => openId === id,
    setOpen: (id: string) => (next: boolean) => setOpenId(next ? id : null),
    reset: useCallback(() => setOpenId(null), []),
  };
}
