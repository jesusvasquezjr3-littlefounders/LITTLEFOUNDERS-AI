/*
 * HOW TO ANSWER A LESSON SEGMENT, WHATEVER SHAPE IT IS.
 *
 * The 57 segment types do not share one answer model, and a driver that assumes
 * they do does not fail quietly — it produces a confident, detailed, WRONG
 * report about the product. The first full-interaction audit said 33 of 57
 * types never produce a verdict; every one of those was this file's job done
 * badly, and the engine had no defect at all (/AGENTS.md §1.14).
 *
 * Three click models are needed, and they are mutually exclusive:
 *
 *   order   each control once, in document order — and when pressing one makes
 *           NEW controls appear, choose from those, because the surface just
 *           asked a question. Right for a fill-in-the-blank (whose controls are
 *           the empty blanks followed by a word bank), for ordering code
 *           blocks, and for a table whose picker does not exist until its cell
 *           is tapped, so no strategy that reads the page beforehand can see it.
 *   pair    an item, then a destination in a DIFFERENT container. Right for the
 *           matchers. Clicking a resolved chip UNDOES it, so the candidate must
 *           be the first UNRESOLVED one or the loop pairs and unpairs the same
 *           two items forever.
 *   bank    the FIRST control, over and over. Right when answering CONSUMES the
 *           control or accumulates a total — `piggy_split` only opens its gate
 *           once the whole $100 is allocated — where the other two models walk
 *           off the end of a shrinking list.
 *
 * They are tried in turn, and THE ENGINE'S OWN SUBMISSION GATE decides when the
 * answer is complete, because it is the thing that decides. Answer until it
 * opens; stop the moment it does, so a single-select question costs one click.
 *
 * A range is answered from the KEYBOARD with real key events: assigning `.value`
 * and firing `input` is something React tolerates and the engine does not
 * accept, and reporting that as ungradeable blames the product for the harness.
 *
 * Controls that REVEAL an answer (Hint; a glossary chip whose icon ligature is
 * literally "help") or DISCARD one (Reset) are excluded by construction rather
 * than by luck of ordering — which is also what makes it safe to press Reset
 * deliberately between models, so a wrong model's wreckage is never left for
 * the next model to be blamed for.
 */
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * Candidate controls: everything in <main> that is not a hint, a glossary term
 * or a reset. Matched loosely on purpose — Material icon ligatures glue their
 * name onto the label (`play_arrowRun`, `break evenhelp`), which is why nothing
 * here is ever identified by an exact string.
 */
export const MAIN =
  '[...document.querySelectorAll("main button:not([disabled])")]' +
  '.filter((b) => !/lightbulb|Hint|Pista|Reset|Clear|Borrar|Limpiar|help$/i.test(b.textContent || ""))'

/** The footer, minus the hint bulb — see GATE. */
export const FOOTER =
  '[...document.querySelectorAll("footer button")]' +
  '.filter((b) => !/lightbulb|Hint|Pista/i.test(b.textContent || ""))'

/*
 * The engine's own submission gate.
 *
 * `present` matters as much as `open`: a segment with no gate at all (a
 * dialogue, a timed round, the path builder) gives the driver no signal for
 * "that is enough", so it must not keep answering — left unbounded it filled
 * the path builder's ten-command queue with nonsense and then ran it.
 *
 * Taking the last ENABLED footer button as the advance control is the trap this
 * shape exists to avoid: Check is DISABLED exactly when the answer is
 * incomplete, so "last enabled" resolves to the hint bulb precisely when the
 * driver most needs the real control, and it presses Hint in a loop.
 */
export const GATE =
  '(() => { const f = ' + FOOTER + '; const a = f[f.length - 1];' +
  ' return { present: Boolean(a), open: Boolean(a && !a.disabled),' +
  '          verdict: Boolean(document.querySelector("[role=status]")),' +
  '          results: /Lesson complete|Good effort/i.test(document.body.innerText || "") } })()'

/** A real press: what is topmost at these coordinates gets the event. */
export async function click(page, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
  }
}

/** Scroll a control into view and return the point a finger would land on. */
export function coords(page, finder) {
  return page.evaluate(
    '(() => { const b = ' + finder + '; if (!b) return null;' +
      ' b.scrollIntoView({ block: "center", behavior: "instant" });' +
      ' const r = b.getBoundingClientRect();' +
      ' return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()',
  )
}

/** The `pair` model's next move: first unresolved item, then a destination. */
const PAIR =
  '(() => { const bs = ' + MAIN + ';' +
  ' const free = (e) => e.getAttribute("aria-pressed") !== "true";' +
  ' const a = bs.find(free); if (!a) return null;' +
  ' const box = (e) => e.closest("ul,ol,fieldset,section,[class*=grid],[class*=space-y]");' +
  ' const b = bs.find((c) => c !== a && free(c) && box(c) !== box(a));' +
  ' const out = [];' +
  ' for (const e of [a, b]) { if (!e) continue;' +
  '   e.scrollIntoView({ block: "center", behavior: "instant" });' +
  '   const r = e.getBoundingClientRect();' +
  '   out.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }) }' +
  ' return out })()'

/** Answer whatever is on screen, in whatever modality it uses. */
export async function answer(page) {
  const before = await page.evaluate(GATE)
  if (before.open || before.verdict) return

  // A range, from the keyboard — a path a learner actually has.
  const range = await coords(page, 'document.querySelector("main input[type=range]")')
  if (range) {
    await click(page, range.x, range.y)
    for (let step = 0; step < 6; step += 1) {
      for (const type of ['keyDown', 'keyUp']) {
        await page.send('Input.dispatchKeyEvent', {
          type,
          key: 'ArrowRight',
          code: 'ArrowRight',
          windowsVirtualKeyCode: 39,
        })
      }
      await sleep(110)
    }
    await sleep(400)
  }

  await page.evaluate(
    '(() => { const f = document.querySelector("main input:not([type=range]), main textarea");' +
      ' if (!f) return false;' +
      ' const set = Object.getOwnPropertyDescriptor(f.constructor.prototype, "value").set;' +
      ' set.call(f, f.type === "number" ? "5" : "saving");' +
      ' f.dispatchEvent(new Event("input", { bubbles: true })); return true })()',
  )

  const gated = (await page.evaluate(GATE)).present
  for (const model of ['order', 'pair', 'bank']) {
    // Start each model from a clean segment where the product offers a way to.
    if (model !== 'order') {
      const reset = await coords(
        page,
        '[...document.querySelectorAll("main button:not([disabled])")]' +
          '.find((b) => /Reset|Clear|Borrar|Limpiar/i.test(b.textContent || ""))',
      )
      if (reset) {
        await click(page, reset.x, reset.y)
        await sleep(500)
      }
    }

    // `bank` needs room to COUNT: an allocation of $100 in fixed steps cannot
    // be satisfied by a handful of taps, and the segment refusing an incomplete
    // allocation is the engine being right.
    const attempts = !gated ? 3 : model === 'bank' ? 26 : 6
    for (let n = 0; n < attempts; n += 1) {
      const gate = await page.evaluate(GATE)
      if (gate.open || gate.verdict) return

      if (model === 'pair') {
        const both = await page.evaluate(PAIR)
        if (!both || !both.length) break
        for (const point of both) {
          await click(page, point.x, point.y)
          await sleep(280)
        }
        continue
      }

      const candidates = await page.evaluate(MAIN + '.length')
      const target = await coords(page, MAIN + '[' + (model === 'bank' ? 0 : n) + ']')
      if (!target) break
      await click(page, target.x, target.y)
      await sleep(320)

      // Pressing it opened a picker: answer the question it just asked.
      if ((await page.evaluate(MAIN + '.length')) > candidates) {
        const choice = await coords(page, MAIN + '[' + candidates + ']')
        if (choice) {
          await click(page, choice.x, choice.y)
          await sleep(360)
        }
      }
    }
    if (!gated) break
  }
}

/**
 * Submit a segment that has no footer gate: Run for the path builder, Done for
 * the timed round and for the interest reveal.
 *
 * The wait is the point. `interest_peek` animates the money growing for about
 * two seconds and only THEN offers its Done control, so a driver that reads the
 * screen the instant it acts sees an empty page and calls the segment a dead
 * end. Nothing to press is not nothing coming.
 */
export async function submitOwnControl(page) {
  const find = () =>
    coords(page, MAIN + '.find((b) => /(Run|Done|Finish|Terminar)$/i.test(b.textContent.trim()))')

  let control = await find()
  if (!control && !(await page.evaluate(GATE)).present) {
    for (let wait = 0; wait < 4 && !control; wait += 1) {
      await sleep(1000)
      control = await find()
    }
  }
  if (!control) return false
  await click(page, control.x, control.y)
  await sleep(2600)
  return true
}
