import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './buttons';
import {
  focusElement, layerOf, tabbables, useFocusTrap, useLayer, useLayerHost, useOutsidePress, useScrollLock, type LayerKind,
} from './layers';
import './overlays.css';

/*
 * Overlays (Frontend Bible 02 rules 12 and 13, §9.8, §11 item 10; 06 §4
 * layering; S03.2). Modal overlays (dialog, sheet) sit on a scrim, fixed to the
 * viewport, trap focus, close on Escape, lock page scroll without moving it and
 * make the page behind them inert; closing gives focus back to what opened
 * them. Anchored layers (popover, menu, tooltip) are non-modal. No component
 * owns a string: every label and every line of copy is passed in translated.
 */

/** Shared modal behaviour: host, stack, inert, scroll lock and focus trap. */
function useModal(open: boolean, layer: LayerKind, onDismiss: (() => void) | undefined, panel: React.RefObject<HTMLElement>, initialFocus?: React.RefObject<HTMLElement>) {
  const host = useLayerHost(open, { layer });
  // A host React already removed is not ready: under development double effects a render can still hold the first
  // host after its cleanup, and a focus trap run there focuses nothing (W2T.1, found on the real staff routes).
  const ready = open && host !== null && host.isConnected;
  useLayer(ready, host, true, onDismiss);
  useScrollLock(ready);
  useFocusTrap(ready, panel, initialFocus);
  return host;
}

export interface DialogProps {
  open: boolean;
  /** Escape and a press on the scrim call this. Omit it only while an action is in flight. */
  onClose?: () => void;
  heading: string;
  /** What happens, in words (02 §9.8): a dialog never relies on colour to say it. */
  description: string;
  children?: ReactNode;
  /** The action row. Put the safe option first. */
  actions?: ReactNode;
  /** The element focused when the dialog opens; defaults to the first control. */
  initialFocus?: React.RefObject<HTMLElement>;
  role?: 'dialog' | 'alertdialog';
}

/** A modal dialog on the scrim layer (02 `dialog`: surface, xl radius, float shadow, `position: fixed`). */
export function Dialog({ open, onClose, heading, description, children, actions, initialFocus, role = 'dialog' }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const host = useModal(open, 'scrim', onClose, panel, initialFocus);
  if (!open || !host) return null;
  return createPortal(<div className="lf-layer lf-layer--scrim" data-overlay="dialog">
    <div className="lf-scrim" aria-hidden="true" />
    <div className="lf-dialog-frame" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={panel} className="lf-dialog" role={role} aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}>
        <h2 id={`${id}-heading`} className="lf-dialog-heading" data-copy-role="heading">{heading}</h2>
        <p id={`${id}-description`} className="lf-dialog-description" data-copy-role="body">{description}</p>
        {children}
        {actions ? <div className="lf-dialog-actions">{actions}</div> : null}
      </section>
    </div>
  </div>, host);
}

export interface ConfirmDialogProps {
  open: boolean;
  heading: string;
  /** The consequence of confirming, stated plainly (02 §9.8). */
  consequence: string;
  keepLabel: string;
  confirmLabel: string;
  /** Shown on the confirm button while the request is in flight; the dialog cannot be dismissed meanwhile. */
  pendingLabel?: string;
  pending?: boolean;
  /** Destructive confirms use the error hue; everything else confirms in success. */
  destructive?: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}

/**
 * A confirmation. The keep option always comes first, in reading order and in
 * focus order, and it is where focus lands, so Enter, Escape and a press on the
 * scrim all keep (02 §9.8: "a destructive action always has an explicit
 * keep/cancel option offered before the destructive one").
 */
export function ConfirmDialog({ open, heading, consequence, keepLabel, confirmLabel, pendingLabel, pending = false, destructive = false, onKeep, onConfirm }: ConfirmDialogProps) {
  const keep = useRef<HTMLButtonElement>(null);
  return <Dialog open={open} role="alertdialog" heading={heading} description={consequence} initialFocus={keep}
    onClose={pending ? undefined : onKeep}
    actions={<>
      <Button ref={keep} data-confirm="keep" onClick={onKeep} disabled={pending}>{keepLabel}</Button>
      <Button data-confirm="confirm" variant={destructive ? 'danger' : 'success'} pending={pending} pendingLabel={pendingLabel} onClick={onConfirm}>{confirmLabel}</Button>
    </>} />;
}

/**
 * The only way a surface offers a destructive action: a danger button that
 * opens a `ConfirmDialog` and runs `onConfirm` only after the person confirms
 * (02 §9.5: the error hue is "always behind a confirmation dialog").
 */
export function DestructiveAction({ label, confirm, onConfirm, pending = false, disabled = false, size }: {
  label: string;
  confirm: { heading: string; consequence: string; keepLabel: string; confirmLabel: string; pendingLabel?: string };
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  /** The trigger waits while a sibling action on the same row is in flight. */
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const busy = pending || running;
  const run = async () => {
    setRunning(true);
    try { await onConfirm(); setOpen(false); } finally { setRunning(false); }
  };
  return <>
    <Button variant="danger" size={size} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>{label}</Button>
    <ConfirmDialog open={open} destructive pending={busy} {...confirm} onKeep={() => setOpen(false)} onConfirm={() => { void run(); }} />
  </>;
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `bottom`: details behind a tap (06 §4) and short choices. `full`: the phone navigation menu. */
  placement?: 'bottom' | 'full';
  /** A full sheet may use the brand mark in place of a visible heading; the heading still names the dialog. */
  headingHidden?: boolean;
  headerStart?: ReactNode;
}

/** A modal sheet on the sheet layer (02 §9.8, z 50), anchored to the bottom edge and the safe area. */
export function Sheet({ open, onClose, heading, closeLabel, children, footer, placement = 'bottom', headingHidden = false, headerStart }: SheetProps) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const host = useModal(open, 'sheet', onClose, panel);
  if (!open || !host) return null;
  return createPortal(<div className={`lf-layer lf-layer--sheet lf-layer--sheet-${placement}`} data-overlay="sheet">
    <div className="lf-scrim" aria-hidden="true" onPointerDown={onClose} />
    <section ref={panel} className={`lf-sheet lf-sheet--${placement}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
      <header className="lf-sheet-header">
        {headerStart}
        <h2 id={`${id}-heading`} className={headingHidden ? 'lf-visually-hidden' : 'lf-sheet-heading'} data-copy-role="heading">{heading}</h2>
        <IconButton glyph="close" label={closeLabel} onClick={onClose} className="lf-sheet-close" />
      </header>
      <div className="lf-sheet-body">{children}</div>
      {footer ? <footer className="lf-sheet-footer">{footer}</footer> : null}
    </section>
  </div>, host);
}

/* ---------------------------------------------------------------------------
 * Anchored layers
 * ------------------------------------------------------------------------- */

const GAP = 8;
const GUTTER = 16;

/**
 * Places a floating element next to its trigger against the viewport: below
 * when it fits, else above, never past a 16 px gutter; follows scroll and
 * resize. Hidden until measured so it never flashes in the wrong place. Its
 * size limits (never wider or taller than the viewport minus the gutters)
 * are in overlays.css.
 */
function useAnchoredPosition(open: boolean, triggerId: string, floating: React.RefObject<HTMLElement>, host: HTMLElement | null, align: 'start' | 'center' = 'start') {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden', insetBlockStart: 0, insetInlineStart: 0 });
  useLayoutEffect(() => {
    if (!open || !host) return;
    let frame = 0;
    const place = () => {
      const trigger = document.getElementById(triggerId), element = floating.current;
      if (!trigger || !element) return;
      const t = trigger.getBoundingClientRect(), f = element.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth, viewportHeight = window.innerHeight;
      let top = t.bottom + GAP;
      const side = top + f.height <= viewportHeight - GUTTER ? 'below' : t.top - GAP - f.height >= GUTTER ? 'above' : 'below';
      if (side === 'above') top = t.top - GAP - f.height;
      top = Math.max(GUTTER, Math.min(top, viewportHeight - GUTTER - f.height));
      let left = align === 'center' ? t.left + t.width / 2 - f.width / 2 : t.left;
      left = Math.max(GUTTER, Math.min(left, viewportWidth - GUTTER - f.width));
      setStyle({ insetBlockStart: Math.round(top), insetInlineStart: Math.round(left) });
      element.dataset.side = side;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    place();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); };
  }, [open, host, triggerId]);
  // Focus can only move into the layer once it is placed: a `visibility: hidden` element cannot take focus.
  return { style, placed: style.visibility !== 'hidden' };
}

export interface PopoverTriggerProps {
  id: string; 'aria-expanded': boolean; 'aria-controls': string; 'aria-haspopup': 'dialog'; onClick: () => void;
}

/**
 * A non-modal panel anchored to its trigger: a short "Why?" or "Details"
 * layer (06 §4). Focus moves into it; Escape, a press outside or tabbing past
 * its edge closes it, and Escape or tabbing out return focus to the trigger.
 */
export function Popover({ label, trigger, children, onOpenChange }: {
  /** The panel's accessible name (usually the trigger's own words). */
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const triggerId = `${id}-trigger`, panelId = `${id}-panel`;
  const [open, setOpenState] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const setOpen = useCallback((next: boolean) => { setOpenState(next); onOpenChange?.(next); }, [onOpenChange]);
  const [layer, setLayer] = useState<LayerKind>('nav');
  const host = useLayerHost(open);
  const ready = open && host !== null;
  const closeToTrigger = () => { setOpen(false); focusElement(document.getElementById(triggerId)); };
  useLayer(ready, host, false, closeToTrigger);
  useOutsidePress(ready, [panel], () => setOpen(false), () => [document.getElementById(triggerId)]);
  const { style, placed } = useAnchoredPosition(open, triggerId, panel, host);
  useLayoutEffect(() => {
    if (!ready || !placed || !panel.current) return;
    if (!focusElement(tabbables(panel.current)[0])) focusElement(panel.current);
  }, [ready, placed]);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panel.current) return;
    const items = tabbables(panel.current);
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (items.length === 0 || document.activeElement === edge || document.activeElement === panel.current) { event.preventDefault(); closeToTrigger(); }
  };
  return <>
    {trigger({ id: triggerId, 'aria-expanded': open, 'aria-controls': panelId, 'aria-haspopup': 'dialog', onClick: () => {
      if (!open) setLayer(layerOf(document.getElementById(triggerId)));
      setOpen(!open);
    } })}
    {ready ? createPortal(<div ref={panel} id={panelId} className={`lf-popover lf-anchored lf-anchored--${layer}`} role="dialog" aria-label={label}
      tabIndex={-1} style={style} onKeyDown={onKeyDown} data-overlay="popover">{children}</div>, host!) : null}
  </>;
}

export interface MenuItem { id: string; label: string; onSelect: () => void; disabled?: boolean }
export interface MenuTriggerProps {
  id: string; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string;
  onClick: () => void; onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * An action menu (WAI-ARIA menu button pattern). Enter, Space or ArrowDown
 * open it on the first item, ArrowUp on the last; arrows, Home, End and the
 * first letter move; Enter or Space choose; Escape and Tab close and give
 * focus back to the trigger. Items are at least 48 px tall (02 §8).
 */
export function Menu({ label, items, trigger }: { label: string; items: readonly MenuItem[]; trigger: (props: MenuTriggerProps) => ReactNode }) {
  const id = useId();
  const triggerId = `${id}-trigger`, menuId = `${id}-menu`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [layer, setLayer] = useState<LayerKind>('nav');
  const list = useRef<HTMLDivElement>(null);
  const host = useLayerHost(open);
  const ready = open && host !== null;
  const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);
  const closeToTrigger = () => { setOpen(false); focusElement(document.getElementById(triggerId)); };
  useLayer(ready, host, false, closeToTrigger);
  useOutsidePress(ready, [list], () => setOpen(false), () => [document.getElementById(triggerId)]);
  const { style, placed } = useAnchoredPosition(open, triggerId, list, host);
  useLayoutEffect(() => {
    if (!ready || !placed) return;
    focusElement(list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`));
  }, [ready, placed, active]);
  const openAt = (position: 'first' | 'last') => {
    setLayer(layerOf(document.getElementById(triggerId)));
    setActive((position === 'first' ? enabled[0] : enabled[enabled.length - 1])?.index ?? 0);
    setOpen(true);
  };
  const move = (delta: number) => {
    const at = enabled.findIndex(({ index }) => index === active);
    const next = enabled[(at + delta + enabled.length) % enabled.length];
    if (next) setActive(next.index);
  };
  const choose = (item: MenuItem) => { if (item.disabled) return; closeToTrigger(); item.onSelect(); };
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === 'ArrowDown') move(1);
    else if (key === 'ArrowUp') move(-1);
    else if (key === 'Home') setActive(enabled[0]?.index ?? 0);
    else if (key === 'End') setActive(enabled[enabled.length - 1]?.index ?? 0);
    else if (key === 'Tab') { event.preventDefault(); closeToTrigger(); return; }
    else if (key.length === 1 && /\S/u.test(key)) {
      const at = enabled.findIndex(({ index }) => index === active);
      const rotated = [...enabled.slice(at + 1), ...enabled.slice(0, at + 1)];
      const match = rotated.find(({ item }) => item.label.toLocaleLowerCase().startsWith(key.toLocaleLowerCase()));
      if (match) setActive(match.index);
    } else return;
    event.preventDefault();
  };
  return <>
    {trigger({ id: triggerId, 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId,
      onClick: () => { if (open) setOpen(false); else openAt('first'); },
      onKeyDown: (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); openAt('first'); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); openAt('last'); }
      } })}
    {ready ? createPortal(<div ref={list} id={menuId} className={`lf-menu lf-anchored lf-anchored--${layer}`} role="menu" aria-label={label}
      style={style} onKeyDown={onMenuKeyDown} data-overlay="menu">
      {items.map((item, index) => <button key={item.id} type="button" role="menuitem" className="lf-menu-item" data-index={index}
        data-copy-role="action" tabIndex={index === active ? 0 : -1} aria-disabled={item.disabled || undefined}
        onClick={() => choose(item)} onPointerMove={() => { if (!item.disabled && active !== index) setActive(index); }}>{item.label}</button>)}
    </div>, host!) : null}
  </>;
}

export interface TooltipTriggerProps {
  'aria-describedby': string;
  onPointerEnter: (event: React.PointerEvent) => void; onPointerLeave: () => void; onFocus: () => void; onBlur: () => void;
}

const SHOW_DELAY = 300;
const HIDE_GRACE = 150;

/**
 * A short supplementary description for a control (WCAG 1.4.13): it shows on
 * hover and on keyboard focus, stays while the pointer moves onto it, and
 * Escape hides it without moving focus. The same words are always the
 * trigger's accessible description, so nothing depends on seeing it; touch
 * devices, which cannot hover, lose nothing essential.
 */
export function Tooltip({ content, children }: { content: string; children: (props: TooltipTriggerProps) => ReactNode }) {
  const id = useId();
  const triggerId = `${id}-trigger`, descriptionId = `${id}-description`;
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<LayerKind>('nav');
  const timer = useRef<number>();
  const bubble = useRef<HTMLDivElement>(null);
  const host = useLayerHost(open);
  const ready = open && host !== null;
  useLayer(ready, host, false, () => setOpen(false));
  const { style } = useAnchoredPosition(open, triggerId, bubble, host, 'center');
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setLayer(layerOf(document.querySelector(`[data-tooltip-trigger="${triggerId}"]`))); setOpen(true); }, delay);
  };
  const hide = (delay: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), delay); };
  return <span className="lf-tooltip-anchor" id={triggerId} data-tooltip-trigger={triggerId}>
    {children({ 'aria-describedby': descriptionId,
      onPointerEnter: (event) => { if (event.pointerType === 'mouse') show(SHOW_DELAY); },
      onPointerLeave: () => hide(HIDE_GRACE),
      onFocus: () => show(0), onBlur: () => hide(0) })}
    <span id={descriptionId} hidden>{content}</span>
    {ready ? createPortal(<div ref={bubble} className={`lf-tooltip lf-anchored lf-anchored--${layer}`} aria-hidden="true" data-copy-role="body" data-overlay="tooltip"
      style={style} onPointerEnter={() => window.clearTimeout(timer.current)} onPointerLeave={() => hide(HIDE_GRACE)}>{content}</div>, host!) : null}
  </span>;
}
