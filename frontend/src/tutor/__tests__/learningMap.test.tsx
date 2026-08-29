import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { layoutMap } from '../map/mapLayout';
import { MapGraph } from '../map/MapGraph';
import type { TutorMapNode, TutorMapResponse } from '../tutorApi';

/*
 * The learning map (Tutor v3): the layout is deterministic arithmetic, the
 * graph is a list of real buttons (the SR twin is the DOM itself), and a
 * locked node NAMES its prerequisite instead of merely refusing.
 */

function node(overrides: Partial<TutorMapNode>): TutorMapNode {
  return {
    kcId: '00000000-0000-4000-a000-000000000001',
    kcKey: 'money.count-mixed-coins',
    strand: 'money_math',
    title: 'Contar dinero mezclado',
    state: 'available',
    mastery: null,
    attempts: 0,
    skillKey: null,
    ...overrides,
  };
}

const MAP: TutorMapResponse = {
  nodes: [
    node({ kcKey: 'money.count-mixed-coins', title: 'Contar dinero mezclado', state: 'in_progress', attempts: 2, mastery: 0.6 }),
    node({
      kcId: '00000000-0000-4000-a000-000000000002',
      kcKey: 'money.make-change-counting-up',
      title: 'Dar cambio',
      state: 'locked',
    }),
    node({
      kcId: '00000000-0000-4000-a000-000000000003',
      kcKey: 'biz.needs-vs-wants',
      title: 'Necesidades y deseos',
      state: 'mastered',
      attempts: 5,
      mastery: 0.9,
      skillKey: 'entrepreneurship/necesidades',
    }),
  ],
  edges: [{ from: 'money.count-mixed-coins', to: 'money.make-change-counting-up' }],
  continueTarget: { kcKey: 'money.count-mixed-coins', title: 'Contar dinero mezclado', reason: 'frontier', skillKey: null },
  review: { count: 0 },
};

describe('layoutMap', () => {
  it('layers by prerequisite depth, deterministically', () => {
    const layout = layoutMap(MAP.nodes, MAP.edges);
    const rowOf = (key: string) => layout.nodes.find((n) => n.node.kcKey === key)?.row;
    expect(rowOf('money.count-mixed-coins')).toBe(0);
    expect(rowOf('biz.needs-vs-wants')).toBe(0);
    expect(rowOf('money.make-change-counting-up')).toBe(1);
    expect(layout.rows).toBe(2);
    // Same input, same layout — no randomness anywhere.
    expect(layoutMap(MAP.nodes, MAP.edges)).toEqual(layout);
  });

  it('drops edges whose endpoints are missing and survives a cycle defensively', () => {
    const layout = layoutMap(MAP.nodes, [
      ...MAP.edges,
      { from: 'ghost', to: 'money.count-mixed-coins' },
    ]);
    expect(layout.edges).toEqual(MAP.edges);
    const cyclic = layoutMap(MAP.nodes, [
      { from: 'money.count-mixed-coins', to: 'biz.needs-vs-wants' },
      { from: 'biz.needs-vs-wants', to: 'money.count-mixed-coins' },
    ]);
    expect(cyclic.nodes).toHaveLength(3); // no hang, every node placed
  });
});

describe('MapGraph', () => {
  it('a locked node is disabled and names its prerequisite; startable nodes start', () => {
    const onPick = vi.fn();
    render(<MapGraph map={MAP} onPick={onPick} />);

    const locked = screen.getByRole('button', { name: /Dar cambio/ });
    expect(locked).toBeDisabled();
    expect(locked.getAttribute('aria-label')).toContain('Contar dinero mezclado');

    const startable = screen.getByRole('button', { name: /^Contar dinero mezclado/ });
    fireEvent.click(startable);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kcKey: 'money.count-mixed-coins' }));

    // Mastered nodes celebrate; they do not restart.
    expect(screen.getByRole('button', { name: /Necesidades y deseos/ })).toBeDisabled();
  });
});
