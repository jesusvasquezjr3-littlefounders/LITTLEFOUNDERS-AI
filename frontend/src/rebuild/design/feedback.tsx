import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './buttons';
import { Glyph, type GlyphName } from './glyphs';
import { RebuildEnvironmentContext, useLayerHost, type RebuildEnvironment } from './layers';

/*
 * Feedback that is not in the page flow (Frontend Bible 02 §9.2, §9.8; S03.2):
 * a persistent polite/assertive announcer, and toasts on the top layer (z 70)
 * that are announced through it. Both live in body-level hosts that are never
 * made inert, so an announcement made while a dialog is open is still heard.
 */

export type Politeness = 'polite' | 'assertive';
type Announce = (message: string, politeness?: Politeness) => void;

const AnnouncerContext = createContext<Announce | null>(null);

/**
 * Two live regions that exist before anything is announced (a region created
 * at the moment of the message is often not read). The text is cleared first
 * so the same message twice is announced twice.
 */
function Announcer({ children }: { children: ReactNode }) {
  const host = useLayerHost(true, { live: true });
  const [messages, setMessages] = useState<Record<Politeness, string>>({ polite: '', assertive: '' });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    setMessages((current) => ({ ...current, [politeness]: '' }));
    timers.current.push(window.setTimeout(() => setMessages((current) => ({ ...current, [politeness]: message })), 60));
  }, []);
  return <AnnouncerContext.Provider value={announce}>
    {children}
    {host ? createPortal(<div className="lf-announcer" data-announcer="true">
      <div role="status" aria-live="polite" aria-atomic="true" data-politeness="polite">{messages.polite}</div>
      <div aria-live="assertive" aria-atomic="true" data-politeness="assertive">{messages.assertive}</div>
    </div>, host) : null}
  </AnnouncerContext.Provider>;
}

/** Announce a message to assistive technology. Polite by default; assertive only for errors that block the person. */
export function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);
  if (!announce) throw new Error('useAnnounce needs a RebuildProvider above it');
  return announce;
}

export type ToastTone = 'success' | 'info' | 'error';
export interface ToastOptions {
  tone: ToastTone;
  message: string;
  /** One follow-up action. A toast with an action stays until it is dismissed. */
  action?: { label: string; onPress: () => void };
  /** Milliseconds before it leaves; paused while hovered or focused. Ignored when there is an action. */
  duration?: number;
}
interface ToastRecord extends ToastOptions { id: number }

const toastGlyph: Record<ToastTone, GlyphName> = { success: 'check', info: 'info', error: 'warning' };
const DEFAULT_DURATION = 6000;
const MAX_TOASTS = 3;

const ToastContext = createContext<{ show: (toast: ToastOptions) => number; dismiss: (id: number) => void } | null>(null);

function ToastView({ toast, dismissLabel, onDismiss }: { toast: ToastRecord; dismissLabel: string; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (toast.action || paused) return;
    const timer = window.setTimeout(onDismiss, toast.duration ?? DEFAULT_DURATION);
    return () => window.clearTimeout(timer);
  }, [paused, toast]);
  return <div className={`lf-toast lf-toast--${toast.tone}`} data-toast-tone={toast.tone}
    onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <Glyph name={toastGlyph[toast.tone]} />
    <p className="lf-toast-text" data-copy-role="body">{toast.message}</p>
    {toast.action ? <Button size="sm" variant="inverse" onClick={() => { toast.action!.onPress(); onDismiss(); }}>{toast.action.label}</Button> : null}
    <IconButton glyph="close" label={dismissLabel} variant="inverse" onClick={onDismiss} />
  </div>;
}

/**
 * Toasts sit above whatever is docked to the bottom edge (the learner tab bar,
 * the sticky call to action), so they never cover navigation; with nothing
 * docked they sit above the safe area.
 */
function useDockOffset(active: boolean) {
  const [dock, setDock] = useState(0);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      let height = 0;
      for (const element of document.querySelectorAll<HTMLElement>('[data-dock]')) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom >= window.innerHeight - 1) height = Math.max(height, window.innerHeight - rect.top);
      }
      setDock(Math.round(height));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [active]);
  return dock > 0 ? `calc(${dock}px + var(--spacing-3))` : 'calc(var(--spacing-4) + env(safe-area-inset-bottom, 0px))';
}

function ToastRegion({ dismissLabel, children }: { dismissLabel: string; children: ReactNode }) {
  const announce = useAnnounce();
  const host = useLayerHost(true, { live: true, layer: 'toast' });
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((toast: ToastOptions) => {
    const id = next.current++;
    setToasts((current) => [...current, { ...toast, id }].slice(-MAX_TOASTS));
    announce(toast.message, toast.tone === 'error' ? 'assertive' : 'polite');
    return id;
  }, [announce]);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const dockOffset = useDockOffset(toasts.length > 0);
  return <ToastContext.Provider value={value}>
    {children}
    {host && toasts.length ? createPortal(<div className="lf-toast-region" data-overlay="toasts" style={{ insetBlockEnd: dockOffset }}>
      {toasts.map((toast) => <ToastView key={toast.id} toast={toast} dismissLabel={dismissLabel} onDismiss={() => dismiss(toast.id)} />)}
    </div>, host) : null}
  </ToastContext.Provider>;
}

/** Shows a toast: a short confirmation of something that already happened, never the only record of it. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast needs a RebuildProvider above it');
  return context;
}

/**
 * The environment every rebuilt surface renders inside: its theme, language and
 * age band (for overlay hosts outside its DOM), the announcer and the toasts.
 */
export function RebuildProvider({ environment, labels, children }: {
  environment: RebuildEnvironment;
  /** The toast dismiss button's accessible name, translated. */
  labels: { dismiss: string };
  children: ReactNode;
}) {
  const value = useMemo(() => environment, [environment.theme, environment.locale, environment.ageBand]);
  return <RebuildEnvironmentContext.Provider value={value}>
    <Announcer><ToastRegion dismissLabel={labels.dismiss}>{children}</ToastRegion></Announcer>
  </RebuildEnvironmentContext.Provider>;
}
