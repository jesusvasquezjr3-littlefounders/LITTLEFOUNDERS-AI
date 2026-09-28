import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RebuildRoot } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';
import { PIZARRON_VISUALS } from '../../../learning/pizarron';
import { boardFixtures } from '../boardFixtures';
import { MentorBoard, type MentorBoardCopy } from '../MentorBoard';
import { BOARD_RENDERERS } from '../boardVisuals';

/*
 * B.7 / Frontend Bible 08 §2 layer 4 and 05: the Mentor's board draws every
 * Oracle whiteboard kind with the shared Pizarrón visual for its concept, keeps
 * Oracle's values as given, keeps the table as the accessible alternative, and
 * follows the board hue rules (series only sky, mint, berry, then the neutral
 * overflow; never primary or accent as data).
 */

const COPY: Record<Locale, MentorBoardCopy> = {
  'en-US': en.mentorScreen.board as MentorBoardCopy,
  'es-MX': es.mentorScreen.board as MentorBoardCopy,
  'pt-BR': pt.mentorScreen.board as MentorBoardCopy,
};
const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];

function undeclaredText(container: HTMLElement): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const host = node.parentElement;
    if (!/[\p{L}\p{N}]/u.test(node.textContent ?? '') || !host || host.closest('[aria-hidden="true"], [hidden]')) continue;
    if (!host.closest('[data-copy-role]')) found.push(node.textContent!.trim());
  }
  return found;
}

describe('the Mentor board draws with the shared Pizarrón visuals (B.7)', () => {
  it('maps every wire kind to an exported shared visual', () => {
    const kinds = Object.keys(boardFixtures('en-US')).sort();
    expect(Object.keys(BOARD_RENDERERS).sort()).toEqual(kinds);
    for (const visual of Object.values(BOARD_RENDERERS)) expect(PIZARRON_VISUALS).toContain(visual);
    // The concepts named by the gap audit land on their lesson visuals.
    expect(BOARD_RENDERERS).toMatchObject({
      open_number_line: 'NumberLineVisual', marked_line: 'NumberLineVisual', fraction_strip: 'FractionCellsVisual',
      bar_model: 'BarModelVisual', part_whole: 'BarModelVisual', equation_bar: 'BarModelVisual', table: 'RatioLinesVisual',
      ledger: 'LedgerVisual', worked: 'WorkedStepsVisual', ten_frame: 'TenFrameVisual', scale: 'BalanceScaleVisual', venn: 'VennVisual',
      array: 'ArrayVisual', tally: 'TallyVisual', bead_string: 'BeadStringVisual', pictograph: 'PictographVisual', sequence: 'GrowthLinesVisual',
    });
  });

  for (const locale of LOCALES) {
    it(`renders all kinds in ${locale} as their visual, copy declared, series hues only`, () => {
      for (const board of Object.values(boardFixtures(locale))) {
        const { container, unmount } = render(<RebuildRoot theme="light" locale={locale}><MentorBoard board={board} copy={COPY[locale]} locale={locale} /></RebuildRoot>);
        const frame = container.querySelector('[data-board-kind]')!;
        expect(frame.getAttribute('data-board-visual'), board.kind).toBe(BOARD_RENDERERS[board.kind]);
        expect(container.querySelector('[data-pizarron]'), board.kind).not.toBeNull();
        expect(undeclaredText(container), board.kind).toEqual([]);
        const classes = [...container.querySelectorAll('[class]')].flatMap((el) => [...el.classList]);
        expect(classes.filter((c) => /fill--(primary|accent)|lf-mentor-board-bar-fill/.test(c)), board.kind).toEqual([]);
        for (const fill of classes.filter((c) => c.startsWith('lf-pz-fill--'))) expect(['lf-pz-fill--sky', 'lf-pz-fill--mint', 'lf-pz-fill--berry', 'lf-pz-fill--overflow'], board.kind).toContain(fill);
        unmount();
      }
    });
  }

  it("writes Oracle's server-computed values as given", () => {
    const boards = boardFixtures('en-US');
    const { container } = render(<RebuildRoot theme="light" locale="en-US"><MentorBoard board={boards.ledger} copy={COPY['en-US']} locale="en-US" /></RebuildRoot>);
    const ledger = boards.ledger as Extract<typeof boards.ledger, { kind: 'ledger' }>;
    const written = container.querySelector('[data-pizarron="ledger"]')!.textContent ?? '';
    for (const balance of ledger.balances) expect(written).toContain(new Intl.NumberFormat('en-US', { style: 'currency', currency: ledger.currency, minimumFractionDigits: Number.isInteger(balance) ? 0 : 2 }).format(balance));
  });

  it('keeps the table view as the accessible alternative', () => {
    const boards = boardFixtures('en-US');
    render(<RebuildRoot theme="light" locale="en-US"><MentorBoard board={boards.open_number_line} copy={COPY['en-US']} locale="en-US" /></RebuildRoot>);
    fireEvent.click(screen.getByRole('button', { name: COPY['en-US'].showTable }));
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('never writes a your-turn value the learner has not reached (picture, axis or description)', () => {
    const boards = boardFixtures('en-US');
    const board = boards.your_turn as Extract<typeof boards.your_turn, { kind: 'your_turn' }>;
    const { container } = render(<RebuildRoot theme="light" locale="en-US"><MentorBoard board={board} copy={COPY['en-US']} locale="en-US" /></RebuildRoot>);
    const visual = container.querySelector('[data-pizarron="growth-lines"]')!;
    const hidden = board.values.slice(board.givenCount);
    const money = (v: number) => (board.currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: board.currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v) : String(v));
    for (const value of hidden) {
      expect(visual.textContent ?? '').not.toContain(money(value));
      expect(visual.getAttribute('aria-label') ?? '').not.toContain(money(value));
    }
  });
});
