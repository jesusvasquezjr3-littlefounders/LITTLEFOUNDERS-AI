import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadLessonClientDocument } from '../learning/lessonDocument';
import { previewFixtureSegment } from './registry/learn';

/*
 * GAP-FIX-R4 (Appendix P Part 8 DoD; Bible 05 §8): the audit lane stages every
 * v2 kind that had no audit state from its Forge fixture. Each staged segment
 * must load as a valid lesson in all three locales at its age (so the audits
 * measure a real board, never an invalid-document screen), and together they
 * must cover every kind the gap audit named.
 */
const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
type Surface = readonly [string, string, string];
const lane = await import(/* @vite-ignore */ pathToFileURL(resolve(__dirname, '../../../scripts/audits/lanes/learn.mjs')).href) as { fixtureSurfaces: Surface[] };
const fixtureSurfaces = lane.fixtureSurfaces;

describe('v2 fixture audit states', () => {
  it.each(fixtureSurfaces)('%s (%s at %s) loads as a valid lesson in every locale', (_name, seg, age) => {
    for (const locale of LOCALES) {
      const raw = previewFixtureSegment(locale, age, seg);
      expect(raw, `${seg} ${locale}`).not.toBeNull();
      expect(loadLessonClientDocument(raw).status, `${seg} ${locale}`).toBe('ready');
      // At any other age the preview shows nothing rather than a board outside its range.
      const other = age === '6-9' ? '13-17' : '6-9';
      expect(previewFixtureSegment(locale, other, seg)).toBeNull();
    }
  });

  it('covers every kind that had no audit state', () => {
    const types = new Set((fixtureSurfaces).map(([, seg, age]) => {
      const doc = previewFixtureSegment('en-US', age, seg) as { segments: Array<{ type: string; payload: Record<string, unknown> }> };
      const segment = doc.segments[0]!;
      return `${segment.type}${'mode' in segment.payload ? ':build' : ''}`;
    }));
    for (const kind of ['logic.rule-checker.v2', 'logic.euler.v2', 'logic.flowchart.v2', 'money.spend-decision.v2', 'money.spend-decision.v2:build',
      'logic.sort-by-rule.v2', 'money.needs-wants.v2', 'logic.scam-spotter.v2', 'money.scam-check.v2', 'money.coin-tray.v2', 'money.making-change.v2',
      'story.branch.v2', 'story.dialogue-choice.v2', 'story.would-you-rather.v2', 'voice.mentor-turn.v2', 'voice.mentor-episode.v2', 'money.unit-price.v2',
      'reasoning.decide-justify.v2', 'visual.chart.v2', 'money.amortization.v2', 'econ.supply-demand.v2', 'money.opportunity-cost.v2', 'money.inflation.v2',
      'money.rule-of-72.v2', 'money.debt-payoff.v2', 'money.diversification.v2', 'money.lemonade-stand.v2']) {
      expect(types, kind).toContain(kind);
    }
  });
});
