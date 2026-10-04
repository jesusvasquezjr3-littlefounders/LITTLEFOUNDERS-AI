import type { Locale } from '../../design/copyBudget';
import type { ReadingChartKind } from './chartModel.generated';

/*
 * Horizonte F1.0: the learner-facing words of the twelve reading charts in
 * three locales: the reader (tap a mark, then step through the marks), one line
 * that says how to read each kind (Copy Budget body: at most 12 words, two
 * sentences), and the few captions the drawings carry. The words of the data
 * model ("Median", "Low 80%") are in readingWords.ts.
 */

export interface ReadingCopy {
  read: string; previous: string; next: string; hint: string;
  position: (at: number, of: number) => string;
  range: (level: number) => string;
  equal: string; people: string; total: string; oneDay: string; span: string;
  note: Record<ReadingChartKind, string>;
}

export const readingCopy: Record<Locale, ReadingCopy> = {
  'en-US': {
    read: 'Read the values', previous: 'Previous', next: 'Next', hint: 'Tap a mark.',
    position: (at, of) => `${at} of ${of}`, range: (level) => `${level}% range`,
    equal: 'Equal sharing', people: 'Share of people', total: 'Share of total', oneDay: 'One day', span: 'A span',
    note: {
      'dot-plot': 'Farther right means more.',
      dumbbell: 'Each line joins two values. Longer means a bigger change.',
      'xy-heatmap': 'Darker squares hold bigger numbers. Read across and down.',
      'error-bars': 'The dot is the average. The line shows the spread.',
      funnel: 'Each bar is a step. People drop out.',
      'lorenz-curve': 'The more it bends, the less equal.',
      'fan-chart': 'The line is the best guess. Wider bands mean less certainty.',
      'density-plot': 'A taller curve means more values there. Ticks mark each value.',
      'violin-plot': 'A wider shape means more values at that height.',
      timeline: 'Dots are single days. Bars are spans of time.',
      'scatter-regression': 'Each dot is one pair. The line shows the trend.',
      'parallel-coordinates': 'Each line is one item. Follow it across the measures.',
    },
  },
  'es-MX': {
    read: 'Leer los valores', previous: 'Anterior', next: 'Siguiente', hint: 'Toca una marca.',
    position: (at, of) => `${at} de ${of}`, range: (level) => `Rango del ${level}%`,
    equal: 'Reparto igual', people: 'Proporción de personas', total: 'Proporción del total', oneDay: 'Un día', span: 'Un periodo',
    note: {
      'dot-plot': 'Más a la derecha significa más.',
      dumbbell: 'Cada línea une dos valores. Más larga es un cambio mayor.',
      'xy-heatmap': 'Los cuadros más oscuros tienen números mayores. Lee por filas y columnas.',
      'error-bars': 'El punto es el promedio. La línea muestra cuánto varía.',
      funnel: 'Cada barra es un paso. La gente se va.',
      'lorenz-curve': 'Mientras más se curva, menos igualdad hay.',
      'fan-chart': 'La línea es la mejor estimación. Las bandas anchas indican menos certeza.',
      'density-plot': 'Una curva más alta significa más valores ahí. Las marcas muestran cada valor.',
      'violin-plot': 'Una forma más ancha significa más valores a esa altura.',
      timeline: 'Los puntos son días sueltos. Las barras son periodos.',
      'scatter-regression': 'Cada punto es un par. La línea muestra la tendencia.',
      'parallel-coordinates': 'Cada línea es un elemento. Síguela por todas las medidas.',
    },
  },
  'pt-BR': {
    read: 'Ler os valores', previous: 'Anterior', next: 'Próximo', hint: 'Toque em uma marca.',
    position: (at, of) => `${at} de ${of}`, range: (level) => `Faixa de ${level}%`,
    equal: 'Divisão igual', people: 'Proporção de pessoas', total: 'Proporção do total', oneDay: 'Um dia', span: 'Um período',
    note: {
      'dot-plot': 'Mais à direita significa mais.',
      dumbbell: 'Cada linha liga dois valores. Mais longa é uma mudança maior.',
      'xy-heatmap': 'Quadrados mais escuros têm números maiores. Leia por linhas e colunas.',
      'error-bars': 'O ponto é a média. A linha mostra quanto varia.',
      funnel: 'Cada barra é uma etapa. As pessoas saem.',
      'lorenz-curve': 'Quanto mais se curva, menos igualdade existe.',
      'fan-chart': 'A linha é a melhor estimativa. Faixas largas indicam menos certeza.',
      'density-plot': 'Uma curva mais alta significa mais valores ali. Os traços mostram cada valor.',
      'violin-plot': 'Uma forma mais larga significa mais valores nessa altura.',
      timeline: 'Pontos são dias isolados. Barras são períodos.',
      'scatter-regression': 'Cada ponto é um par. A linha mostra a tendência.',
      'parallel-coordinates': 'Cada linha é um item. Siga-a por todas as medidas.',
    },
  },
};
