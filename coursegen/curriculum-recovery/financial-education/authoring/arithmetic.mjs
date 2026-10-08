// Independent arithmetic declarations. Inputs must match the visible text in all locales.
// These expressions compute keys; they never read the authored answer to infer a formula.
const n = input => ({ input });
const op = (name, a, b) => ({ op: name, args: [a, b] });
const add = (a, b) => op('add', a, b), sub = (a, b) => op('subtract', a, b), mul = (a, b) => op('multiply', a, b);
const pct = (base, rate) => op('divide', mul(base, rate), { constant: 100 });
const proof = (visible_inputs, expression, source = 'scene') => ({ source, visible_inputs, expression });
export const arithmetic = {
  '04/guided-01': proof([95, 60], sub(n(0), n(1)), 'chart-values'),
  '04/practice-01': proof([140, 90], sub(n(0), n(1)), 'chart-values'),
  '07/practice-02': proof([70, 20, 30], sub(add(n(0), n(1)), n(2))),
  '08/guided-01': proof([100, 50], n(0)),
  '09/practice-01': proof([60], n(0)),
  '09/transfer-01': proof([80], n(0)),
  '10/guided-01': proof([40, 50], sub(n(1), n(0))),
  '10/transfer-01': proof([50, 20], sub(n(0), n(1))),
  '11/practice-02': proof([80, 100], n(0)),
  '11/practice-03': proof([90], n(0)),
  '14/guided-01': proof([80, 10], add(n(0), n(1))),
  '14/guided-02': proof([90, 85], op('min', n(0), n(1))),
  '14/practice-01': proof([200, 10], sub(n(0), pct(n(0), n(1)))),
  '15/practice-01': proof([60, 20], sub(n(0), n(1))),
  '15/practice-02': proof([400, 25], pct(n(0), n(1))),
  '15/practice-04': proof([10, 500], pct(n(1), n(0))),
  '16/guided-01': proof([100, 20], sub(n(0), n(1))),
  '16/guided-02': proof([80], n(0)),
  '16/practice-01': proof([150, 50], sub(n(0), n(1))),
  '16/transfer-01': proof([120, 40], sub(n(0), n(1))),
  '19/practice-01': proof([100, 10, 10], add(sub(n(0), pct(n(0), n(1))), n(2))),
  '19/practice-03': proof([200, 80], sub(n(0), n(1))),
  '21/guided-01': proof([4, 30], mul(n(0), n(1))),
  '21/guided-02': proof([100, 120], sub(n(1), n(0))),
  '21/practice-02': proof([120, 10], add(n(0), n(1))),
  '21/transfer-01': proof([200, 4, 60], sub(mul(n(1), n(2)), n(0))),
  '22/guided-01': proof([100, 10], add(n(0), pct(n(0), n(1)))),
  '22/guided-02': proof([100, 10, 30], sub(add(n(0), n(1)), n(2))),
  '22/practice-01': proof([10, 80], pct(n(1), n(0))),
  '22/transfer-01': proof([200, 5, 60], sub(add(n(0), pct(n(0), n(1))), n(2))),
  '23/practice-03': proof([3, 50, 10], add(mul(n(0), n(1)), n(2))),
  '23/transfer-01': proof([300, 6, 60], sub(mul(n(1), n(2)), n(0))),
  '24/guided-01': proof([100, 10, 20], sub(add(n(0), n(1)), n(2))),
  '24/practice-02': proof([100, 10, 10], sub(add(n(0), n(1)), n(2))),
  '24/transfer-01': proof([200, 20, 60], sub(add(n(0), n(1)), n(2))),
  '25/guided-02': proof([100, 10], add(n(0), pct(n(0), n(1)))),
  '26/guided-01': proof([100, 10], add(n(0), pct(n(0), n(1)))),
  '26/guided-02': proof([100, 110], n(1)),
  '26/practice-01': proof([200, 10], add(n(0), pct(n(0), n(1)))),
  '26/practice-02': proof([110, 10], pct(n(0), n(1))),
  '26/transfer-01': proof([200, 10], add(add(n(0), pct(n(0), n(1))), pct(add(n(0), pct(n(0), n(1))), n(1)))),
};
export function attachArithmetic(plans) {
  for (const plan of plans) for (const segment of plan.segments) {
    const number = plan.lesson_id.split('-')[2];
    const key = `${number}/${segment.id}`;
    if (arithmetic[key]) segment.numeric_proof = arithmetic[key];
  }
}
