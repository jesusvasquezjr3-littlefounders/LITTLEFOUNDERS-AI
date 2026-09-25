import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AgeBand, Locale } from './copyBudget';

/*
 * Overlay infrastructure (Frontend Bible 02 rules 12 and 13, §9.8, §11 item 10;
 * S03.2). Every overlay renders into its own host appended to <body>, so it is
 * `position: fixed` against the real viewport and never inside a scrolling,
 * transformed or contained ancestor. One stack orders every dismissable layer:
 * Escape closes only the topmost one, and a modal layer makes everything
 * beneath it inert, locks page scroll without moving it, traps focus and gives
 * focus back to whatever opened it.
 */

export type RebuildTheme = 'light' | 'dark';
export interface RebuildEnvironment { theme: RebuildTheme; locale: Locale; ageBand?: AgeBand }

/** Theme, language and age band of the surface, so overlay hosts outside the surface's DOM still use its tokens. */
export const RebuildEnvironmentContext = createContext<RebuildEnvironment>({ theme: 'light', locale: 'en-US' });
export const useRebuildEnvironment = () => useContext(RebuildEnvironmentContext);

/** The z-index slots of 02 §9.8, generated into tokens.css as `--layer-*`. */
export type LayerKind = 'nav' | 'sheet' | 'scrim' | 'toast';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A body-level host that carries the surface's theme and language. `live`
 * hosts (the announcer and the toast region) are never made inert, so
 * announcements keep working while a dialog is open.
 */
export function useLayerHost(active: boolean, options: { live?: boolean; layer?: LayerKind } = {}): HTMLElement | null {
  const environment = useRebuildEnvironment();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!active) return;
    const element = document.createElement('div');
    element.className = 'lf-rebuild lf-layer-root';
    if (options.live) element.dataset.lfLive = 'true';
    if (options.layer) element.dataset.layer = options.layer;
    document.body.append(element);
    setHost(element);
    return () => { element.remove(); setHost(null); };
  }, [active, options.live, options.layer]);
  useIsomorphicLayoutEffect(() => {
    if (!host) return;
    host.dataset.theme = environment.theme;
    host.lang = environment.locale;
    if (environment.ageBand) host.dataset.ageBand = environment.ageBand; else delete host.dataset.ageBand;
  }, [host, environment.theme, environment.locale, environment.ageBand]);
  return host;
}

/* ---------------------------------------------------------------------------
 * The layer stack: Escape, inert background.
 * ------------------------------------------------------------------------- */

interface LayerEntry { id: number; host: HTMLElement; modal: boolean; onEscape?: () => void }
const stack: LayerEntry[] = [];
const ownedInert = new Set<Element>();
let nextId = 1;

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top?.onEscape) return;
  event.preventDefault();
  event.stopPropagation();
  top.onEscape();
}

/** Everything under the topmost modal is inert; layers opened after it (a popover inside a dialog) stay live. */
function applyInert() {
  for (const element of ownedInert) element.removeAttribute('inert');
  ownedInert.clear();
  let modalIndex = -1;
  for (let index = stack.length - 1; index >= 0; index--) if (stack[index]!.modal) { modalIndex = index; break; }
  if (modalIndex === -1) return;
  const keep = new Set(stack.slice(modalIndex).map((entry) => entry.host));
  for (const child of Array.from(document.body.children)) {
    if (keep.has(child as HTMLElement) || (child as HTMLElement).dataset?.lfLive === 'true') continue;
    if (child.hasAttribute('inert') || child.tagName === 'SCRIPT') continue;
    child.setAttribute('inert', '');
    ownedInert.add(child);
  }
}

/** Registers a layer while `active`. Returns nothing; the stack order is the open order. */
export function useLayer(active: boolean, host: HTMLElement | null, modal: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useIsomorphicLayoutEffect(() => {
    if (!active || !host) return;
    const entry: LayerEntry = { id: nextId++, host, modal, onEscape: () => escape.current?.() };
    if (stack.length === 0) document.addEventListener('keydown', onDocumentKeyDown, true);
    stack.push(entry);
    applyInert();
    return () => {
      const index = stack.findIndex((item) => item.id === entry.id);
      if (index !== -1) stack.splice(index, 1);
      applyInert();
      if (stack.length === 0) document.removeEventListener('keydown', onDocumentKeyDown, true);
    };
  }, [active, host, modal]);
}

/** For tests and the gallery: how many layers are open, and whether the top one is modal. */
export function layerStackSnapshot() {
  return { depth: stack.length, topModal: stack[stack.length - 1]?.modal ?? false };
}

/* ---------------------------------------------------------------------------
 * Scroll lock that never moves the page (02 rule 13).
 * ------------------------------------------------------------------------- */

let lockCount = 0;
let saved: { x: number; y: number; overflow: string; padding: string } | null = null;

export function useScrollLock(active: boolean) {
  useIsomorphicLayoutEffect(() => {
    if (!active) return;
    if (lockCount++ === 0) {
      const root = document.documentElement;
      const gutter = window.innerWidth - root.clientWidth;
      saved = { x: window.scrollX, y: window.scrollY, overflow: root.style.overflow, padding: document.body.style.paddingInlineEnd };
      root.style.overflow = 'hidden';
      if (gutter > 0) document.body.style.paddingInlineEnd = `${gutter}px`;
    }
    return () => {
      if (--lockCount > 0 || !saved) return;
      const { x, y, overflow, padding } = saved;
      saved = null;
      document.documentElement.style.overflow = overflow;
      document.body.style.paddingInlineEnd = padding;
      if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    };
  }, [active]);
}

/* ---------------------------------------------------------------------------
 * Focus: trap inside a modal, give focus back on close (02 §11 item 10).
 * ------------------------------------------------------------------------- */

const TABBABLE = [
  'a[href]', 'area[href]', 'button:not(:disabled)', 'input:not(:disabled):not([type="hidden"])', 'select:not(:disabled)',
  'textarea:not(:disabled)', 'iframe', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])', '[tabindex]',
].join(',');

/** The z-index slot a floating layer opened from `trigger` belongs to: its enclosing overlay's, else the page's. */
export function layerOf(trigger: Element | null): LayerKind {
  const layer = (trigger?.closest('.lf-layer-root') as HTMLElement | null)?.dataset.layer;
  return layer === 'sheet' || layer === 'scrim' || layer === 'toast' ? layer : 'nav';
}

/** Keyboard-reachable elements in DOM order (one stop per radio group, the checked one when there is one). */
export function tabbables(container: HTMLElement): HTMLElement[] {
  const found = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter((element) => {
    if (element.tabIndex < 0 || element.closest('[hidden],[inert]')) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
  const seenGroups = new Set<string>();
  return found.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
    const group = element.name;
    const checked = found.find((other) => other instanceof HTMLInputElement && other.type === 'radio' && other.name === group && other.checked);
    if (checked) return checked === element;
    if (seenGroups.has(group)) return false;
    seenGroups.add(group);
    return true;
  });
}

export function focusElement(element: HTMLElement | null | undefined) {
  if (!element) return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

/*
 * The control a person last pressed. Safari does not focus a button when it is
 * clicked, so `document.activeElement` is <body> when a dialog opens from a
 * click there; focus then returns to the pressed control instead of being lost.
 */
let lastPressed: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  const remember = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TABBABLE) : null;
    if (target) lastPressed = target;
  };
  document.addEventListener('pointerdown', remember, true);
  document.addEventListener('click', remember, true);
}

/**
 * Moves focus into `container` when it becomes active (the `initialFocus`
 * element, else the first tabbable, else the container itself), keeps Tab and
 * Shift+Tab inside it, and returns focus to the element that had it before.
 */
export function useFocusTrap(active: boolean, container: RefObject<HTMLElement>, initialFocus?: RefObject<HTMLElement>) {
  useIsomorphicLayoutEffect(() => {
    const root = container.current;
    if (!active || !root) return;
    const focused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const returnTo = focused ?? (lastPressed?.isConnected ? lastPressed : null);
    if (!focusElement(initialFocus?.current) && !focusElement(tabbables(root)[0])) {
      if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
      focusElement(root);
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = tabbables(root);
      if (items.length === 0) { event.preventDefault(); focusElement(root); return; }
      const first = items[0]!, last = items[items.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === root || !root.contains(current))) { event.preventDefault(); focusElement(last); }
      else if (!event.shiftKey && (current === last || !root.contains(current))) { event.preventDefault(); focusElement(first); }
    };
    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Give focus back only if it is still inside the closing layer (or lost to <body>).
      const current = document.activeElement;
      if (returnTo && returnTo.isConnected && (!current || current === document.body || root.contains(current))) focusElement(returnTo);
    };
  }, [active]);
}

/** Opens after a tap on the trigger, closes on a pointer press anywhere outside both. */
export function useOutsidePress(active: boolean, refs: readonly RefObject<HTMLElement | null>[], onOutside: () => void, extra?: () => (HTMLElement | null)[]) {
  const callback = useRef(onOutside);
  callback.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null;
      const inside = [...refs.map((ref) => ref.current), ...(extra?.() ?? [])].some((element) => element && target && element.contains(target));
      if (!inside) callback.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}
