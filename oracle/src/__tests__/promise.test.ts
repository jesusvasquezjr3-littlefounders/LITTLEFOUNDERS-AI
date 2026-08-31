import { describe, expect, it } from 'vitest';
import { promisesAnActivity, repeatsAnAnnouncement } from '../tutor/prompt.js';

/*
 * A BARE MENTION OF THE SCREEN IS NOT A PROMISE.
 *
 * This checker exists so the tutor cannot announce an activity and then not
 * deliver one — a child told something is coming and given nothing. It had no
 * test, and it was wrong in the direction that gets worse as the product gets
 * better: the turn that reacts to a graded activity is SUPPOSED to name what
 * the learner just did, in the past tense, and that was read as an unkept
 * promise. Every case below is a sentence the deployed tutor actually produced.
 */

describe('what counts as announcing an activity', () => {
  it('catches a real promise', () => {
    expect(promisesAnActivity('¿Qué tal si lo practicamos con monedas en la pantalla?')).toBe(true);
    expect(promisesAnActivity('Vamos a practicar con monedas para que lo veas.')).toBe(true);
    expect(promisesAnActivity('Te muestro un juego rapidito.')).toBe(true);
    expect(promisesAnActivity("Let's try it with coins on the screen.")).toBe(true);
  });

  it('leaves the tutor describing what the child ALREADY did', () => {
    // Observed 2026-08-29 from production. This is the best kind of turn the
    // tutor produces — it reacts to the specific thing rather than paying a
    // generic compliment — and the checker forced a retry on it.
    expect(
      promisesAnActivity(
        "Robi, en la pantalla pusiste la moneda de 10 en la cubeta de 'necesito' y la de 5 en 'quiero', y eso estuvo bien.",
      ),
    ).toBe(false);
    expect(
      promisesAnActivity('En la pantalla juntaste las monedas exactas y no te sobró ninguna.'),
    ).toBe(false);
  });

  it('judges each sentence on its own', () => {
    // Narration of the past AND a genuine offer, in one turn. The offer is real,
    // so the turn must still be held to delivering it.
    expect(
      promisesAnActivity(
        'En la pantalla contaste bien hasta 15. ¿Quieres que lo practiquemos con monedas en la pantalla otra vez?',
      ),
    ).toBe(true);
  });

  it('does not mistake an emotion word for a past tense', () => {
    // `-aste|-iste` as a pattern would read "triste" and "chiste" as verbs —
    // the same class of bug one level down, so the verbs are listed explicitly.
    expect(promisesAnActivity('Sé que estás triste, y está bien.')).toBe(false);
    expect(promisesAnActivity('Ese chiste estuvo bueno.')).toBe(false);
  });

  it('is silent about a turn that offers nothing at all', () => {
    expect(promisesAnActivity('¿Cuánto es 10 más 5?')).toBe(false);
  });

  /*
   * ITEM 4: ALREADY_DID HAD ZERO PORTUGUESE ENTRIES. A genuine pt-BR
   * narration of a just-completed activity was misread as an unkept
   * promise: `SCREEN_MENTION` matched "na tela", the all-Spanish
   * `ALREADY_DID` guard never fired for the Portuguese past tense
   * "colocou," and the sentence fell through to `FUTURE_OFFER`, which
   * matched the entirely coincidental "quer" ("want") sitting later in the
   * same ordinary sentence.
   */
  it('leaves the tutor describing what the child ALREADY did, in Portuguese too', () => {
    expect(
      promisesAnActivity('Na tela, você colocou a moeda na cesta do que você quer.'),
    ).toBe(false);
  });
});

describe('the same announcement again, reworded', () => {
  /*
   * Observed in production 2026-08-29, one conversation, three turns. The
   * exact-match check needs the tails to agree and they do not; the
   * previous-turn check looks one turn back and forgives a pair whose numbers
   * changed — right for teaching, wrong for an announcement, which carries no
   * pedagogical numbers at all. So a child was told three times that something
   * was about to appear and every check we owned called the session clean.
   */
  const first = 'Vamos a practicar con monedas en la pantalla para que lo veas con tus ojos.';

  it('catches the third telling', () => {
    expect(
      repeatsAnAnnouncement('Vamos a practicar con monedas en la pantalla para que lo veas claro.', [first]),
    ).not.toBeNull();
  });

  it('leaves a genuinely different activity alone', () => {
    expect(repeatsAnAnnouncement('Te muestro un juego de descuentos rapidito.', [first])).toBeNull();
  });

  it('says nothing about turns that announce nothing', () => {
    // Teaching that reuses vocabulary is not a repeated announcement, and this
    // check must never fire on it — the same method on a new problem is good
    // practice, which is exactly why the previous-turn check forgives numbers.
    expect(repeatsAnAnnouncement('Si tienes 12 monedas y quitas 4, ¿cuántas te quedan?', [first])).toBeNull();
  });

  it('has nothing to compare against on the first announcement', () => {
    expect(repeatsAnAnnouncement(first, [])).toBeNull();
  });
});
