import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './buttons';
import { useFocusTrap, useLayer, useLayerHost, useScrollLock } from './layers';
import './overlays.css';

/*
 * The modal sheet sits on a scrim, fixed to the viewport, traps focus, closes
 * on Escape, locks page scroll without moving it and makes the page behind it
 * inert; closing gives focus back to what opened it. It owns no string: every
 * label and every line of copy is passed in translated.
 */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** A modal sheet on the sheet layer (z 50), anchored to the bottom edge and the safe area. */
export function Sheet({ open, onClose, heading, closeLabel, children, footer }: SheetProps) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const host = useLayerHost(open, { layer: 'sheet' });
  // A host React already removed is not ready: under development double effects a render can still hold the first
  // host after its cleanup, and a focus trap run there focuses nothing.
  const ready = open && host !== null && host.isConnected;
  useLayer(ready, host, true, onClose);
  useScrollLock(ready);
  useFocusTrap(ready, panel);
  if (!open || !host) return null;
  return createPortal(<div className="lf-layer lf-layer--sheet lf-layer--sheet-bottom" data-overlay="sheet">
    <div className="lf-scrim" aria-hidden="true" onPointerDown={onClose} />
    <section ref={panel} className="lf-sheet lf-sheet--bottom" role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
      <header className="lf-sheet-header">
        <h2 id={`${id}-heading`} className="lf-sheet-heading" data-copy-role="heading">{heading}</h2>
        <IconButton glyph="close" label={closeLabel} onClick={onClose} className="lf-sheet-close" />
      </header>
      <div className="lf-sheet-body">{children}</div>
      {footer ? <footer className="lf-sheet-footer">{footer}</footer> : null}
    </section>
  </div>, host);
}
