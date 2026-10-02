import { describe, expect, it, vi } from 'vitest';
import type { HorizonteCopy } from '../boardTypes';
import { HORIZONTE_BOARDS } from '../registry';
import { assertCopyContract, handleRuleProblems, motionProblems } from './boardContract';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

describe('board contract: motion', () => {
  it('accepts motion under no-preference with the motion tokens', () => {
    const css = '@media (prefers-reduced-motion: no-preference) { .a { transition: transform var(--dur-component) var(--ease-standard); } }';
    expect(motionProblems(css)).toEqual([]);
  });

  it('refuses motion outside no-preference, a spring or bezier curve and a long duration', () => {
    expect(motionProblems('.a { transition: transform 200ms; }')).toHaveLength(1);
    expect(motionProblems('.a { animation: pop 200ms; }')).toHaveLength(1);
    const curve = '@media (prefers-reduced-motion: no-preference) { .a { transition: transform 200ms cubic-bezier(0.3, 1.6, 0.5, 1); } }';
    expect(motionProblems(curve).map((problem) => problem.problem)).toEqual(['a spring or bezier curve (use var(--ease-standard))']);
    const slow = '@media (prefers-reduced-motion: no-preference) { .a { transition: opacity 0.6s; } }';
    expect(motionProblems(slow).map((problem) => problem.problem)).toEqual(['longer than 250 ms (use var(--dur-component))']);
  });

  it('ignores comments and rules that do not move', () => {
    expect(motionProblems('/* transition: all 9s */ .a { color: red; }')).toEqual([]);
  });
});

describe('board contract: 64 px handle rule', () => {
  const good = ':root { --hz-hit: 64px; } .lf-hz-handle { display: inline-flex; min-inline-size: var(--hz-hit); min-block-size: var(--hz-hit); }';
  it('accepts the shared rule', () => expect(handleRuleProblems(good)).toEqual([]));
  it('refuses a smaller hit size and a handle rule that ignores it', () => {
    expect(handleRuleProblems(good.replace('64px', '44px'))).toHaveLength(1);
    expect(handleRuleProblems(good.replace('min-block-size: var(--hz-hit)', 'min-block-size: 20px'))).toHaveLength(1);
  });
});

describe('board contract: copy and declarations', () => {
  const entry = { role: 'action', 'en-US': 'Show table', 'es-MX': 'Mostrar tabla', 'pt-BR': 'Mostrar tabela' } as const;
  it('accepts a role, three versions and the Copy Budget', () => expect(() => assertCopyContract({ show: entry } satisfies HorizonteCopy)).not.toThrow());
  it('refuses an unknown role, a missing locale and an over-budget string', () => {
    expect(() => assertCopyContract({ show: { ...entry, role: 'label' } } as unknown as HorizonteCopy)).toThrow();
    expect(() => assertCopyContract({ show: { ...entry, 'pt-BR': '' } })).toThrow();
    expect(() => assertCopyContract({ show: { ...entry, 'en-US': 'Show every single counter in a long table' } })).toThrow();
  });

  it('every registered board declares an ICAP level and a chunk budget in range', () => {
    for (const [type, board] of Object.entries(HORIZONTE_BOARDS)) {
      expect(['passive', 'active', 'constructive', 'interactive'], type).toContain(board.icap);
      expect(Number.isInteger(board.chunkBudgetKb) && board.chunkBudgetKb > 0 && board.chunkBudgetKb <= 60, type).toBe(true);
    }
  });
});
