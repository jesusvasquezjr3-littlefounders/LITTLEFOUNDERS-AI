import { useEffect, useRef, type RefObject } from 'react';

/*
 * Route focus lands on a page's <h1> (the shells' useRouteFocus). A screen
 * that loads its data first shows a loading heading, then replaces it with
 * the ready one: without help, the focus the shell placed on the first
 * heading is lost with it and a keyboard or screen-reader user starts again
 * from the top of the document. This carries it to the new heading, only
 * when the old one held it and nothing else has taken it since.
 */
export function useCarryHeadingFocus(root: RefObject<HTMLElement>, stateKey: string) {
  const headingHadFocus = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const track = (event: FocusEvent) => { headingHadFocus.current = (event.target as HTMLElement | null)?.tagName === 'H1'; };
    // Focus moved somewhere else on purpose (the navigation, the browser): never take it back.
    const leave = (event: FocusEvent) => { if (event.relatedTarget instanceof Node && !element.contains(event.relatedTarget)) headingHadFocus.current = false; };
    element.addEventListener('focusin', track);
    element.addEventListener('focusout', leave);
    return () => { element.removeEventListener('focusin', track); element.removeEventListener('focusout', leave); };
  }, [root]);
  useEffect(() => {
    const element = root.current;
    if (!element || !headingHadFocus.current) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const heading = element.querySelector<HTMLElement>('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [root, stateKey]);
}
