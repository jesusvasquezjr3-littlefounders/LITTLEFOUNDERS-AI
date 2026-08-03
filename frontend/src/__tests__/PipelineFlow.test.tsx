import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@/i18n';
import { PipelineFlow } from '@/routes/admin/PipelineFlow';

/** A settled mount is a handful of renders; anything beyond this is a loop. */
const RENDER_LIMIT = 25;

/*
 * Regression guard for a render loop that pegged /admin/generation in its
 * DEFAULT state (no active run).
 *
 * PipelineFlow computed `heartbeat?.stageBreakdown ?? {}` during render and
 * used it as a useEffect dependency. A fresh object literal has a fresh
 * identity every render, so the effect re-ran every render, called
 * setNodes/setEdges, re-rendered, allocated another {} … forever.
 *
 * Counting has to happen INSIDE PipelineFlow, not in a wrapper: setNodes only
 * re-renders PipelineFlow itself, so a parent-level counter would sit at 1 no
 * matter how hard the child spun. `useNodesState` is called on every one of
 * its renders, which makes the mock the honest place to count.
 *
 * Unlike AdminGenerationPage.test.tsx — which stubs these hooks with inert
 * vi.fn() setters, so a loop could never surface there — these are backed by
 * REAL useState. The setters must actually drive re-renders for the loop to be
 * observable at all.
 */
let renderCount = 0;

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    ReactFlow: () => null,
    Handle: () => null,
    Background: () => null,
    Controls: () => null,
    Position: { Left: 'left', Right: 'right' },
    MarkerType: { ArrowClosed: 'arrowclosed' },
    useNodesState: (initial: unknown[]) => {
      renderCount += 1;
      // Trip deterministically rather than letting the runaway exhaust the
      // heap — an OOM kills the vitest worker and reads like flakiness
      // instead of a failure. React's own update-depth guard never fires here
      // because the loop is driven from useEffect, not from render.
      if (renderCount > RENDER_LIMIT) throw new Error(`render loop: ${renderCount} renders`);
      const [nodes, setNodes] = React.useState(initial);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (initial: unknown[]) => {
      const [edges, setEdges] = React.useState(initial);
      return [edges, setEdges];
    },
  };
});
vi.mock('@xyflow/react/dist/style.css', () => ({}));

beforeEach(() => {
  renderCount = 0;
});

describe('PipelineFlow render stability', () => {
  it('settles instead of looping when there is no heartbeat (the default state)', () => {
    expect(() => render(<PipelineFlow heartbeat={null} />)).not.toThrow();
    expect(renderCount).toBeLessThanOrEqual(RENDER_LIMIT);
  });

  it('settles when a heartbeat arrives and its counts do not change', () => {
    const heartbeat = {
      runId: 'run-1',
      courseSlug: 'demo',
      stageBreakdown: { writing: 2, reviewing: 1 },
      activeSlots: 3,
      completedSlots: 0,
      failedSlots: 0,
      totalSlots: 10,
      tokensUsed: 0,
      usdUsed: 0,
      imagesGenerated: 0,
      updatedAt: new Date(0).toISOString(),
    } as unknown as Parameters<typeof PipelineFlow>[0]['heartbeat'];

    expect(() => render(<PipelineFlow heartbeat={heartbeat} />)).not.toThrow();
    expect(renderCount).toBeLessThanOrEqual(RENDER_LIMIT);
  });
});
