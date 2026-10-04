import { describe, expect, it, vi } from 'vitest';
import type { HorizonteCopy } from '../boardTypes';
import { HORIZONTE_BOARDS } from '../registry';
import { assertCopyContract, handleRuleProblems, hitSizedRuleProblems, motionProblems, svgHitProblems, tapTargetCssProblems } from './boardContract';

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

describe('board contract: SVG tap targets', () => {
  const svgOf = (style: string, hit: string, className = 'lf-hz-hit-sized') => {
    const host = document.createElement('div');
    host.innerHTML = `<svg class="${className}" style="${style}" viewBox="0 0 240 300"><g role="button" aria-label="bead"><rect ${hit} /></g></svg>`;
    return host.firstElementChild!;
  };
  const rule = '.lf-hz-hit-sized { min-inline-size: calc(var(--hz-hit-span) * var(--target-base)); max-inline-size: calc(var(--hz-hit-span) * var(--target-lg)); }';

  it('accepts the shared rule and refuses one that leaves the width free of the hit size', () => {
    expect(hitSizedRuleProblems(rule)).toEqual([]);
    expect(hitSizedRuleProblems('.lf-hz-hit-sized { min-inline-size: 16rem; }')).toHaveLength(2);
    expect(hitSizedRuleProblems('')).toHaveLength(2);
  });

  it('accepts a drawing whose smallest hit renders at the base tier and refuses a smaller one', () => {
    expect(svgHitProblems(svgOf('--hz-hit-span: 6.67', 'width="88" height="36"'))).toEqual([]);
    expect(svgHitProblems(svgOf('--hz-hit-span: 6.67', 'width="88" height="20"'))).toHaveLength(1);
    expect(svgHitProblems(svgOf('--hz-hit-span: 3', 'width="88" height="36"'))).toHaveLength(1);
  });

  it('refuses a drawing that does not size itself from its hit', () => {
    expect(svgHitProblems(svgOf('', 'width="88" height="36"'))).toHaveLength(1);
    expect(svgHitProblems(svgOf('--hz-hit-span: 6.67', 'width="88" height="36"', 'lf-aba'))).toHaveLength(1);
  });

  it('flags a literal minimum under 56 px on a named control and lets tokens and other selectors through', () => {
    const selectors = ['.cell', '.cell button'];
    expect(tapTargetCssProblems('.cell { min-block-size: 2.75rem; }', selectors)).toHaveLength(1);
    expect(tapTargetCssProblems('.cell button { min-inline-size: 44px; }', selectors)).toHaveLength(1);
    expect(tapTargetCssProblems('.a, .cell { grid-template-columns: auto repeat(3, minmax(2.75rem, 4rem)); }', selectors)).toHaveLength(1);
    expect(tapTargetCssProblems('.cell { min-block-size: var(--target-base); min-inline-size: 3.5rem; }', selectors)).toEqual([]);
    expect(tapTargetCssProblems('.other { min-block-size: 1rem; } .cell { grid-template-rows: 1.5rem; }', selectors)).toEqual([]);
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
