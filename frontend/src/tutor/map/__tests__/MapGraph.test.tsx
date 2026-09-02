import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapGraph } from '../MapGraph';
import type { TutorMapNode, TutorMapResponse } from '../../tutorApi';

/*
 * Found by adversarial review, 2026-08-30 (MEDIUM): a locked node with
 * SEVERAL prerequisites named whichever one happened to be first in
 * `map.edges`' array order, which could be one the learner has already
 * mastered while the real blocker went unmentioned — a false statement
 * about the child's own progress, read out through the accessible name.
 */

function node(overrides: Partial<TutorMapNode>): TutorMapNode {
  return {
    kcId: overrides.kcKey ?? 'x',
    kcKey: 'x',
    strand: 'money_math',
    title: 'X',
    state: 'available',
    mastery: null,
    attempts: 0,
    skillKey: null,
    ...overrides,
  };
}

describe('MapGraph — naming the prerequisite that actually blocks a node', () => {
  it('names the LOWEST-mastery prerequisite, not the first one listed', () => {
    const mastered = node({ kcKey: 'counting', title: 'Contar monedas', state: 'mastered', mastery: 0.95 });
    const unmet = node({ kcKey: 'subtracting', title: 'Restar dinero', state: 'available', mastery: 0.3 });
    const locked = node({ kcKey: 'change', title: 'Dar cambio', state: 'locked', mastery: null });

    const map: TutorMapResponse = {
      nodes: [mastered, unmet, locked],
      // The ALREADY-MASTERED prerequisite is listed FIRST on purpose — this
      // is exactly the array order that made the pre-fix code point at it.
      edges: [
        { from: 'counting', to: 'change' },
        { from: 'subtracting', to: 'change' },
      ],
      continueTarget: null,
      review: { count: 0 },
    };

    render(<MapGraph map={map} onPick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /Dar cambio/ });
    expect(button).toHaveAccessibleName(expect.stringContaining('Restar dinero'));
    expect(button).not.toHaveAccessibleName(expect.stringContaining('Contar monedas'));
  });

  it('treats a prerequisite with no evidence at all as the weakest of all', () => {
    const someEvidence = node({ kcKey: 'a', title: 'A', state: 'available', mastery: 0.1 });
    const noEvidence = node({ kcKey: 'b', title: 'B', state: 'available', mastery: null });
    const locked = node({ kcKey: 'c', title: 'C', state: 'locked', mastery: null });

    const map: TutorMapResponse = {
      nodes: [someEvidence, noEvidence, locked],
      edges: [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ],
      continueTarget: null,
      review: { count: 0 },
    };

    render(<MapGraph map={map} onPick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /^C\./ });
    expect(button).toHaveAccessibleName(expect.stringContaining('B'));
  });
});

/*
 * THE NODE IS AS WIDE AS THE CATALOG NEEDS, AND THE CANVAS IS AS WIDE AS THE
 * WIDEST ROW OF THEM NEEDS.
 *
 * Found live, 2026-09-02, es-MX at both breakpoints /AGENTS.md §1.11 mandates
 * (TUTOR_QA_2026-09-02 D1): at `w-24` the map read `Dar cambio contando…` and
 * `Lo que queda: la…`, because 80px of text after `p-2` holds ~26 characters
 * over `line-clamp-2` and es-MX runs to 32 (pt-BR to 33). The width is now
 * measured against all 84 real catalog titles rather than fitted to English —
 * see `NODE_WIDTH_PX`'s own comment for the table.
 *
 * jsdom has no layout engine, so this cannot assert wrapping the way the live
 * measurement did. What it CAN pin is the geometry contract that makes the
 * live result reproducible: the node's own width, and that the canvas is
 * always wide enough for the widest row's nodes to stand apart rather than
 * overlap. The old flat `min-w-[560px]` was sized for 96px nodes at four per
 * row and silently stacks titles on top of each other at anything wider.
 */
describe('MapGraph — the node is sized to the catalog, not to English', () => {
  function row(count: number): TutorMapResponse {
    return {
      nodes: Array.from({ length: count }, (_, i) =>
        node({ kcKey: `n${i}`, kcId: `n${i}`, title: `Node ${i}` }),
      ),
      edges: [],
      continueTarget: null,
      review: { count: 0 },
    };
  }

  it('gives every node the measured 144px, so the longest real title fits in two lines', () => {
    render(<MapGraph map={row(3)} onPick={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.style.width).toBe('144px');
    }
  });

  it('widens the canvas so the widest row cannot overlap, rather than pinning one number', () => {
    // Four per row is what every tier of the real graph tops out at: 4 nodes
    // x (144 + 16) = 640px, which is past the 560px floor.
    const { container, rerender } = render(<MapGraph map={row(4)} onPick={vi.fn()} />);
    const canvas = () => container.querySelector<HTMLElement>('.relative');
    expect(canvas()?.style.minWidth).toBe('640px');

    // A fifth would have overlapped under the old flat number; it widens now.
    rerender(<MapGraph map={row(5)} onPick={vi.fn()} />);
    expect(canvas()?.style.minWidth).toBe('800px');

    // And a narrow graph keeps the 560px floor rather than collapsing to a
    // strip: two nodes at their own pitch would be 320px.
    rerender(<MapGraph map={row(2)} onPick={vi.fn()} />);
    expect(canvas()?.style.minWidth).toBe('560px');
  });
});
