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
