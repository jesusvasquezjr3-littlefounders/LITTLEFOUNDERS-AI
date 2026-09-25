import { describe, expect, it } from 'vitest';
import { GRADERS } from '../../lesson-contract/registry.js';
import type { GradingSegment } from '../lessonDocument.js';
import { MAX_RESURFACINGS, SNAPSHOT_MAX, SNAPSHOT_MAX_WORDS, STORY_DECISION_TYPES, extractDecisions, fitSnapshot, pickRecall, plainText, situationOf, type JournalCandidate } from './decisionJournal.js';

const branch: GradingSegment = {
  id: 'price', type: 'story_branch', prompt_md: 'Choose', difficulty: 2, xp: 10,
  payload: {
    start_node: 'decision',
    nodes: [
      { id: 'decision', text_md: 'Liruf thinks: each glass costs 2 coins. **What price** brings me closer to the guitar?', choices: [
        { id: 'p5', text_md: '5 coins (the usual)', next: 'o5' },
        { id: 'p10', text_md: '10 coins (double)', next: 'o10' },
      ] },
      { id: 'o5', text_md: 'The 6 neighbors buy. Liruf earns 18 coins.', choices: [{ id: 'fin', text_md: 'Continue', next: null }] },
      { id: 'o10', text_md: 'Nobody buys. Zero coins today.', choices: [{ id: 'fin', text_md: 'Continue', next: null }] },
    ],
  },
  answer: { qualities: [{ node_id: 'decision', choice_id: 'p5', score: 100 }] },
};

describe('which exercises are story decisions', () => {
  it('classifies every grader type explicitly, so a new story type cannot silently skip the journal', () => {
    expect(Object.keys(STORY_DECISION_TYPES).sort()).toEqual(Object.keys(GRADERS).sort());
    expect(Object.entries(STORY_DECISION_TYPES).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(['dialogue_choice', 'story_branch', 'would_you_rather']);
  });
});

describe('extracting decisions from a graded answer', () => {
  it('story_branch: records the decision node with its question, the choice and the outcome the story showed; skips forced continues', () => {
    const records = extractDecisions(branch, { path: [{ node_id: 'decision', choice_id: 'p10' }, { node_id: 'o10', choice_id: 'fin' }] }, 'How much to charge?');
    expect(records).toEqual([{
      segment_id: 'price', decision_point: 'decision', segment_type: 'story_branch',
      situation_text: 'What price brings me closer to the guitar?', choice_id: 'p10', choice_text: '10 coins (double)',
      outcome_text: 'Nobody buys. Zero coins today.',
    }]);
  });

  it('records nothing for a choice the document does not offer, a malformed answer, or a non-story type', () => {
    expect(extractDecisions(branch, { path: [{ node_id: 'decision', choice_id: 'forged' }] }, null)).toEqual([]);
    expect(extractDecisions(branch, { path: 'nope' }, null)).toEqual([]);
    expect(extractDecisions(branch, null, null)).toEqual([]);
    expect(extractDecisions({ ...branch, type: 'quiz_mcq' }, { path: [{ node_id: 'decision', choice_id: 'p5' }] }, null)).toEqual([]);
    // A node visited twice is one decision, the first answer wins inside one path.
    expect(extractDecisions(branch, { path: [{ node_id: 'decision', choice_id: 'p5' }, { node_id: 'decision', choice_id: 'p10' }] }, null)).toHaveLength(1);
  });

  it('dialogue_choice: one record per answered turn, situation from the character line', () => {
    const segment: GradingSegment = {
      id: 'talk', type: 'dialogue_choice', prompt_md: 'Talk', difficulty: 1, xp: 10,
      payload: { persona: { character: 'zara', role_md: 'Seller' }, opening_md: 'Hi', turns: [
        { id: 't1', npc_md: 'Do you want to buy it now?', replies: [{ id: 'yes', text_md: 'Yes, right now' }, { id: 'wait', text_md: 'I will wait a week' }] },
        { id: 't2', npc_md: 'Why?', replies: [{ id: 'a', text_md: 'To compare' }, { id: 'b', text_md: 'No reason' }] },
      ] },
    };
    const records = extractDecisions(segment, { replies: [{ turn_id: 't1', reply_id: 'wait' }, { turn_id: 't2', reply_id: 'missing' }] }, null);
    expect(records).toEqual([expect.objectContaining({ decision_point: 't1', situation_text: 'Do you want to buy it now?', choice_id: 'wait', choice_text: 'I will wait a week', outcome_text: null })]);
  });

  it('would_you_rather: the one A-or-B pick, situated by the segment title', () => {
    const segment: GradingSegment = {
      id: 'wyr', type: 'would_you_rather', prompt_md: 'Pick one', difficulty: 1, xp: 5,
      payload: { a: { text_md: 'A toy today' }, b: { text_md: 'A bike in a month' } },
    };
    expect(extractDecisions(segment, { choice: 'b' }, 'Now or later?')).toEqual([expect.objectContaining({ decision_point: 'pick', situation_text: 'Now or later?', choice_id: 'b', choice_text: 'A bike in a month' })]);
    expect(extractDecisions(segment, { choice: 'c' }, 'Now or later?')).toEqual([]);
  });

  it('stores short plain-text snapshots that fit the database bound without inventing text', () => {
    expect(plainText('**Bold** [link](http://x) `code`\n\nnext')).toBe('Bold link code next');
    const long = `${'One sentence here. '.repeat(20)}`;
    const fitted = fitSnapshot(long)!;
    expect(fitted).toBe('One sentence here. One sentence here.');
    const oneRunOn = 'word '.repeat(100);
    expect(fitSnapshot(oneRunOn)!.length).toBeLessThanOrEqual(SNAPSHOT_MAX);
    expect(fitSnapshot(oneRunOn)!.split(' ')).toHaveLength(SNAPSHOT_MAX_WORDS);
    // The narrative budget: at most two sentences, whatever the author wrote.
    expect(fitSnapshot('The 6 neighbors buy. Liruf earns 3 coins per glass. In total, 18 coins. Good progress!')).toBe('The 6 neighbors buy. Liruf earns 3 coins per glass.');
    expect(fitSnapshot('   ')).toBeNull();
    expect(situationOf('No question here.', null)).toBe('No question here.');
  });
});

describe('resurfacing a relevant earlier decision', () => {
  const entry = (id: string, over: Partial<JournalCandidate> = {}): JournalCandidate => ({
    id, lessonId: `l-${id}`, topicId: `t-${id}`, courseId: 'c', recordedAt: '2026-09-01T00:00:00.000Z', resurfacedIn: [], ...over,
  });
  const target = (over: Partial<Parameters<typeof pickRecall>[1]> = {}) => ({
    lessonId: 'now', topicId: 't-now', courseId: 'c', sagaTopicIds: new Set<string>(['t-now']), kcByTopic: new Map<string, Set<string>>(), ...over,
  });

  it('prefers a decision that shares a knowledge component, then one in the same story arc', () => {
    const kcByTopic = new Map([['t-now', new Set(['kc.save'])], ['t-a', new Set(['kc.save'])], ['t-b', new Set(['kc.other'])]]);
    const picked = pickRecall([entry('b', { recordedAt: '2026-09-20T00:00:00.000Z' }), entry('a')], target({ kcByTopic, sagaTopicIds: new Set(['t-now', 't-b']) }));
    expect(picked).toMatchObject({ entry: { id: 'a' }, relevance: 'shared-skill', repeat: false });
    const arcOnly = pickRecall([entry('b')], target({ kcByTopic, sagaTopicIds: new Set(['t-now', 't-b']) }));
    expect(arcOnly).toMatchObject({ entry: { id: 'b' }, relevance: 'same-arc' });
  });

  it('never resurfaces an unrelated decision, one from this lesson, another course, or one shown three times', () => {
    expect(pickRecall([entry('x')], target())).toBeNull();
    const arc = new Set(['t-now', 't-x']);
    expect(pickRecall([entry('x', { lessonId: 'now' })], target({ sagaTopicIds: arc }))).toBeNull();
    expect(pickRecall([entry('x', { courseId: 'other' })], target({ sagaTopicIds: arc }))).toBeNull();
    expect(pickRecall([entry('x', { resurfacedIn: Array.from({ length: MAX_RESURFACINGS }, (_, i) => `l${i}`) })], target({ sagaTopicIds: arc }))).toBeNull();
  });

  it('shows the same decision again on a reload of the same lesson, and prefers the least-resurfaced', () => {
    const arc = new Set(['t-now', 't-a', 't-b']);
    expect(pickRecall([entry('a'), entry('b', { resurfacedIn: ['now'] })], target({ sagaTopicIds: arc }))).toMatchObject({ entry: { id: 'b' }, repeat: true });
    expect(pickRecall([entry('a', { resurfacedIn: ['x'] }), entry('b')], target({ sagaTopicIds: arc }))).toMatchObject({ entry: { id: 'b' } });
  });
});
