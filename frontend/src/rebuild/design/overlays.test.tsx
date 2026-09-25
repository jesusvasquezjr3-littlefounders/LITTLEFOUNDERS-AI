import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Button, ConfirmDialog, DestructiveAction, Dialog, Menu, Popover, RebuildProvider, Sheet, Tooltip, useAnnounce, useToast,
} from './controls';
import { layerStackSnapshot } from './layers';

/*
 * S03.2 overlay behaviour at the component boundary (Frontend Bible 02 rules
 * 12 and 13, §9.8, §11 item 10). The real-Chrome matrix
 * (scripts/verify-rebuild-shells.mjs) repeats these with real input and real
 * layout; these run in CI without a browser.
 */

const environment = { theme: 'dark' as const, locale: 'es-MX' as const, ageBand: '6-9' as const };
function Provider({ children }: { children: React.ReactNode }) {
  return <RebuildProvider environment={environment} labels={{ dismiss: 'Cerrar aviso' }}>{children}</RebuildProvider>;
}
// RTL mounts each render in its own <div> directly under <body>: that div is the page behind the overlay.
const appRoot = (container: HTMLElement) => container;
const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift });
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
});
afterEach(() => {
  // Unmounting everything must leave no layer, no inert page and no scroll lock behind.
  cleanup();
  expect(layerStackSnapshot().depth).toBe(0);
  expect(document.querySelector('[inert]')).toBeNull();
  expect(document.documentElement.style.overflow).toBe('');
});

function DialogHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return <Provider>
    <Button onClick={() => setOpen(true)}>Open</Button>
    <input aria-label="Behind" />
    <Dialog open={open} onClose={() => { onClose?.(); setOpen(false); }} heading="Meta semanal" description="Tu meta sigue guardada."
      actions={<><Button onClick={() => setOpen(false)}>Cancelar</Button><Button variant="accent">Listo</Button></>} />
  </Provider>;
}

describe('dialog', () => {
  it('renders in a body-level host that carries the theme, language and age band', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    const host = dialog.closest('.lf-layer-root') as HTMLElement;
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.theme).toBe('dark');
    expect(host.lang).toBe('es-MX');
    expect(host.dataset.ageBand).toBe('6-9');
    expect(host.dataset.layer).toBe('scrim');
    expect(dialog.closest('.lf-layer')?.classList.contains('lf-layer--scrim')).toBe(true);
  });

  it('names itself, states the consequence in words, traps focus and gives it back', () => {
    const { container } = render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Meta semanal');
    expect(dialog).toHaveAccessibleDescription('Tu meta sigue guardada.');
    const [first, last] = [screen.getByRole('button', { name: 'Cancelar' }), screen.getByRole('button', { name: 'Listo' })];
    expect(document.activeElement).toBe(first);
    tab();
    tab(true);
    // From the first control, Shift+Tab wraps to the last; from the last, Tab wraps to the first.
    first.focus(); tab(true); expect(document.activeElement).toBe(last);
    tab(); expect(document.activeElement).toBe(first);
    // The page behind is inert and does not scroll; the page does not move.
    expect(appRoot(container)).toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('hidden');
    escape();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(appRoot(container)).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('restores the exact scroll position if anything moved the page while it was open', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 });
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    escape();
    expect(scrollTo).toHaveBeenCalledWith(0, 640);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('closes when the scrim is pressed', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.pointerDown(document.querySelector('.lf-dialog-frame')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never makes the announcer or the toast region inert', () => {
    const { container } = render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const live = [...document.body.children].filter((child) => (child as HTMLElement).dataset.lfLive === 'true');
    expect(live).toHaveLength(2);
    for (const host of live) expect(host).not.toHaveAttribute('inert');
    expect(appRoot(container)).toHaveAttribute('inert');
    escape();
  });
});

describe('confirmation', () => {
  it('offers keep first, focuses it, and keeps on Escape and on the scrim', () => {
    const onKeep = vi.fn(), onConfirm = vi.fn();
    render(<Provider><ConfirmDialog open destructive heading="¿Quitar esta meta?" consequence="Sus 10 monedas vuelven a Ahorrar."
      keepLabel="Conservar meta" confirmLabel="Quitar meta" onKeep={onKeep} onConfirm={onConfirm} /></Provider>);
    const dialog = screen.getByRole('alertdialog');
    const buttons = [...dialog.querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent)).toEqual(['Conservar meta', 'Quitar meta']);
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[1]).toHaveClass('lf-button--danger');
    escape();
    fireEvent.pointerDown(document.querySelector('.lf-dialog-frame')!);
    expect(onKeep).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while the confirmed request is in flight', () => {
    const onKeep = vi.fn();
    render(<Provider><ConfirmDialog open pending heading="¿Quitar?" consequence="Se quita." keepLabel="Conservar" confirmLabel="Quitar"
      pendingLabel="Quitando…" onKeep={onKeep} onConfirm={() => undefined} /></Provider>);
    escape();
    expect(onKeep).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quitando…' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Conservar' })).toBeDisabled();
  });

  it('a destructive action runs only after it is confirmed, and keeping runs nothing', async () => {
    const onConfirm = vi.fn();
    render(<Provider><DestructiveAction label="Quitar meta" onConfirm={onConfirm}
      confirm={{ heading: '¿Quitar esta meta?', consequence: 'Sus monedas vuelven.', keepLabel: 'Conservar meta', confirmLabel: 'Quitar' }} /></Provider>);
    const trigger = screen.getByRole('button', { name: 'Quitar meta' });
    expect(trigger).toHaveClass('lf-button--danger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Conservar meta' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(trigger);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Quitar' })); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

function SheetHarness() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const removeLabel = 'Quitar meta';
  return <Provider>
    <Button onClick={() => setSheet(true)}>Detalles</Button>
    <Sheet open={sheet} onClose={() => setSheet(false)} heading="¿Por qué monedas?" closeLabel="Cerrar"
      footer={<Button onClick={() => setConfirm(true)}>{removeLabel}</Button>}>
      <p data-copy-role="body">Las monedas son una simulación.</p>
    </Sheet>
    <ConfirmDialog open={confirm} heading="¿Quitar?" consequence="Se quita." keepLabel="Conservar" confirmLabel="Quitar"
      onKeep={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />
  </Provider>;
}

describe('sheet and stacking', () => {
  it('sits on the sheet layer, and a dialog opened from it stacks above and closes first', () => {
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Detalles' });
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: '¿Por qué monedas?' });
    const sheetHost = sheet.closest('.lf-layer-root') as HTMLElement;
    expect(sheetHost.dataset.layer).toBe('sheet');
    expect(sheet).toHaveClass('lf-sheet--bottom');
    const opener = screen.getByRole('button', { name: 'Quitar meta' });
    opener.focus();
    fireEvent.click(opener);
    expect(layerStackSnapshot()).toEqual({ depth: 2, topModal: true });
    expect(sheetHost).toHaveAttribute('inert');
    escape();
    // Only the dialog closed; the sheet is live again and focus is back on the control that opened the dialog.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: '¿Por qué monedas?' })).toBeInTheDocument();
    expect(sheetHost).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(opener);
    escape();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('has a named close control', () => {
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Detalles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('anchored layers', () => {
  it('popover: expands, moves focus in, closes on Escape back to its trigger and on an outside press', () => {
    render(<Provider>
      <Popover label="¿Por qué?" trigger={(props) => <Button {...props}>¿Por qué?</Button>}>
        <p data-copy-role="body">Un adulto aprueba cada tarea.</p>
      </Popover>
      <Button>Fuera</Button>
    </Provider>);
    const trigger = screen.getByRole('button', { name: '¿Por qué?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: '¿Por qué?' });
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(document.activeElement).toBe(panel);
    expect(panel).toHaveClass('lf-anchored--nav');
    escape();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('menu: arrow keys, Home/End and typeahead move, disabled items are skipped, choosing closes and returns focus', () => {
    const edit = vi.fn(), share = vi.fn();
    render(<Provider><Menu label="Más acciones" items={[
      { id: 'edit', label: 'Editar meta', onSelect: edit },
      { id: 'archive', label: 'Archivar meta', onSelect: () => undefined, disabled: true },
      { id: 'pause', label: 'Pausar meta', onSelect: () => undefined },
      { id: 'share', label: 'Compartir meta', onSelect: share },
    ]} trigger={(props) => <Button {...props}>{'Más acciones'}</Button>} /></Provider>);
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAccessibleName('Más acciones');
    const item = (name: string) => screen.getByRole('menuitem', { name });
    expect(document.activeElement).toBe(item('Editar meta'));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Pausar meta'));
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(item('Compartir meta'));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Editar meta'));
    fireEvent.keyDown(menu, { key: 'p' });
    expect(document.activeElement).toBe(item('Pausar meta'));
    expect(item('Archivar meta')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(item('Archivar meta'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(item('Compartir meta'));
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Compartir meta'));
    escape();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(edit).not.toHaveBeenCalled();
  });

  it('tooltip: always the trigger’s description, shown on focus, hidden by Escape without moving focus', () => {
    vi.useFakeTimers();
    try {
      render(<Provider><Tooltip content="Las monedas son una simulación.">
        {(props) => <button type="button" aria-label="Sobre las monedas" {...props} />}
      </Tooltip></Provider>);
      const trigger = screen.getByRole('button', { name: 'Sobre las monedas' });
      expect(trigger).toHaveAccessibleDescription('Las monedas son una simulación.');
      act(() => { trigger.focus(); fireEvent.focus(trigger); vi.advanceTimersByTime(1); });
      const bubble = document.querySelector('.lf-tooltip')!;
      expect(bubble.textContent).toBe('Las monedas son una simulación.');
      expect(bubble).toHaveAttribute('data-copy-role', 'body');
      act(() => { escape(); });
      expect(document.querySelector('.lf-tooltip')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally { vi.useRealTimers(); }
  });
});

function ToastHarness() {
  const toast = useToast();
  const announce = useAnnounce();
  return <>
    <Button onClick={() => toast.show({ tone: 'success', message: 'Meta guardada.', duration: 1000 })}>Guardar</Button>
    <Button onClick={() => toast.show({ tone: 'error', message: 'No se pudo guardar.' , duration: 1000 })}>Error</Button>
    <Button onClick={() => toast.show({ tone: 'info', message: 'Guardado.', action: { label: 'Deshacer', onPress: () => announce('Listo.') } })}>Acción</Button>
  </>;
}

describe('toasts and the announcer', () => {
  it('announces politely or assertively, leaves on time, and keeps a toast with an action', () => {
    vi.useFakeTimers();
    try {
      render(<Provider><ToastHarness /></Provider>);
      const polite = document.querySelector('[data-politeness="polite"]')!, assertive = document.querySelector('[data-politeness="assertive"]')!;
      expect(polite).toHaveAttribute('aria-live', 'polite');
      expect(assertive).toHaveAttribute('aria-live', 'assertive');
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); vi.advanceTimersByTime(100); });
      expect(polite.textContent).toBe('Meta guardada.');
      const region = document.querySelector('.lf-toast-region') as HTMLElement;
      expect(region.closest('.lf-layer-root')?.getAttribute('data-layer')).toBe('toast');
      expect(region.querySelector('.lf-toast--success')?.textContent).toContain('Meta guardada.');
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Error' })); vi.advanceTimersByTime(100); });
      expect(assertive.textContent).toBe('No se pudo guardar.');
      act(() => { vi.advanceTimersByTime(1000); });
      expect(document.querySelector('.lf-toast')).toBeNull();
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Acción' })); vi.advanceTimersByTime(20000); });
      expect(document.querySelector('.lf-toast--info')).not.toBeNull();
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Deshacer' })); vi.advanceTimersByTime(100); });
      expect(document.querySelector('.lf-toast--info')).toBeNull();
      expect(polite.textContent).toBe('Listo.');
      for (let n = 0; n < 5; n++) act(() => { fireEvent.click(screen.getByRole('button', { name: 'Acción' })); });
      expect(document.querySelectorAll('.lf-toast')).toHaveLength(3);
      act(() => { for (const close of screen.getAllByRole('button', { name: 'Cerrar aviso' })) fireEvent.click(close); });
      expect(document.querySelector('.lf-toast')).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
