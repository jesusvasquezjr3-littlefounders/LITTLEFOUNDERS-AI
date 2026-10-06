import { makeLesson, examples as E, choice as Q, modelExample } from './assemble.mjs';
const unit = 'fe-solid-06-money-over-time';
export const plans = [makeLesson({ number: 25, slug: 'what-your-money-can-buy', unit, title: ['What your money can buy', 'Lo que compra tu dinero', 'O que seu dinheiro compra'], skill: 'time.purchasing-power', kc: 'invest.inflation-buffer', prerequisites: ['price.percent', 'cash.reserved'],
  outcome: 'Distinguish an unchanged money amount from its purchasing power when the same basket of goods becomes more expensive.',
  misconception: 'Assuming that a stable account balance guarantees the ability to buy the same goods later.', numeracy: 'Use a single stated percentage increase and compare the resulting basket price with unchanged cash.',
  relevance: ['Keeping the same amount of dollars does not always preserve what it buys. These price changes are fictional examples.', 'Conservar el mismo monto de pesos no siempre mantiene lo que compra. Estos cambios de precios son ejemplos ficticios.', 'Manter o mesmo valor em reais nem sempre preserva o que ele compra. Estas mudanças de preços são exemplos fictícios.'],
  segments: [
    E('example-01', ['Same money, different price', 'Mismo dinero, otro precio', 'Mesmo dinheiro, outro preço'], ['A basket costs 100 today and 110 later. Keeping 100 does not buy the same basket at the later price.', 'Una canasta cuesta 100 hoy y 110 después. Conservar 100 no compra la misma canasta al precio posterior.', 'Uma cesta custa 100 agora e 110 depois. Manter 100 não compra a mesma cesta pelo preço posterior.']),
    E('example-02', ['Name the difference', 'Nombra la diferencia', 'Dê nome à diferença'], ['Purchasing power means what money can buy. Inflation is a general rise in prices; individual prices can change differently.', 'El poder de compra es lo que compra el dinero. La inflación es un aumento general de precios; cada precio puede cambiar distinto.', 'Poder de compra é o que o dinheiro compra. Inflação é uma alta geral de preços; cada preço pode mudar de modo diferente.']),
    modelExample('example-prices', 'money.inflation.v2', 'inflation', { currency: 'local', price_minor: 10000, min_rate_bps: 100, max_rate_bps: 500, rate_step_bps: 100, min_years: 1, max_years: 2, year_step: 1, prediction_step_minor: 100, prediction_max_minor: 20000 }, [
      'Fictional prices: compare 1% and 5% after one year. The graph spans two years.',
      'Precios ficticios: compara 1% y 5% durante un año usando la tabla. La gráfica abarca dos años, no es un pronóstico.',
      'Preços fictícios: compare 1% e 5% durante um ano usando a tabela. O gráfico abrange dois anos, não é previsão.',
    ]),
    Q('guided-01', 'guided', 'invest.inflation-buffer', 1, [
      ['Can 100 buy this basket?', 'You have 100; the same basket costs 110.', ['Yes, the balance stayed unchanged', 'No, 110 exceeds 100', 'Yes, both are money'], 'The unchanged balance no longer covers the same basket.', 'Compare what is held with the current cost of the same goods.'],
      ['¿El monto sin cambios compra la misma canasta?', 'Sigues teniendo 100. La misma canasta ahora cuesta 110.', ['Sí, porque el saldo no cambió', 'No, el precio supera el dinero que tienes', 'Sí, porque ambos montos son dinero'], 'El saldo sin cambios ya no cubre la misma canasta.', 'Compara lo que tienes con el costo actual de los mismos bienes.'],
      ['O valor sem mudanças compra a mesma cesta?', 'Você continua com 100. A mesma cesta agora custa 110.', ['Sim, porque o saldo não mudou', 'Não, o preço supera o dinheiro que tem', 'Sim, porque ambos os valores são dinheiro'], 'O saldo sem mudanças já não cobre a mesma cesta.', 'Compare o que tem com o custo atual dos mesmos bens.'],
    ]),
    Q('guided-02', 'guided', 'invest.inflation-buffer', 0, [
      ['What is the new price in this example?', 'A basket of 100 rises by 10% in the stated period.', ['110', '100', '10'], 'The price increase is added to the original basket cost.', 'Calculate the increase and add it to the original price.'],
      ['¿Cuál es el nuevo precio en este ejemplo?', 'Una canasta de 100 sube 10% en el periodo indicado.', ['110', '100', '10'], 'El aumento se suma al costo original de la canasta.', 'Calcula el aumento y súmalo al precio original.'],
      ['Qual é o novo preço neste exemplo?', 'Uma cesta de 100 sobe 10% no período informado.', ['110', '100', '10'], 'O aumento é somado ao custo original da cesta.', 'Calcule o aumento e some ao preço original.'],
    ]),
    Q('practice-01', 'practice', 'invest.inflation-buffer', 2, [
      ['Which comparison checks purchasing power?', 'Can your money still buy your usual goods?', ['Compare only account balances', 'Compare only the old prices', 'Money versus current basket cost'], 'Purchasing power connects money with current goods prices.', 'Use the current cost of the same basket.'],
      ['¿Qué comparación revisa el poder de compra?', 'Quieres saber si tu dinero todavía cubre tus bienes habituales.', ['Comparar solo el saldo consigo mismo', 'Comparar solo los precios anteriores', 'Comparar el dinero con la canasta actual'], 'El poder de compra relaciona dinero y bienes que puede comprar hoy.', 'Usa el costo actual de la misma canasta.'],
      ['Qual comparação verifica o poder de compra?', 'Você quer saber se seu dinheiro ainda cobre seus bens habituais.', ['Comparar só o saldo com ele mesmo', 'Comparar só os preços anteriores', 'Comparar o dinheiro com a cesta atual'], 'O poder de compra liga dinheiro e bens que pode comprar agora.', 'Use o custo atual da mesma cesta.'],
    ]),
    Q('practice-02', 'practice', 'invest.inflation-buffer', 0, [
      ['What does this show?', 'One price rose; other prices are unknown.', ['Only that this product price rose', 'That every price rose equally', 'The exact general inflation rate'], 'One price change alone does not establish the general inflation rate.', 'Distinguish one product from a broader set of prices.'],
      ['¿Qué demuestra este único precio?', 'Un producto subió, pero no tienes información sobre otros precios.', ['Solo que subió ese producto', 'Que todos subieron por igual', 'La tasa general exacta de inflación'], 'Un cambio de precio no establece por sí solo la inflación general.', 'Distingue un producto de un conjunto amplio de precios.'],
      ['O que esse único preço demonstra?', 'Um produto ficou mais caro, mas você não tem dados sobre outros preços.', ['Só que esse produto subiu', 'Que todos subiram igualmente', 'A taxa geral exata de inflação'], 'Uma mudança de preço não define sozinha a inflação geral.', 'Distinga um produto de um conjunto amplo de preços.'],
    ]),
    Q('practice-03', 'practice', 'invest.inflation-buffer', 1, [
      ['Can you afford the basket?', 'Money rose 100 → 105; the basket rose 100 → 110.', ['Yes, any increase suffices', 'No, 105 cannot cover 110', 'Yes, because both amounts increased'], 'A higher money amount can still fall short of the same basket.', 'Compare the two new amounts, not just whether each increased.'],
      ['¿El saldo nuevo cubre la canasta?', 'Tu dinero pasó de 100 a 105. La misma canasta pasó de 100 a 110.', ['Sí, cualquier aumento del saldo basta', 'No, la canasta cuesta más de 105', 'Sí, porque ambos montos aumentaron'], 'Un monto mayor de dinero aún puede no alcanzar para la misma canasta.', 'Compara los montos nuevos, no solo si ambos aumentaron.'],
      ['O saldo novo cobre a cesta?', 'Seu dinheiro passou de 100 para 105. A mesma cesta passou de 100 para 110.', ['Sim, qualquer aumento do saldo basta', 'Não, a cesta custa mais de 105', 'Sim, porque ambos os valores aumentaram'], 'Um valor maior ainda pode não bastar para a mesma cesta.', 'Compare os valores novos, não só se ambos aumentaram.'],
    ]),
    Q('transfer-01', 'transfer', 'invest.inflation-buffer', 2, [
      ['What happens to purchasing power?', 'You saved 200; the same repair now costs 220.', ['Higher: the balance stayed unchanged', 'Unchanged: no money was spent', 'Lower purchasing power'], 'The same reserved amount covers less of the unchanged repair.', 'Compare the reserve with the current cost of its intended use.'],
      ['¿Qué pasa con el poder de compra aquí?', 'Tienes 200; la misma reparación ahora cuesta 220.', ['Aumenta porque el número no cambió', 'Es igual porque no gastaste dinero', 'Baja para esa reparación aunque el saldo sea igual'], 'El mismo apartado cubre menos de una reparación sin cambios.', 'Compara la reserva con el costo actual del uso previsto.'],
      ['O que acontece com o poder de compra aqui?', 'Você tem 200; o mesmo conserto agora custa 220.', ['Aumenta porque o número não mudou', 'É igual porque não gastou dinheiro', 'Cai para esse conserto mesmo com saldo igual'], 'A mesma reserva cobre menos de um conserto sem mudanças.', 'Compare a reserva com o custo atual do uso previsto.'],
    ]),
  ] }), makeLesson({ number: 26, slug: 'growth-on-earlier-growth', unit, title: ['Growth on earlier growth', 'Crecimiento sobre crecimiento', 'Crescimento sobre crescimento'], skill: 'time.compound', kc: 'invest.compound-growth', prerequisites: ['price.percent', 'debt.interest', 'time.purchasing-power'],
  outcome: 'Calculate two periods of growth when earlier gains remain in the base, and distinguish this toy model from a guaranteed return.',
  misconception: 'Applying every period percentage only to the original amount or assuming a constant-rate illustration promises an actual investment result.',
  numeracy: 'Repeat the previously taught percentage calculation using the updated base; no exponent formula is assumed.',
  relevance: ['Growth can apply to earlier gains when they stay in the balance. These dollar examples use a fixed invented rate.', 'El crecimiento puede aplicarse a ganancias anteriores si permanecen en el saldo. Estos ejemplos en pesos usan una tasa fija inventada.', 'O crescimento pode incidir sobre ganhos anteriores se ficam no saldo. Estes exemplos em reais usam uma taxa fixa inventada.'],
  segments: [
    E('example-01', ['Update the base', 'Actualiza la base', 'Atualize a base'], ['At a fictional 10% per period, 100 becomes 110. Keeping the gain makes 110 the next base.', 'Con un 10% ficticio por periodo, 100 crece 10 y llega a 110. Si la ganancia permanece, el siguiente periodo empieza en 110.', 'Com 10% fictícios por período, 100 cresce 10 e chega a 110. Se o ganho fica, o próximo período começa em 110.']),
    E('example-02', ['Calculate on the new amount', 'Calcula sobre el monto nuevo', 'Calcule sobre o valor novo'], ['Next, 10% of 110 is 11, giving 121. Growth only on the original 100 would add another 10 instead.', 'Después, 10% de 110 son 11 y se llega a 121. Crecer solo sobre los 100 iniciales añadiría otros 10.', 'Depois, 10% de 110 são 11, chegando a 121. Crescer só sobre os 100 iniciais somaria outros 10.']),
    modelExample('example-growth', 'visual.growth-comparison.v2', 'multi-line', { principalMinor: 10000, minimumRateBps: 500, maximumRateBps: 1000, rateStepBps: 500, initialRateBps: 1000, minimumYears: 1, maximumYears: 5, yearStep: 1, initialYears: 1, predictionStepMinor: 100, predictionMaximumMinor: 30000 }, [
      'Toy model: 100 dollars, no fees or withdrawals. At 10% over two years, predict and compare simple versus compound growth.',
      'Modelo ficticio: 100 pesos, sin cargos ni retiros. Con 10%, pasa a dos años; predice y compara crecimiento simple y compuesto.',
      'Modelo fictício: 100 reais, sem cobranças ou retiradas. Com 10%, passe a dois anos; preveja e compare crescimento simples e composto.',
    ]),
    Q('guided-01', 'guided', 'invest.compound-growth', 0, [
      ['What is the first updated balance?', 'A toy balance of 100 grows by 10% for one period. The gain remains; nothing else changes.', ['110', '100', '10'], 'The gain is added to the starting amount.', 'Update the whole before moving to another period.'],
      ['¿Cuál es el primer saldo actualizado?', 'Un saldo ficticio de 100 crece 10% durante un periodo. La ganancia permanece; nada más cambia.', ['110', '100', '10'], 'La ganancia se suma al monto inicial.', 'Actualiza el total antes de pasar a otro periodo.'],
      ['Qual é o primeiro saldo atualizado?', 'Um saldo fictício de 100 cresce 10% durante um período. O ganho fica; nada mais muda.', ['110', '100', '10'], 'O ganho é somado ao valor inicial.', 'Atualize o total antes de passar a outro período.'],
    ]),
    Q('guided-02', 'guided', 'invest.compound-growth', 1, [
      ['Which base starts the next period?', 'The original 100 grew to 110 and all gains remain in the balance.', ['100', '110', '10'], 'Retained growth becomes part of the next period base.', 'Use the updated balance when earlier gains remain.'],
      ['¿Qué base inicia el siguiente periodo?', 'Los 100 iniciales crecieron a 110 y toda la ganancia sigue en el saldo.', ['100', '110', '10'], 'El crecimiento retenido integra la base del siguiente periodo.', 'Usa el saldo actualizado si las ganancias permanecen.'],
      ['Qual base inicia o próximo período?', 'Os 100 iniciais cresceram para 110 e todo o ganho continua no saldo.', ['100', '110', '10'], 'O crescimento mantido integra a base do próximo período.', 'Use o saldo atualizado se os ganhos permanecem.'],
    ]),
    Q('practice-01', 'practice', 'invest.compound-growth', 2, [
      ['What is the updated amount?', 'A toy balance of 200 grows by 10% for one period, with no fees or withdrawals.', ['210', '20', '220'], 'The growth amount is a share of this starting balance.', 'The same percentage applies to a different whole here.'],
      ['¿Cuál es el monto actualizado?', 'Un saldo ficticio de 200 crece 10% durante un periodo, sin cargos ni retiros.', ['210', '20', '220'], 'El crecimiento es una parte de este saldo inicial.', 'El mismo porcentaje se aplica aquí a otro total.'],
      ['Qual é o valor atualizado?', 'Um saldo fictício de 200 cresce 10% durante um período, sem cobranças ou retiradas.', ['210', '20', '220'], 'O crescimento é uma parte deste saldo inicial.', 'O mesmo percentual se aplica aqui a outro total.'],
    ]),
    Q('practice-02', 'practice', 'invest.compound-growth', 0, [
      ['How much is added this period?', 'The updated balance is 110. The fictional rate is 10% for the next period.', ['11', '10', '110'], 'Growth is calculated on the updated base, including retained gains.', 'Use the current base rather than an earlier starting amount.'],
      ['¿Cuánto se añade este periodo?', 'El saldo actualizado es 110. La tasa ficticia es 10% para el siguiente periodo.', ['11', '10', '110'], 'El crecimiento se calcula sobre la base actualizada con ganancias retenidas.', 'Usa la base actual, no un monto inicial anterior.'],
      ['Quanto é somado neste período?', 'O saldo atualizado é 110. A taxa fictícia é 10% para o próximo período.', ['11', '10', '110'], 'O crescimento é calculado sobre a base atualizada com ganhos mantidos.', 'Use a base atual, não um valor inicial anterior.'],
    ]),
    Q('practice-03', 'practice', 'invest.compound-growth', 1, [
      ['What does the fixed-rate chart establish?', 'Model: fixed positive growth, no fees or withdrawals.', ['All investments follow this path', 'Results under these assumptions', 'The best market return'], 'The chart shows a model, not a guaranteed investment result.', 'Separate the calculation assumptions from uncertain real returns.'],
      ['¿Qué demuestra la gráfica de tasa fija?', 'La gráfica supone la misma tasa positiva cada periodo y ningún cargo ni retiro.', ['Toda inversión real sigue ese camino', 'El resultado de los supuestos ficticios', 'El mayor rendimiento disponible'], 'La gráfica muestra un modelo, no un resultado de inversión garantizado.', 'Separa los supuestos de cálculo de rendimientos reales inciertos.'],
      ['O que o gráfico de taxa fixa demonstra?', 'O gráfico supõe a mesma taxa positiva a cada período e nenhuma cobrança ou retirada.', ['Todo investimento real segue esse caminho', 'O resultado das hipóteses fictícias', 'O maior retorno disponível'], 'O gráfico mostra um modelo, não um resultado de investimento garantido.', 'Separe as hipóteses do cálculo dos retornos reais incertos.'],
    ]),
    Q('transfer-01', 'transfer', 'invest.compound-growth', 2, [
      ['What is the balance after two periods?', 'Start at 200, growing 10% per period. Keep gains; no fees or withdrawals.', ['240', '220', '242'], 'The second period uses the updated amount including the first gain.', 'Update the base after each period before applying the percentage again.'],
      ['¿A cuánto llega el saldo ficticio tras dos periodos?', 'Empieza con 200, crece 10% cada periodo y conserva cada ganancia en la base. No hay cargos ni retiros.', ['240', '220', '242'], 'El segundo periodo usa el monto actualizado con la primera ganancia.', 'Actualiza la base tras cada periodo antes de aplicar de nuevo el porcentaje.'],
      ['A quanto chega o saldo fictício após dois períodos?', 'Comece com 200, cresça 10% por período e mantenha cada ganho na base. Não há cobranças ou retiradas.', ['240', '220', '242'], 'O segundo período usa o valor atualizado com o primeiro ganho.', 'Atualize a base após cada período antes de aplicar o percentual de novo.'],
    ]),
  ] })];
