/**
 * The demo fixtures, by family — **and this module is why they are not in the
 * production bundle.**
 *
 * `fixturesByFamily` used to be a constant in `registry.ts`, and `registry.ts`
 * is EAGER: `LessonPlayer` reaches it for `getRegistryEntry` on every lesson a
 * learner opens, so every demo sentence about lemonade rode into `index-*.js`
 * with it. That was tolerable while the fixtures were written once. Writing
 * them in three languages tripled it, and shipping three languages of dev data
 * to a phone that will only ever render one is not a trade worth making — so
 * the fixtures moved OUT of the eager graph instead.
 *
 * Both labs are `lazy()` routes (`App.tsx`, and the tutor lab's activity switch
 * pulls from here), so nothing in the eager graph imports this file and Rollup
 * puts the whole set in the lab chunks. Measured on the build that introduced
 * this file: `index-*.js` fell from 2,604,100 to 2,508,507 bytes, and the 95 kB
 * it lost is `fixtureSets-*.js` — three languages of demo data that a learner
 * now never downloads, where before they downloaded one. Verified after each
 * build by grepping `dist/assets/index-*.js` for a string only a fixture
 * contains ("Liruf-Bot 3000"); the answer has to be zero.
 *
 * Keep it that way: importing this module from anything a learner's route
 * reaches silently undoes it, and the only symptom is a bigger download.
 */

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../core/types'
import type { LessonFamily } from '../registry'
import { analyzeFixtures } from '../families/analyze/fixtures'
import { arrangeFixtures } from '../families/arrange/fixtures'
import { choiceFixtures } from '../families/choice/fixtures'
import { inputFixtures } from '../families/input/fixtures'
import { makerFixtures } from '../families/maker/fixtures'
import { moneyFixtures } from '../families/money/fixtures'
import { storyFixtures } from '../families/story/fixtures'
import { storyplayFixtures } from '../families/storyplay/fixtures'

/** Every family's fixtures, written in `locale`, in the taxonomy's family order. */
export function fixturesByFamily(locale: Locale): Record<LessonFamily, SegmentBase[]> {
  return {
    story: storyFixtures(locale),
    choice: choiceFixtures(locale),
    input: inputFixtures(locale),
    arrange: arrangeFixtures(locale),
    money: moneyFixtures(locale),
    analyze: analyzeFixtures(locale),
    storyplay: storyplayFixtures(locale),
    maker: makerFixtures(locale),
  }
}

/** Flat list, in family order — the lab's "play everything" showcase. */
export function allFixtures(locale: Locale): SegmentBase[] {
  return Object.values(fixturesByFamily(locale)).flat()
}
