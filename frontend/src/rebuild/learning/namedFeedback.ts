import type { Locale } from '../design/copyBudget';

/*
 * GAP-FIX-R6 learning (B.20 "a banner naming what was done right"; Frontend
 * Bible 02 §9.2: correct is the informational success banner that names what
 * happened, not yet is the warning banner with a hint; Appendix B §1.8; B.23
 * 10-12 "recognition tied to the specific skill demonstrated").
 *
 * A graded v2 step shows the author's `feedback.met` / `feedback.not_yet`
 * when the document carries it (Forge requires `met` from age 10). Without
 * it, the board falls back to its own named confirmation below, built from
 * the graded state, never a bare "Correct" or "That works.": `met` names the
 * action or strategy the learner used, `hint` starts with "Not yet." and
 * points at the one thing to check. Budgeted as body copy in
 * namedFeedback.test.ts (Bible 06: 12 words, x1.25 in es-MX and pt-BR).
 */
export interface NamedFeedback { met: string; hint: string }

export const NAMED_FEEDBACK_KINDS = [
  'rule-cards', 'euler', 'flowchart-walk', 'flowchart-build', 'sort-bins', 'scam', 'coin-tray', 'making-change', 'story',
  'chart-question', 'unit-price', 'rule-builder', 'amortization', 'supply-demand', 'inflation', 'rule-of-72', 'debt-payoff',
  'diversification', 'lemonade-stand', 'place-value', 'ratio-table', 'percent-grid', 'tax-bracket', 'running-ledger',
  'savings-rule', 'goal-bullet', 'bar-model-structure', 'bar-model-answer', 'fraction-area', 'fraction-line',
  'function-machine', 'schema-structure', 'schema-slots', 'schema-answer', 'worked-example', 'cpa-count', 'decide-justify',
  'growth-comparison',
] as const;
export type NamedFeedbackKind = (typeof NAMED_FEEDBACK_KINDS)[number];

type Table = Record<NamedFeedbackKind, NamedFeedback>;

const en: Table = {
  'rule-cards': { met: 'You turned only the cards that could break the rule.', hint: 'Not yet. Ask which cards could break the rule.' },
  euler: { met: 'Each item sits in the part of the picture that fits it.', hint: 'Not yet. Check each item against both circles.' },
  'flowchart-walk': { met: 'You answered each question and followed its arrow to the end.', hint: 'Not yet. Answer each question for this case, then follow it.' },
  'flowchart-build': { met: 'Your chart sends every case to the right result.', hint: 'Not yet. Test your chart on each case.' },
  'sort-bins': { met: 'Each item is in its group, with a reason that fits.', hint: 'Not yet. Reread the rule, then check each group and reason.' },
  scam: { met: 'You told the tricks apart from the real messages.', hint: 'Not yet. Look for pressure, secrets, or money for a prize.' },
  'coin-tray': { met: 'Your tray adds up to exactly {total}.', hint: 'Not yet. Add up the tray and compare it with the amount.' },
  'making-change': { met: 'You counted up from {price} to {paid} for the change.', hint: 'Not yet. Count up from the price to what was paid.' },
  story: { met: 'Your choice fits what the situation needs.', hint: 'Not yet. Think about where each choice leads.' },
  'chart-question': { met: 'You read the answer straight off the chart.', hint: 'Not yet. Read the labels, then find the value on the chart.' },
  'unit-price': { met: 'You compared the price of one to find the better buy.', hint: 'Not yet. Divide each price by how many it holds.' },
  'rule-builder': { met: 'Your rule gives the right action in every case.', hint: 'Not yet. Run your rule on each case and compare.' },
  amortization: { met: 'You found what is still owed after month {month}.', hint: 'Not yet. Each month, only the part past interest lowers the loan.' },
  'supply-demand': { met: 'You moved the right curve and read where the price goes.', hint: 'Not yet. Ask which side of the market the news changes.' },
  inflation: { met: 'Your guess grows the price year on year, not just once.', hint: "Not yet. Each year's rise applies to the new, higher price." },
  'rule-of-72': { met: 'You divided 72 by the rate: about {years} years to double.', hint: 'Not yet. Divide 72 by the yearly rate.' },
  'debt-payoff': { met: 'You compared total interest and picked the cheaper order.', hint: 'Not yet. Compare the total interest each plan pays.' },
  diversification: { met: 'Your mix meets the risk limit and the return goal together.', hint: 'Not yet. Shift the mix until both limits are met.' },
  'lemonade-stand': { met: 'Your price and cup count earn the stand its goal.', hint: 'Not yet. Change one thing a day and compare the profit.' },
  'place-value': { met: "You traded groups of ten and wrote each place's digit.", hint: 'Not yet. Count each place, and trade ten for one when full.' },
  'ratio-table': { met: 'You scaled the price by the same factor as the packs.', hint: 'Not yet. Find the price of one pack first.' },
  'percent-grid': { met: 'You shaded {percent}% and found that share of the price.', hint: 'Not yet. Shade one square for each percent, then find that share.' },
  'tax-bracket': { met: 'You taxed each slice at its own rate and found the average.', hint: "Not yet. Only income above each line pays that line's rate." },
  'running-ledger': { met: 'You added each sale, took off each cost, and kept the balance.', hint: 'Not yet. Add each sale and subtract each cost as you go.' },
  'savings-rule': { met: 'Your rule saves in exactly the cases it should.', hint: 'Not yet. Test your rule on each case before checking.' },
  'goal-bullet': { met: 'You moved the saved amount to reach the goal line.', hint: 'Not yet. Compare the bar with the goal marker.' },
  'bar-model-structure': { met: 'Your bars show how the amounts in the story fit together.', hint: 'Not yet. Decide which bar is longer, then add the parts.' },
  'bar-model-answer': { met: 'You read the unknown straight from your bar model.', hint: 'Not yet. Use the bars: which part is the unknown?' },
  'fraction-area': { met: 'You split the whole into {parts} equal parts and shaded {shaded}.', hint: 'Not yet. Make the parts equal, then count the shaded ones.' },
  'fraction-line': { met: 'You placed {value} by counting equal steps.', hint: 'Not yet. Split each whole into equal parts, then count.' },
  'function-machine': { met: 'Your rule fits every input you tried.', hint: 'Not yet. Compare how much the output grows each step.' },
  'schema-structure': { met: 'You matched the story to the schema that fits it.', hint: 'Not yet. Ask if things change, join, compare or repeat.' },
  'schema-slots': { met: 'Each number sits in the box for its role in the story.', hint: 'Not yet. Match each number to what it counts.' },
  'schema-answer': { met: 'You solved the story from the schema you built.', hint: 'Not yet. Use the schema to see which operation fits.' },
  'worked-example': { met: 'You carried the worked steps through to your own result.', hint: 'Not yet. Redo the step before yours, then use its result.' },
  'cpa-count': { met: 'You counted both groups and named the total.', hint: 'Not yet. Count the first group, then keep counting the second.' },
  'decide-justify': { met: 'Your choice and your reason both point to the goal.', hint: 'Not yet. Look again at what matters most.' },
  'growth-comparison': { met: 'You predicted how growth builds on itself over time.', hint: 'Not yet. Growth adds on top of past growth each year.' },
};

const es: Table = {
  'rule-cards': { met: 'Volteaste solo las tarjetas que podían romper la regla.', hint: 'Todavía no. Pregúntate qué tarjetas podrían romper la regla.' },
  euler: { met: 'Cada cosa quedó en la parte del dibujo que le corresponde.', hint: 'Todavía no. Revisa cada cosa con los dos círculos.' },
  'flowchart-walk': { met: 'Respondiste cada pregunta y seguiste su flecha hasta el final.', hint: 'Todavía no. Responde cada pregunta para este caso y síguela.' },
  'flowchart-build': { met: 'Tu diagrama lleva cada caso al resultado que le toca.', hint: 'Todavía no. Prueba tu diagrama con cada caso.' },
  'sort-bins': { met: 'Cada cosa está en su grupo, con una razón que encaja.', hint: 'Todavía no. Relee la regla y revisa cada grupo y razón.' },
  scam: { met: 'Distinguiste los engaños de los mensajes reales.', hint: 'Todavía no. Busca presión, secretos o dinero a cambio de un premio.' },
  'coin-tray': { met: 'Tu bandeja suma exactamente {total}.', hint: 'Todavía no. Suma la bandeja y compárala con la cantidad.' },
  'making-change': { met: 'Contaste desde {price} hasta {paid} para el cambio.', hint: 'Todavía no. Empieza en el precio y cuenta hasta lo pagado.' },
  story: { met: 'Tu elección encaja con lo que pide la situación.', hint: 'Todavía no. Piensa a dónde lleva cada opción.' },
  'chart-question': { met: 'Leíste la respuesta directo de la gráfica.', hint: 'Todavía no. Lee las etiquetas y busca el valor en la gráfica.' },
  'unit-price': { met: 'Comparaste el precio de una unidad para hallar la mejor compra.', hint: 'Todavía no. Divide cada precio entre cuántas unidades trae.' },
  'rule-builder': { met: 'Tu regla da la acción que toca en cada caso.', hint: 'Todavía no. Prueba tu regla con cada caso y compara.' },
  amortization: { met: 'Hallaste lo que aún se debe tras el mes {month}.', hint: 'Todavía no. Cada mes, solo lo que pasa del interés baja la deuda.' },
  'supply-demand': { met: 'Moviste la curva que tocaba y leíste hacia dónde va el precio.', hint: 'Todavía no. Pregúntate qué lado del mercado cambia la noticia.' },
  inflation: { met: 'Tu estimación hace crecer el precio año tras año, no una vez.', hint: 'Todavía no. Cada aumento se aplica al precio nuevo, más alto.' },
  'rule-of-72': { met: 'Dividiste 72 entre la tasa: unos {years} años para duplicar.', hint: 'Todavía no. Divide 72 entre la tasa anual.' },
  'debt-payoff': { met: 'Comparaste el interés total y elegiste el orden más barato.', hint: 'Todavía no. Compara el interés total que paga cada plan.' },
  diversification: { met: 'Tu mezcla cumple el límite de riesgo y la meta de ganancia.', hint: 'Todavía no. Ajusta la mezcla hasta cumplir los dos límites.' },
  'lemonade-stand': { met: 'Tu precio y tus vasos llevan al puesto a su meta.', hint: 'Todavía no. Cambia una cosa por día y compara la ganancia.' },
  'place-value': { met: 'Cambiaste grupos de diez y escribiste la cifra de cada lugar.', hint: 'Todavía no. Cuenta cada lugar y cambia diez por uno al llenarse.' },
  'ratio-table': { met: 'Escalaste el precio por el mismo factor que los paquetes.', hint: 'Todavía no. Primero halla el precio de un paquete.' },
  'percent-grid': { met: 'Sombreaste {percent}% y hallaste esa parte del precio.', hint: 'Todavía no. Sombrea un cuadro por punto y halla esa parte.' },
  'tax-bracket': { met: 'Gravaste cada tramo con su tasa y hallaste el promedio.', hint: 'Todavía no. Solo el ingreso sobre cada límite paga esa tasa.' },
  'running-ledger': { met: 'Sumaste cada venta, restaste cada costo y llevaste el saldo.', hint: 'Todavía no. Suma cada venta y resta cada costo sobre la marcha.' },
  'savings-rule': { met: 'Tu regla ahorra justo en los casos que debe.', hint: 'Todavía no. Prueba tu regla en cada caso antes de comprobar.' },
  'goal-bullet': { met: 'Moviste lo ahorrado hasta llegar a la línea de la meta.', hint: 'Todavía no. Compara la barra con la marca de la meta.' },
  'bar-model-structure': { met: 'Tus barras muestran cómo encajan las cantidades de la historia.', hint: 'Todavía no. Decide qué barra es más larga y luego agrega las partes.' },
  'bar-model-answer': { met: 'Leíste la incógnita directo de tu modelo de barras.', hint: 'Todavía no. Usa las barras: ¿qué parte es la incógnita?' },
  'fraction-area': { met: 'Dividiste el entero en {parts} partes iguales y sombreaste {shaded}.', hint: 'Todavía no. Haz partes iguales y cuenta las sombreadas.' },
  'fraction-line': { met: 'Ubicaste {value} contando pasos iguales.', hint: 'Todavía no. Divide cada entero en partes iguales y cuenta.' },
  'function-machine': { met: 'Tu regla sirve para cada entrada que probaste.', hint: 'Todavía no. Compara cuánto crece la salida en cada paso.' },
  'schema-structure': { met: 'Relacionaste la historia con el esquema que le queda.', hint: 'Todavía no. Pregúntate si algo cambia, se junta, se compara o se repite.' },
  'schema-slots': { met: 'Cada número quedó en la caja de su papel en la historia.', hint: 'Todavía no. Relaciona cada número con lo que cuenta.' },
  'schema-answer': { met: 'Resolviste la historia con el esquema que armaste.', hint: 'Todavía no. Usa el esquema para ver qué operación va.' },
  'worked-example': { met: 'Seguiste los pasos resueltos hasta tu propio resultado.', hint: 'Todavía no. Rehaz el paso anterior y usa su resultado.' },
  'cpa-count': { met: 'Contaste los dos grupos y dijiste el total.', hint: 'Todavía no. Cuenta el primer grupo y sigue contando el segundo.' },
  'decide-justify': { met: 'Tu elección y tu razón apuntan a la meta.', hint: 'Todavía no. Mira otra vez qué importa más.' },
  'growth-comparison': { met: 'Predijiste cómo el crecimiento se suma sobre sí mismo con el tiempo.', hint: 'Todavía no. Cada año, el crecimiento se suma al crecimiento anterior.' },
};

const pt: Table = {
  'rule-cards': { met: 'Você virou só as cartas que podiam quebrar a regra.', hint: 'Ainda não. Pergunte quais cartas poderiam quebrar a regra.' },
  euler: { met: 'Cada item ficou na parte da figura que combina com ele.', hint: 'Ainda não. Confira cada item com os dois círculos.' },
  'flowchart-walk': { met: 'Você respondeu cada pergunta e seguiu a seta até o fim.', hint: 'Ainda não. Responda cada pergunta para este caso e siga a seta.' },
  'flowchart-build': { met: 'Seu diagrama leva cada caso ao resultado que cabe a ele.', hint: 'Ainda não. Teste seu diagrama em cada caso.' },
  'sort-bins': { met: 'Cada item está no seu grupo, com um motivo que combina.', hint: 'Ainda não. Releia a regra e confira cada grupo e motivo.' },
  scam: { met: 'Você separou os golpes das mensagens reais.', hint: 'Ainda não. Procure pressão, segredos ou dinheiro em troca de prêmio.' },
  'coin-tray': { met: 'Sua bandeja soma exatamente {total}.', hint: 'Ainda não. Some a bandeja e compare com o valor.' },
  'making-change': { met: 'Você contou de {price} até {paid} para o troco.', hint: 'Ainda não. Comece no preço e conte até o valor pago.' },
  story: { met: 'Sua escolha combina com o que a situação pede.', hint: 'Ainda não. Pense aonde cada opção leva.' },
  'chart-question': { met: 'Você leu a resposta direto do gráfico.', hint: 'Ainda não. Leia os rótulos e procure o valor no gráfico.' },
  'unit-price': { met: 'Você comparou o preço de uma unidade para achar a melhor compra.', hint: 'Ainda não. Divida cada preço pela quantidade que vem.' },
  'rule-builder': { met: 'Sua regra dá a ação que cabe em cada caso.', hint: 'Ainda não. Teste sua regra em cada caso e compare.' },
  amortization: { met: 'Você achou o que ainda se deve após o mês {month}.', hint: 'Ainda não. A cada mês, só o que passa dos juros reduz a dívida.' },
  'supply-demand': { met: 'Você moveu a curva que mudou e leu para onde vai o preço.', hint: 'Ainda não. Pergunte qual lado do mercado a notícia muda.' },
  inflation: { met: 'Seu palpite faz o preço crescer ano após ano, não uma vez.', hint: 'Ainda não. Cada aumento vale sobre o preço novo, mais alto.' },
  'rule-of-72': { met: 'Você dividiu 72 pela taxa: uns {years} anos para dobrar.', hint: 'Ainda não. Divida 72 pela taxa anual.' },
  'debt-payoff': { met: 'Você comparou os juros totais e escolheu a ordem mais barata.', hint: 'Ainda não. Compare os juros totais de cada plano.' },
  diversification: { met: 'Sua mistura cumpre o limite de risco e a meta de retorno.', hint: 'Ainda não. Ajuste a mistura até cumprir os dois limites.' },
  'lemonade-stand': { met: 'Seu preço e seus copos levam a barraca à meta.', hint: 'Ainda não. Mude uma coisa por dia e compare o lucro.' },
  'place-value': { met: 'Você trocou grupos de dez e escreveu o algarismo de cada casa.', hint: 'Ainda não. Conte cada casa e troque dez por um quando encher.' },
  'ratio-table': { met: 'Você escalou o preço pelo mesmo fator dos pacotes.', hint: 'Ainda não. Primeiro ache o preço de um pacote.' },
  'percent-grid': { met: 'Você pintou {percent}% e achou essa parte do preço.', hint: 'Ainda não. Pinte um quadrado por ponto e ache essa parte.' },
  'tax-bracket': { met: 'Você tributou cada faixa com sua alíquota e achou a média.', hint: 'Ainda não. Só a renda acima de cada limite paga essa alíquota.' },
  'running-ledger': { met: 'Você somou cada venda, tirou cada custo e manteve o saldo.', hint: 'Ainda não. Some cada venda e tire cada custo pelo caminho.' },
  'savings-rule': { met: 'Sua regra guarda exatamente nos casos em que deve.', hint: 'Ainda não. Teste sua regra em cada caso antes de conferir.' },
  'goal-bullet': { met: 'Você moveu o valor guardado até a linha da meta.', hint: 'Ainda não. Compare a barra com a marca da meta.' },
  'bar-model-structure': { met: 'Suas barras mostram como as quantias da história se encaixam.', hint: 'Ainda não. Decida qual barra é mais longa e depois some as partes.' },
  'bar-model-answer': { met: 'Você leu a incógnita direto do seu modelo de barras.', hint: 'Ainda não. Use as barras: qual parte é a incógnita?' },
  'fraction-area': { met: 'Você dividiu o inteiro em {parts} partes iguais e pintou {shaded}.', hint: 'Ainda não. Faça partes iguais e conte as pintadas.' },
  'fraction-line': { met: 'Você posicionou {value} contando passos iguais.', hint: 'Ainda não. Divida cada inteiro em partes iguais e conte.' },
  'function-machine': { met: 'Sua regra serve para cada entrada que você testou.', hint: 'Ainda não. Compare quanto a saída cresce a cada passo.' },
  'schema-structure': { met: 'Você ligou a história ao esquema que combina com ela.', hint: 'Ainda não. Pergunte se algo muda, se junta, se compara ou se repete.' },
  'schema-slots': { met: 'Cada número ficou na caixa do seu papel na história.', hint: 'Ainda não. Ligue cada número ao que ele conta.' },
  'schema-answer': { met: 'Você resolveu a história com o esquema que montou.', hint: 'Ainda não. Use o esquema para ver qual conta combina.' },
  'worked-example': { met: 'Você seguiu os passos resolvidos até o seu próprio resultado.', hint: 'Ainda não. Refaça o passo anterior e use o resultado dele.' },
  'cpa-count': { met: 'Você contou os dois grupos e disse o total.', hint: 'Ainda não. Conte o primeiro grupo e continue contando o segundo.' },
  'decide-justify': { met: 'Sua escolha e seu motivo apontam para a meta.', hint: 'Ainda não. Veja de novo o que importa mais.' },
  'growth-comparison': { met: 'Você previu como o crescimento se soma a si mesmo com o tempo.', hint: 'Ainda não. A cada ano, o crescimento se soma ao anterior.' },
};

export const namedFeedbackCopy: Readonly<Record<Locale, Table>> = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };

/** The board's named confirmation and hint, with the graded state filled in ({total}, {month}, ...). */
export function namedFeedback(locale: Locale, kind: NamedFeedbackKind, values: Readonly<Record<string, string | number>> = {}): NamedFeedback {
  const entry = namedFeedbackCopy[locale][kind];
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
  return { met: fill(entry.met), hint: fill(entry.hint) };
}
