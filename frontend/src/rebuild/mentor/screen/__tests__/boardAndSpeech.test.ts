import { describe, expect, it } from 'vitest';
import { checkCopy, type AgeBand, type Locale } from '../../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';
import { boardFixtures } from '../boardFixtures';
import { boardFormat, boardModel, type BoardWords } from '../boardModel';
import { speechLimit, speechPages } from '../speechPages';

const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const WORDS: Record<Locale, BoardWords> = { 'en-US': en.mentorScreen.board.words, 'es-MX': es.mentorScreen.board.words, 'pt-BR': pt.mentorScreen.board.words };

/*
 * The board on demand (08 §2 layer 4) and the speech plate (08 §2 layer 3).
 * Every whiteboard shape Oracle sends becomes a board with rows (no kind is
 * dropped, nothing is recalculated), and a live turn of any length is shown as
 * caption pages that each fit the Mentor budget, with nothing lost or cut.
 */
describe('boardModel: every whiteboard shape becomes a board', () => {
  for (const locale of LOCALES) {
    it(`renders all ${Object.keys(boardFixtures(locale)).length} kinds in ${locale} with written values`, () => {
      const fixtures = boardFixtures(locale);
      expect(Object.keys(fixtures)).toHaveLength(45);
      for (const board of Object.values(fixtures)) {
        const model = boardModel(board, WORDS[locale], boardFormat(locale));
        expect(model.title, board.kind).toBe(board.label);
        expect(model.rows.length, board.kind).toBeGreaterThan(0);
        for (const row of model.rows) {
          expect(row.label.trim(), `${board.kind} label`).not.toBe('');
          expect(row.value.trim(), `${board.kind} value`).not.toBe('');
          expect(`${row.label} ${row.value}`, board.kind).not.toMatch(/NaN|undefined|\{[a-z]+\}/);
          if (row.amount !== undefined) expect(Number.isFinite(row.amount), board.kind).toBe(true);
        }
        expect(model.interactive, board.kind).toBe(['grab', 'fill', 'whatif', 'your_turn'].includes(board.kind));
      }
    });
  }

  it("draws the server's computed values as given, never recomputing them", () => {
    const fixtures = boardFixtures('en-US');
    const sequence = boardModel({ ...fixtures.sequence, values: [99, 98, 97] }, WORDS['en-US'], boardFormat('en-US'));
    expect(sequence.rows.map((row) => row.amount)).toEqual([10, 99, 98, 97]);
    const compare = boardModel({ ...fixtures.compare, difference: 7 }, WORDS['en-US'], boardFormat('en-US'));
    expect(compare.rows.find((row) => row.id === 'difference')?.value).toBe('$7');
  });

  it('marks the best option, the unknown part and the greater side', () => {
    const f = boardFixtures('en-US');
    const format = boardFormat('en-US');
    expect(boardModel(f.table, WORDS['en-US'], format).rows.find((row) => row.marked)?.id).toBe('1');
    const bar = boardModel(f.bar_model, WORDS['en-US'], format);
    expect(bar.rows.find((row) => row.marked)?.value).toBe('?');
    expect(boardModel(f.compare, WORDS['en-US'], format).rows.find((row) => row.marked)?.id).toBe('right');
  });

  it('writes money in the currency the story uses, and plain numbers when it has none', () => {
    const f = boardFixtures('es-MX');
    const change = boardModel(f.change, WORDS['es-MX'], boardFormat('es-MX'));
    expect(change.rows[0]!.value).toMatch(/\$/);
    const line = boardModel(f.open_number_line, WORDS['es-MX'], boardFormat('es-MX'));
    expect(line.rows[0]!.value).toBe('27');
  });
});

describe('speechPages: the current turn as caption pages within the Copy Budget', () => {
  const long = 'You saved ten coins the first week. Then you added five coins each week after that, so the jar kept growing. '
    + 'Look at the board: every bar is one more week. Can you tell me what the jar will hold in week four, and how you worked it out?';
  const bands: AgeBand[] = ['6-9', '10-12', '13-17', 'adult'];

  for (const band of bands) {
    it(`keeps every page within the mentor budget for ${band} and loses no word`, () => {
      const pages = speechPages(long, 'en-US', band);
      expect(pages.length).toBeGreaterThan(1);
      for (const page of pages) expect(checkCopy(page, 'mentor', { locale: 'en-US', ageBand: band, surface: 'app' }), page).toEqual([]);
      expect(pages.join(' ')).toBe(long);
    });
  }

  it('gives the youngest band smaller pages than a teen', () => {
    expect(speechLimit('en-US', '6-9')).toBe(12);
    expect(speechLimit('en-US', '13-17')).toBe(20);
    expect(speechLimit('es-MX', '6-9')).toBe(15);
    expect(speechPages(long, 'en-US', '6-9').length).toBeGreaterThan(speechPages(long, 'en-US', '13-17').length);
  });

  it('shows a short turn as one page, unchanged', () => {
    expect(speechPages('How much is left to save?', 'pt-BR', '6-9')).toEqual(['How much is left to save?']);
  });

  it('breaks a sentence longer than the budget between clauses, then between words, never mid-word', () => {
    const run = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
    const pages = speechPages(run, 'en-US', '6-9');
    expect(pages).toEqual(['one two three four five six seven eight nine ten eleven twelve', 'thirteen fourteen fifteen sixteen']);
  });
});
