import type { Level } from './trig.generated';
import { fill, type Words } from './format';

/*
 * The math a board writes for the eye (TeX and a plain fallback) and for the ear (the spoken text a screen reader
 * gets instead of the symbols). Every spoken word comes from the pack copy, so it reads natively in each locale.
 */

export interface Notation { tex: string; plain: string; spoken: string }

const LEVEL_TEX: Readonly<Record<Level, string>> = { zero: '0', half: '\\frac{1}{2}', root2: '\\frac{\\sqrt{2}}{2}', root3: '\\frac{\\sqrt{3}}{2}', one: '1' };
const LEVEL_PLAIN: Readonly<Record<Level, string>> = { zero: '0', half: '1/2', root2: '√2/2', root3: '√3/2', one: '1' };

/** The name of a trigonometric function as the locale writes it (sin is sen in Spanish and Portuguese). */
export const fnName = (t: Words, fn: 'cos' | 'sin'): string => (fn === 'cos' ? t.colCos : t.colSin);

/** `cos θ = -√2/2`: the value a trigonometric function must reach. */
export function trigEquation(t: Words, fn: 'cos' | 'sin', level: Level, sign: 1 | -1): Notation {
  const minus = sign < 0 && level !== 'zero';
  const spokenLevel = (t as Readonly<Record<string, string>>)[`sayLevel:${level}`] ?? level;
  const name = fnName(t, fn);
  return {
    tex: `\\operatorname{${name}}\\,\\theta = ${minus ? '-' : ''}${LEVEL_TEX[level]}`,
    plain: `${name} θ = ${minus ? '-' : ''}${LEVEL_PLAIN[level]}`,
    spoken: fill(t.sayTrig, { fn: fn === 'cos' ? t.sayCos : t.saySin, value: minus ? `${t.sayMinus} ${spokenLevel}` : spokenLevel }),
  };
}

const POWERS = [3, 2, 1, 0] as const;

/** A polynomial c0 + c1 x + c2 x^2 + c3 x^3 without zero terms or a one in front of x. */
export function polynomial(t: Words, c: readonly number[], name: 'f' | 'g' = 'f'): Notation {
  const terms = POWERS.map((power) => ({ power, value: c[power] ?? 0 })).filter((term) => term.value !== 0);
  const say = (power: number) => (power === 0 ? '' : power === 2 ? t.sayXSquared : power === 3 ? t.sayXCubed : t.sayX);
  const plainX = (power: number) => (power === 0 ? '' : power === 2 ? 'x²' : power === 3 ? 'x³' : 'x');
  const texX = (power: number) => (power === 0 ? '' : power > 1 ? `x^{${power}}` : 'x');
  const part = (value: number, power: number, how: 'plain' | 'tex' | 'spoken') => {
    const size = Math.abs(value);
    const bare = size === 1 && power > 0;
    if (how === 'spoken') return [bare ? '' : String(size), say(power)].filter(Boolean).join(' ');
    return `${bare ? '' : size}${how === 'tex' ? texX(power) : plainX(power)}`;
  };
  const write = (how: 'plain' | 'tex' | 'spoken') => {
    if (terms.length === 0) return '0';
    return terms.map((term, index) => {
      const negative = term.value < 0;
      const body = part(term.value, term.power, how);
      if (how === 'spoken') return index === 0 ? (negative ? `${t.sayNegative} ${body}` : body) : `${negative ? t.sayMinus : t.sayPlus} ${body}`;
      return index === 0 ? `${negative ? '-' : ''}${body}` : ` ${negative ? '-' : '+'} ${body}`;
    }).join(how === 'spoken' ? ' ' : '');
  };
  return {
    tex: `${name}(x) = ${write('tex')}`,
    plain: `${name}(x) = ${write('plain')}`,
    spoken: `${fill(t.sayFunction, { name })} ${write('spoken')}`,
  };
}

/** `f'(x) = (x + 1)(x - 2)`: the slope rule of the linked graphs, with its two flat spots in plain sight. */
export function slopeRule(t: Words, lead: 1 | -1, roots: readonly [number, number]): Notation {
  const group = (root: number, how: 'plain' | 'tex' | 'spoken') => {
    if (root === 0) return how === 'spoken' ? t.sayX : 'x';
    const more = root < 0;
    if (how === 'spoken') return fill(t.sayQuantity, { value: `${t.sayX} ${more ? t.sayPlus : t.sayMinus} ${Math.abs(root)}` });
    return `(x ${more ? '+' : '-'} ${Math.abs(root)})`;
  };
  const write = (how: 'plain' | 'tex') => `f'(x) = ${lead < 0 ? '-' : ''}${group(roots[0], how)}${group(roots[1], how)}`;
  return {
    tex: write('tex'),
    plain: write('plain'),
    spoken: `${t.sayFPrime} ${lead < 0 ? `${t.sayNegative} ` : ''}${group(roots[0], 'spoken')} ${t.sayTimes} ${group(roots[1], 'spoken')}`,
  };
}

/** `A(x) = 18`: the area so far from `from` up to x, set equal to a number. */
export function areaSoFar(t: Words, from: number, target: number): Notation {
  return {
    tex: `A(x) = \\int_{${from}}^{x} f(t)\\,dt = ${target}`,
    plain: `A(x) = ${target}`,
    spoken: fill(t.sayAreaSoFar, { from, target }),
  };
}

/** The definite integral of f between two limits: the area the rectangles estimate. */
export function integral(t: Words, from: number, to: number): Notation {
  return {
    tex: `\\int_{${from}}^{${to}} f(x)\\,dx`,
    plain: `∫ f(x) dx, x = ${from}..${to}`,
    spoken: fill(t.sayIntegral, { from, to }),
  };
}
