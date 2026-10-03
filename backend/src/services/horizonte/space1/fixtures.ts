import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const item = (count: number): string[] => Array.from({ length: count }, () => 'item');
const BASE = { grading: 'server' } as const;

const ROTATION = { type: 'geometry.mental-rotation.v2', visual: { type: 'mental-rotation' } } as const;
const SECTION = { type: 'geometry.solid-section.v2', visual: { type: 'solid-section' } } as const;
const STALL = { type: 'money.market-stall.v2', visual: { type: 'market-stall' } } as const;
const STACK = { type: 'money.coin-stack.v2', visual: { type: 'coin-stack' } } as const;

export const SPACE1_FIXTURES: readonly HorizonteFixture[] = [
  /* ── F4.4 mental rotation ── */
  {
    id: 'turn-the-l',
    title: text('Turn the L', 'Gira la L', 'Gire o L'),
    ageBand: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 9 },
    segment: (locale) => ({
      id: 'rotation-turn-the-l', ...BASE, ...ROTATION,
      prompt: text(
        'Turn the shape until it looks like the other one.',
        'Gira la figura hasta que se vea igual a la otra.',
        'Gire a figura até ficar igual à outra.',
      )[locale],
      payload: {
        axis: 'up',
        figure: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1]],
        targets: [[[2, 0, 0], [2, 0, 1], [2, 0, 2], [1, 0, 2]]],
      },
    }),
    rubric: { pick: 'a', angles: [90] },
    ladder: { invalid: { pick: 'z', angle: 90 }, valid: { pick: 'a', angle: 0 }, met: { pick: 'a', angle: 90 } },
  },
  {
    id: 'pick-the-turned',
    title: text('Which one is turned?', '¿Cuál está girada?', 'Qual está girada?'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'rotation-pick-the-turned', ...BASE, ...ROTATION,
      prompt: text(
        'Which shape is the figure turned, not flipped? Pick it, then set the angle.',
        '¿Cuál forma es la figura girada, no volteada? Elígela y marca el ángulo.',
        'Qual forma é a figura girada, e não espelhada? Escolha-a e defina o ângulo.',
      )[locale],
      payload: {
        axis: 'side',
        figure: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]],
        targets: [
          [[2, 0, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 1]],
          [[0, 2, 2], [1, 2, 2], [2, 2, 2], [2, 1, 2], [2, 1, 1]],
          [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]],
        ],
      },
    }),
    rubric: { pick: 'b', angles: [180] },
    ladder: { invalid: { pick: 'd', angle: 180 }, valid: { pick: '', angle: 0 }, met: { pick: 'b', angle: 180 } },
  },
  {
    id: 'turn-the-corner',
    title: text('Turn the corner piece', 'Gira la pieza de esquina', 'Gire a peça de canto'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'rotation-turn-the-corner', ...BASE, ...ROTATION,
      prompt: text(
        'Only one shape is a turn of the figure, not a mirror image. Find it and the angle.',
        'Solo una forma es un giro de la figura, no su reflejo. Encuéntrala y halla el ángulo.',
        'Só uma forma é um giro da figura, e não o reflexo dela. Encontre-a e ache o ângulo.',
      )[locale],
      payload: {
        axis: 'depth',
        figure: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0], [2, 2, 0], [2, 2, 1]],
        targets: [
          [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0], [2, 2, 0], [2, 1, 0]],
          [[2, 0, 0], [2, 1, 0], [2, 2, 0], [1, 2, 0], [0, 2, 0], [0, 2, 1]],
          [[2, 0, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1]],
        ],
      },
    }),
    rubric: { pick: 'c', angles: [270] },
    ladder: { invalid: { pick: 'a', angle: 45 }, valid: { pick: 'c', angle: 0 }, met: { pick: 'c', angle: 270 } },
  },
  /* ── F4.5 plane sections, Platonic solids, Euler ── */
  {
    id: 'cube-hexagon',
    title: text('Slice the cube', 'Corta el cubo', 'Corte o cubo'),
    ageBand: '10-12',
    eligibility: { minimum_age: 11, maximum_age: 12 },
    segment: (locale) => ({
      id: 'section-cube-hexagon', ...BASE, ...SECTION,
      prompt: text(
        'A plane slices the cube. What shape is the cut?',
        'Un plano corta el cubo. ¿Qué forma tiene el corte?',
        'Um plano corta o cubo. Que forma tem o corte?',
      )[locale],
      payload: { mode: 'section', solid: 'cube', plane: { normal: [1, 1, 1], offset: 0 }, options: ['triangle', 'rectangle', 'hexagon'] },
    }),
    rubric: { pick: 'hexagon' },
    ladder: { invalid: { pick: 'circle' }, valid: { pick: '' }, met: { pick: 'hexagon' } },
  },
  {
    id: 'tetrahedron-square',
    title: text('Slice the tetrahedron', 'Corta el tetraedro', 'Corte o tetraedro'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'section-tetrahedron-square', ...BASE, ...SECTION,
      prompt: text(
        'The plane runs halfway between two opposite edges of the tetrahedron. Name the shape of the cut.',
        'El plano pasa a la mitad entre dos aristas opuestas del tetraedro. Nombra la forma del corte.',
        'O plano passa na metade entre duas arestas opostas do tetraedro. Nomeie a forma do corte.',
      )[locale],
      payload: { mode: 'section', solid: 'tetrahedron', plane: { normal: [1, 0, 0], offset: 0 }, options: ['triangle', 'square', 'pentagon'] },
    }),
    rubric: { pick: 'square' },
    ladder: { invalid: { pick: 'hexagon' }, valid: { pick: '' }, met: { pick: 'square' } },
  },
  {
    id: 'cube-edges',
    title: text('Count the cube\'s edges', 'Cuenta las aristas del cubo', 'Conte as arestas do cubo'),
    ageBand: '10-12',
    eligibility: { minimum_age: 11, maximum_age: 12 },
    segment: (locale) => ({
      id: 'euler-cube-edges', ...BASE, ...SECTION,
      prompt: text(
        'Use V − E + F = 2 to find the missing count.',
        'Usa V − A + C = 2 para hallar la cantidad que falta.',
        'Use V − A + F = 2 para achar a quantidade que falta.',
      )[locale],
      payload: { mode: 'euler', solid: 'cube', hide: 'edges' },
    }),
    rubric: { target: '12' },
    ladder: { invalid: { value: 'abc' }, valid: { value: '' }, met: { value: '12' } },
  },
  {
    id: 'dodecahedron-faces',
    title: text('Count the dodecahedron\'s faces', 'Cuenta las caras del dodecaedro', 'Conte as faces do dodecaedro'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'euler-dodecahedron-faces', ...BASE, ...SECTION,
      prompt: text(
        'Every Platonic solid obeys V − E + F = 2. Find the missing count.',
        'Todo sólido platónico cumple V − A + C = 2. Halla la cantidad que falta.',
        'Todo sólido platônico cumpre V − A + F = 2. Ache a quantidade que falta.',
      )[locale],
      payload: { mode: 'euler', solid: 'dodecahedron', hide: 'faces' },
    }),
    rubric: { target: '12' },
    ladder: { invalid: { value: '99999' }, valid: { value: '' }, met: { value: '12' } },
  },
  {
    id: 'pyramid-third',
    title: text('A third of the prism', 'Un tercio del prisma', 'Um terço do prisma'),
    ageBand: '10-12',
    eligibility: { minimum_age: 11, maximum_age: 12 },
    segment: (locale) => ({
      id: 'volume-pyramid-third', ...BASE, ...SECTION,
      prompt: text(
        'The prism and the pyramid share the same base and height. Find the pyramid\'s volume.',
        'El prisma y la pirámide tienen la misma base y altura. Halla el volumen de la pirámide.',
        'O prisma e a pirâmide têm a mesma base e altura. Ache o volume da pirâmide.',
      )[locale],
      payload: { mode: 'volume', side: 6, height: 5 },
    }),
    rubric: { target: '60' },
    ladder: { invalid: { value: '5000' }, valid: { value: '' }, met: { value: '60' } },
  },
  /* ── F4.5 fix round: the cone, the cylinder, Archimedean solids and a plane the learner slides ── */
  {
    id: 'cone-third',
    title: text('A third of the cylinder', 'Un tercio del cilindro', 'Um terço do cilindro'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'volume-cone-third', ...BASE, ...SECTION,
      prompt: text(
        'The cone and the cylinder share the same base and height. Give the cone\'s volume as a number of π.',
        'El cono y el cilindro tienen la misma base y altura. Da el volumen del cono como un número de π.',
        'O cone e o cilindro têm a mesma base e altura. Dê o volume do cone como um número de π.',
      )[locale],
      payload: { mode: 'cone', radius: 3, height: 4 },
    }),
    rubric: { target: '12' },
    ladder: { invalid: { value: '5000' }, valid: { value: '' }, met: { value: '12' } },
  },
  {
    id: 'cylinder-circle',
    title: text('Slice the cylinder', 'Corta el cilindro', 'Corte o cilindro'),
    ageBand: '10-12',
    eligibility: { minimum_age: 11, maximum_age: 12 },
    segment: (locale) => ({
      id: 'section-cylinder-circle', ...BASE, ...SECTION,
      prompt: text(
        'A plane cuts the cylinder parallel to its flat ends. What shape is the cut?',
        'Un plano corta el cilindro paralelo a sus extremos planos. ¿Qué forma tiene el corte?',
        'Um plano corta o cilindro paralelo às suas extremidades planas. Que forma tem o corte?',
      )[locale],
      payload: { mode: 'section', solid: 'cylinder', plane: { normal: [0, 1, 0], offset: 4 }, options: ['circle', 'rectangle', 'triangle'] },
    }),
    rubric: { pick: 'circle' },
    ladder: { invalid: { pick: 'hexagon' }, valid: { pick: '' }, met: { pick: 'circle' } },
  },
  {
    id: 'cylinder-rectangle',
    title: text('Cut along the axis', 'Corta a lo largo del eje', 'Corte ao longo do eixo'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'section-cylinder-rectangle', ...BASE, ...SECTION,
      prompt: text(
        'The plane runs straight down the cylinder, along its axis. Name the shape of the cut.',
        'El plano baja recto por el cilindro, a lo largo de su eje. Nombra la forma del corte.',
        'O plano desce reto pelo cilindro, ao longo do eixo. Nomeie a forma do corte.',
      )[locale],
      payload: { mode: 'section', solid: 'cylinder', plane: { normal: [1, 0, 0], offset: 0 }, options: ['circle', 'rectangle', 'ellipse'] },
    }),
    rubric: { pick: 'rectangle' },
    ladder: { invalid: { pick: 'hexagon' }, valid: { pick: '' }, met: { pick: 'rectangle' } },
  },
  {
    id: 'cylinder-ellipse',
    title: text('A slanted cut', 'Un corte inclinado', 'Um corte inclinado'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'section-cylinder-ellipse', ...BASE, ...SECTION,
      prompt: text(
        'The plane cuts the cylinder at a slant and clears both flat ends. What shape is the cut?',
        'El plano corta el cilindro en diagonal y no toca los extremos planos. ¿Qué forma tiene el corte?',
        'O plano corta o cilindro na diagonal e não toca as extremidades planas. Que forma tem o corte?',
      )[locale],
      payload: { mode: 'section', solid: 'cylinder', plane: { normal: [1, 2, 0], offset: 0 }, options: ['circle', 'ellipse', 'rectangle'] },
    }),
    rubric: { pick: 'ellipse' },
    ladder: { invalid: { pick: 'hexagon' }, valid: { pick: '' }, met: { pick: 'ellipse' } },
  },
  {
    id: 'truncated-icosahedron-faces',
    title: text('A solid with cut corners', 'Un sólido con esquinas cortadas', 'Um sólido com cantos cortados'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'euler-truncated-icosahedron-faces', ...BASE, ...SECTION,
      prompt: text(
        'This solid has its corners cut off. V − E + F = 2 still holds. Find the missing count.',
        'Este sólido tiene las esquinas cortadas. V − A + C = 2 sigue valiendo. Halla la cantidad que falta.',
        'Este sólido tem os cantos cortados. V − A + F = 2 continua valendo. Ache a quantidade que falta.',
      )[locale],
      payload: { mode: 'euler', solid: 'truncated-icosahedron', hide: 'faces' },
    }),
    rubric: { target: '32' },
    ladder: { invalid: { value: '91' }, valid: { value: '' }, met: { value: '32' } },
  },
  {
    id: 'cuboctahedron-edges',
    title: text('Count the cuboctahedron\'s edges', 'Cuenta las aristas del cuboctaedro', 'Conte as arestas do cuboctaedro'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'euler-cuboctahedron-edges', ...BASE, ...SECTION,
      prompt: text(
        'Squares and triangles make up this solid. Use V − E + F = 2 to find the missing count.',
        'Este sólido está hecho de cuadrados y triángulos. Usa V − A + C = 2 para hallar la cantidad que falta.',
        'Este sólido é feito de quadrados e triângulos. Use V − A + F = 2 para achar a quantidade que falta.',
      )[locale],
      payload: { mode: 'euler', solid: 'cuboctahedron', hide: 'edges' },
    }),
    rubric: { target: '24' },
    ladder: { invalid: { value: 'abc' }, valid: { value: '' }, met: { value: '24' } },
  },
  {
    id: 'slide-cube-hexagon',
    title: text('Slide the plane', 'Desliza el plano', 'Deslize o plano'),
    ageBand: '10-12',
    eligibility: { minimum_age: 11, maximum_age: 12 },
    segment: (locale) => ({
      id: 'slide-cube-hexagon', ...BASE, ...SECTION,
      prompt: text(
        'Slide the plane until it cuts a hexagon from the cube.',
        'Desliza el plano hasta que corte un hexágono del cubo.',
        'Deslize o plano até cortar um hexágono do cubo.',
      )[locale],
      payload: { mode: 'slide', solid: 'cube', normal: [1, 1, 1], start: 10, target: 'hexagon' },
    }),
    rubric: { pick: 'hexagon' },
    ladder: { invalid: { offset: 99 }, valid: { offset: 10 }, met: { offset: 0 } },
  },
  {
    id: 'slide-tetrahedron-square',
    title: text('Find the square', 'Encuentra el cuadrado', 'Encontre o quadrado'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'slide-tetrahedron-square', ...BASE, ...SECTION,
      prompt: text(
        'Slide the plane until it cuts a square from the tetrahedron.',
        'Desliza el plano hasta que corte un cuadrado del tetraedro.',
        'Deslize o plano até cortar um quadrado do tetraedro.',
      )[locale],
      payload: { mode: 'slide', solid: 'tetrahedron', normal: [1, 0, 0], start: 3, target: 'square' },
    }),
    rubric: { pick: 'square' },
    ladder: { invalid: { offset: 99 }, valid: { offset: 3 }, met: { offset: 0 } },
  },
  {
    id: 'slide-cylinder-ellipse',
    title: text('Slide to an ellipse', 'Desliza hasta una elipse', 'Deslize até uma elipse'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'slide-cylinder-ellipse', ...BASE, ...SECTION,
      prompt: text(
        'Slide the plane until it cuts an ellipse from the cylinder.',
        'Desliza el plano hasta que corte una elipse del cilindro.',
        'Deslize o plano até cortar uma elipse do cilindro.',
      )[locale],
      payload: { mode: 'slide', solid: 'cylinder', normal: [1, 2, 0], start: 14, target: 'ellipse' },
    }),
    rubric: { pick: 'ellipse' },
    ladder: { invalid: { offset: 99 }, valid: { offset: 14 }, met: { offset: 0 } },
  },
  /* ── F4.6 market stall and to-scale stacks ── */
  {
    id: 'exact-basket',
    title: text('A basket for $2.50', 'Una canasta de $2.50', 'Uma cesta de $2,50'),
    ageBand: '6-9',
    eligibility: { minimum_age: 7, maximum_age: 9 },
    segment: (locale) => ({
      id: 'stall-exact-basket', ...BASE, ...STALL,
      prompt: text(
        'Fill the basket so it costs exactly $2.50.',
        'Llena la canasta para que cueste justo $2.50.',
        'Encha a cesta para que custe exatamente $2,50.',
      )[locale],
      payload: {
        items: [{ id: 'apple', price: 50, stock: 5 }, { id: 'bread', price: 120, stock: 3 }, { id: 'juice', price: 80, stock: 4 }],
        goal: { kind: 'exact', total: 250 },
      },
    }),
    rubric: { solutions: [{ bread: item(1), apple: item(1), juice: item(1) }, { apple: item(5) }] },
    ladder: {
      invalid: { slots: { ghost: item(1) } },
      valid: { slots: {} },
      met: { slots: { bread: item(1), apple: item(1), juice: item(1) } },
    },
  },
  {
    id: 'make-the-change',
    title: text('Pay $10, get $2 back', 'Paga $10, recibe $2', 'Pague $10, receba $2'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'stall-make-the-change', ...BASE, ...STALL,
      prompt: text(
        'You pay $10. Fill the basket so your change is exactly $2.',
        'Pagas $10. Llena la canasta para que tu cambio sea exactamente $2.',
        'Você paga $10. Encha a cesta para que o troco seja exatamente $2.',
      )[locale],
      payload: {
        items: [{ id: 'pen', price: 150, stock: 4 }, { id: 'book', price: 350, stock: 2 }, { id: 'cap', price: 400, stock: 2 }],
        goal: { kind: 'change', paid: 1000, change: 200 },
      },
    }),
    rubric: { solutions: [{ cap: item(2) }, { book: item(1), pen: item(3) }] },
    ladder: {
      invalid: { slots: { pen: item(5) } },
      valid: { slots: {} },
      met: { slots: { cap: item(2) } },
    },
  },
  {
    id: 'most-for-three',
    title: text('The most for $3', 'Lo máximo con $3', 'O máximo com $3'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'stall-most-for-three', ...BASE, ...STALL,
      prompt: text(
        'You have $3. Buy as many things as you can.',
        'Tienes $3. Compra tantas cosas como puedas.',
        'Você tem $3. Compre o máximo de coisas que puder.',
      )[locale],
      payload: {
        items: [{ id: 'shell', price: 30, stock: 4 }, { id: 'stamp', price: 45, stock: 3 }, { id: 'kite', price: 120, stock: 2 }, { id: 'toy', price: 250, stock: 2 }],
        goal: { kind: 'most', budget: 300 },
      },
    }),
    rubric: { solutions: [{ shell: item(4), stamp: item(3) }] },
    ladder: {
      invalid: { slots: { shell: item(5) } },
      valid: { slots: {} },
      met: { slots: { shell: item(4), stamp: item(3) } },
    },
  },
  {
    id: 'coins-as-tall-as-a-phone',
    title: text('Coins as tall as a phone', 'Monedas tan altas como un celular', 'Moedas da altura de um celular'),
    ageBand: '6-9',
    eligibility: { minimum_age: 7, maximum_age: 9 },
    segment: (locale) => ({
      id: 'coins-as-tall-as-a-phone', ...BASE, ...STACK,
      prompt: text(
        'Stack coins until they are as tall as the phone.',
        'Apila monedas hasta que lleguen a la altura del celular.',
        'Empilhe moedas até ficarem da altura do celular.',
      )[locale],
      payload: { piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 },
    }),
    rubric: { target: '4' },
    ladder: { invalid: { value: '99' }, valid: { value: '0' }, met: { value: '4' } },
  },
  {
    id: 'coins-worth-fifteen',
    title: text('Coins worth $15', 'Monedas que valen $15', 'Moedas que valem $15'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'coins-worth-fifteen', ...BASE, ...STACK,
      prompt: text(
        'Stack coins worth $15. See how tall that is.',
        'Apila monedas que valgan $15. Mira qué tan alto queda.',
        'Empilhe moedas que valham $15. Veja que altura isso dá.',
      )[locale],
      payload: { piece: 'coin', value: 100, goal: { kind: 'amount', total: 1500 }, step: 1, max: 30 },
    }),
    rubric: { target: '15' },
    ladder: { invalid: { value: '31' }, valid: { value: '0' }, met: { value: '15' } },
  },
  {
    id: 'a-million-in-bills',
    title: text('A million in $100 bills', 'Un millón en billetes de $100', 'Um milhão em notas de $100'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'coins-a-million-in-bills', ...BASE, ...STACK,
      prompt: text(
        'Stack $100 bills until they are worth $1,000,000. Read how tall it gets.',
        'Apila billetes de $100 hasta que valgan $1,000,000. Lee qué tan alto queda.',
        'Empilhe notas de $100 até valerem $1.000.000. Leia que altura a pilha alcança.',
      )[locale],
      payload: { piece: 'bill', value: 10_000, goal: { kind: 'amount', total: 100_000_000 }, step: 400, max: 12_000 },
    }),
    rubric: { target: '10000' },
    ladder: { invalid: { value: '401' }, valid: { value: '0' }, met: { value: '10000' } },
  },
];
