import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

export const STATS1_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'dot-plot-median',
    title: text('Move the median', 'Mueve la mediana', 'Mova a mediana'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'dot-plot-median', type: 'stats.dot-plot.v2', grading: 'server', visual: { type: 'dot-plot' },
      prompt: text('Move up to two dots so the median is 6.', 'Mueve hasta dos puntos para que la mediana sea 6.', 'Mova até dois pontos para que a mediana seja 6.')[locale],
      payload: { axis: { min: 0, max: 10 }, dots: [2, 3, 4, 4, 5, 7, 9], measure: 'median', moves: 2 },
    }),
    rubric: { target: 6 },
    ladder: { invalid: { dots: [2, 3, 4, 4, 5, 7] }, valid: { dots: [2, 3, 4, 4, 5, 7, 9] }, met: { dots: [4, 4, 5, 6, 7, 7, 9] } },
  },
  {
    id: 'dot-plot-mode',
    title: text('Move the mode', 'Mueve la moda', 'Mova a moda'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'dot-plot-mode', type: 'stats.dot-plot.v2', grading: 'server', visual: { type: 'dot-plot' },
      prompt: text('Move up to two dots so the mode is 5.', 'Mueve hasta dos puntos para que la moda sea 5.', 'Mova até dois pontos para que a moda seja 5.')[locale],
      payload: { axis: { min: 0, max: 8 }, dots: [1, 2, 3, 3, 3, 4, 5, 6], measure: 'mode', moves: 2 },
    }),
    rubric: { target: 5 },
    ladder: { invalid: { dots: [1, 2, 3, 3, 3, 4, 5, 9] }, valid: { dots: [1, 2, 3, 3, 3, 4, 5, 6] }, met: { dots: [1, 2, 3, 4, 5, 5, 5, 6] } },
  },
  {
    id: 'dot-plot-mean',
    title: text('Move the mean', 'Mueve la media', 'Mova a média'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 14 },
    segment: (locale) => ({
      id: 'dot-plot-mean', type: 'stats.dot-plot.v2', grading: 'server', visual: { type: 'dot-plot' },
      prompt: text('Move up to two dots so the mean is 6.', 'Mueve hasta dos puntos para que la media sea 6.', 'Mova até dois pontos para que a média seja 6.')[locale],
      payload: { axis: { min: 0, max: 10 }, dots: [1, 3, 4, 4, 5, 7], measure: 'mean', moves: 2 },
    }),
    rubric: { target: 6 },
    ladder: { invalid: { dots: [1, 3, 4, 4, 5, 7, 7] }, valid: { dots: [1, 3, 4, 4, 5, 7] }, met: { dots: [3, 4, 5, 7, 7, 10] } },
  },
  {
    id: 'balance-level',
    title: text('Balance the beam', 'Equilibra la barra', 'Equilibre a barra'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'balance-level', type: 'stats.balance-point.v2', grading: 'server', visual: { type: 'balance-point' },
      prompt: text('Slide the pivot until the beam balances.', 'Desliza el pivote hasta equilibrar la barra.', 'Deslize o pivô até equilibrar a barra.')[locale],
      payload: { axis: { min: 0, max: 12 }, dots: [1, 2, 2, 5, 8, 12], pivot: 3 },
    }),
    rubric: { target: 5 },
    ladder: { invalid: { pivot: 13 }, valid: { pivot: 3 }, met: { pivot: 5 } },
  },
  {
    id: 'normal-95',
    title: text('Fit the 95% band', 'Ajusta la banda del 95%', 'Ajuste a faixa de 95%'),
    ageBand: '13-17',
    eligibility: { minimum_age: 14, maximum_age: 17 },
    segment: (locale) => ({
      id: 'normal-95', type: 'stats.normal.v2', grading: 'server', visual: { type: 'normal-curve' },
      prompt: text('Fit the curve so 40 to 60 is two standard deviations either side of the mean.', 'Ajusta la curva para que 40 a 60 sean dos desviaciones estándar a cada lado de la media.', 'Ajuste a curva para que 40 a 60 sejam dois desvios padrão de cada lado da média.')[locale],
      payload: { axis: { min: 0, max: 100 }, start: { mean: 30, sd: 10 }, sdMax: 20, band: { rule: 2, low: 40, high: 60 } },
    }),
    rubric: { target: { mean: 50, sd: 5 } },
    ladder: { invalid: { mean: 150, sd: 5 }, valid: { mean: 30, sd: 10 }, met: { mean: 50, sd: 5 } },
  },
  {
    id: 'normal-68',
    title: text('Fit the 68% band', 'Ajusta la banda del 68%', 'Ajuste a faixa de 68%'),
    ageBand: '13-17',
    eligibility: { minimum_age: 14, maximum_age: 17 },
    segment: (locale) => ({
      id: 'normal-68', type: 'stats.normal.v2', grading: 'server', visual: { type: 'normal-curve' },
      prompt: text('Fit the curve so 90 to 110 is one standard deviation either side of the mean.', 'Ajusta la curva para que 90 a 110 sea una desviación estándar a cada lado de la media.', 'Ajuste a curva para que 90 a 110 seja um desvio padrão de cada lado da média.')[locale],
      payload: { axis: { min: 60, max: 140 }, start: { mean: 80, sd: 5 }, sdMax: 20, band: { rule: 1, low: 90, high: 110 } },
    }),
    rubric: { target: { mean: 100, sd: 10 } },
    ladder: { invalid: { mean: 100, sd: 0 }, valid: { mean: 80, sd: 5 }, met: { mean: 100, sd: 10 } },
  },
  {
    id: 'binomial-fair',
    title: text('Find n and the chance', 'Halla n y la probabilidad', 'Ache n e a chance'),
    ageBand: '13-17',
    eligibility: { minimum_age: 14, maximum_age: 17 },
    segment: (locale) => ({
      id: 'binomial-fair', type: 'stats.binomial.v2', grading: 'server', visual: { type: 'binomial-bars' },
      prompt: text('Set n and the chance so the mean is 10 and the variance is 5.', 'Ajusta n y la probabilidad para que la media sea 10 y la varianza 5.', 'Ajuste n e a chance para que a média seja 10 e a variância 5.')[locale],
      payload: { nMax: 40, start: { n: 10, pct: 30 }, goal: { mean: 10, variance: 5 } },
    }),
    rubric: { target: { n: 20, pct: 50 } },
    ladder: { invalid: { n: 20, pct: 52 }, valid: { n: 10, pct: 30 }, met: { n: 20, pct: 50 } },
  },
  {
    id: 'clt-shrink',
    title: text('Shrink the spread', 'Reduce la dispersión', 'Reduza a dispersão'),
    ageBand: '13-17',
    eligibility: { minimum_age: 14, maximum_age: 17 },
    segment: (locale) => ({
      id: 'clt-shrink', type: 'stats.clt.v2', grading: 'server', visual: { type: 'sampling-mean' },
      prompt: text('Pick the sample size that makes the spread of the mean 3 times smaller.', 'Elige el tamaño de muestra que reduce 3 veces la dispersión de la media.', 'Escolha o tamanho da amostra que reduz 3 vezes a dispersão da média.')[locale],
      payload: { weights: [6, 1, 1, 1, 1, 6], nMax: 25, start: { n: 1 }, goal: { shrink: 3 } },
    }),
    rubric: { target: { n: 9 } },
    ladder: { invalid: { n: 0 }, valid: { n: 1 }, met: { n: 9 } },
  },
];
