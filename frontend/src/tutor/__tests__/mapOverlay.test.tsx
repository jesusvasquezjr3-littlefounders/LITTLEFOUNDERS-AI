import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapOverlay } from '../MapOverlay';
import type { TutorMapResponse } from '../tutorApi';

/*
 * THE MAP, OPENED MID-CONVERSATION (Sprint 3, /TUTOR_INSTRUMENTS.md).
 *
 * A portal over the whole scene, not a coexisting layout element — so what
 * matters here is that it closes every way a real dialog must (Escape,
 * backdrop, its own button) and that it never lets a tap start a session
 * mid-conversation, which is exactly what `MapGraph`'s own `onPick` does in
 * `introducing`.
 */

const MAP: TutorMapResponse = {
  nodes: [
    { kcId: '1', kcKey: 'k1', strand: 'money_math', title: 'Contar dinero', state: 'available', mastery: null, attempts: 0, skillKey: 'financial-education/contar-dinero' },
    { kcId: '2', kcKey: 'k2', strand: 'money_math', title: 'Dar cambio', state: 'locked', mastery: null, attempts: 0, skillKey: null },
  ],
  edges: [{ from: '1', to: '2' }],
  continueTarget: null,
  review: { count: 0 },
};

describe('the map opened mid-conversation', () => {
  it('renders every node read-only — a tap must never start a session over a live one', () => {
    render(<MapOverlay map={MAP} onClose={vi.fn()} />);
    const available = screen.getByRole('button', { name: /Contar dinero/ });
    expect(available).toBeDisabled();
    const locked = screen.getByRole('button', { name: /Dar cambio/ });
    expect(locked).toBeDisabled();
  });

  it('closes on its own close button', () => {
    const onClose = vi.fn();
    render(<MapOverlay map={MAP} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click, not on a click inside the sheet', () => {
    const onClose = vi.fn();
    render(<MapOverlay map={MAP} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<MapOverlay map={MAP} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is a real dialog: labelled, modal, and reachable by an accessible name', () => {
    render(<MapOverlay map={MAP} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'My island' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
