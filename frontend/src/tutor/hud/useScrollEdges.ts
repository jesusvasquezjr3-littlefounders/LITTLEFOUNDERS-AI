import { useEffect, type RefObject } from 'react';

/*
 * "THERE IS MORE BELOW" — said by the EDGE of a scrolling box.
 *
 * WHY IT EXISTS. The lesson plate is 420 px wide, which makes exercises tall:
 * measured across all 55 engine fixtures on `/dev/tutor-lab` at 1280x800, 27 of
 * them fit whole and the rest have to scroll their answers. A scroll that a
 * learner has to DISCOVER is a defect — /AGENTS.md §1.14 in its quietest form,
 * because a panel with more content below looks exactly like a panel that has
 * finished. Overlay scrollbars make it worse: they are invisible until the box
 * is already being scrolled, which is after the moment the learner needed to
 * know.
 *
 * WHY IT IS AN ATTRIBUTE AND NOT STATE. This runs on every scroll event of a
 * box that contains a live exercise. `setState` there re-renders the exercise —
 * and on this route, an island — sixty times during one flick of a thumb. The
 * same ref-channel rule the sheet's footprint follows (`LessonPlate`): a scroll
 * handler may write a style or an attribute and must never call `setState`.
 *
 * IT IS NOT AN AFFORDANCE FOR A MOUSE. There is no hover here and there must
 * not be (/AGENTS.md §1.11): the edge is visible at rest, on a phone, from the
 * first frame, before anything is touched.
 *
 * AND IT DOES NOT BREAK §Lumen's PER-FRAME RULE. That rule — "nothing on this
 * layer may be written per frame except an anchored node's own transform" — is
 * about the STAGE's inherited custom properties, a write to which invalidates
 * style on the entire HUD. This writes two data attributes on ONE frame element
 * whose only styled descendants are its own two pseudo-elements, and it writes
 * them on the learner's scroll rather than on the render loop.
 */

/**
 * Marks the scroller's PARENT with `data-scroll-above` / `data-scroll-below`.
 *
 * The parent, because the cue has to sit still while the content moves, and a
 * pseudo-element inside a scrolling box scrolls with it. Pair it with the
 * `.lf-scroll-edge` recipe in `index.css`, which paints the two edges.
 */
export function useScrollEdges(scrollerRef: RefObject<HTMLElement | null>): void {
  /*
   * NO DEPENDENCY ARRAY, deliberately, and the cost is named rather than
   * hand-waved: this re-attaches one listener and one `ResizeObserver` per
   * render of the panel, which on a typed answer is once per keystroke. The
   * alternative is a stable dependency, and a stable dependency cannot see the
   * scroller ARRIVE — the panel returns early for an unknown segment type
   * (LESSON_ENGINE.md §6 forward compatibility), so the node is genuinely
   * absent on some renders and present on the next. Silence when a box starts
   * scrolling is the failure this hook exists to prevent, so it pays the churn.
   */
  useEffect(() => {
    const node = scrollerRef.current;
    const frame = node?.parentElement;
    if (!node || !frame) return;

    const update = () => {
      // 2 px of tolerance: sub-pixel layout leaves a permanent 0.5 px of
      // "scrollable" on boxes that visibly do not scroll, and a cue that is
      // always on says nothing.
      const below = node.scrollHeight - node.clientHeight - node.scrollTop > 2;
      frame.dataset.scrollBelow = below ? 'yes' : 'no';
      frame.dataset.scrollAbove = node.scrollTop > 2 ? 'yes' : 'no';
    };

    update();
    node.addEventListener('scroll', update, { passive: true });

    // Two observers, because the box and its content change size independently:
    // the plate is resized by a sheet drag, and the exercise grows when a
    // verdict, a hint or a dragged token lands inside it.
    const observers: ResizeObserver[] = [];
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(node);
      const content = node.firstElementChild;
      if (content) observer.observe(content);
      observers.push(observer);
    }

    return () => {
      node.removeEventListener('scroll', update);
      for (const observer of observers) observer.disconnect();
    };
  });
}
