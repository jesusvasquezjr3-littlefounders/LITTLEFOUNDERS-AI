import { makeLesson, examples as E, choice as Q, unitPrice, percent } from './assemble.mjs';
const unit = 'fe-solid-03-compare-before-paying';
const k = 'money.unit-price';
export const plans = [makeLesson({ number: 12, slug: 'compare-equal-units', unit, title: ['Compare equal units', 'Compara unidades iguales', 'Compare unidades iguais'],
  skill: 'price.unit', kc: k, prerequisites: ['cash.balance', 'plan.priority'],
  outcome: 'Calculate a price per equal unit and distinguish the least unit price from an affordable, useful purchase.',
  misconception: 'Assuming the largest package or lowest total price always gives the lowest price per usable unit.', numeracy: 'A worked example splits a total into equal repeated parts before naming division; assessed unit prices are whole numbers.',
  relevance: ['Package sizes differ. Compare prices in dollars for equal units before deciding what fits your actual needs.', 'Los paquetes tienen tamaños distintos. Compara precios en pesos por unidades iguales antes de decidir qué necesitas.', 'Os pacotes têm tamanhos diferentes. Compare preços em reais por unidades iguais antes de decidir o que precisa.'],
  segments: [
    E('example-01', ['Split into equal parts', 'Reparte en partes iguales', 'Divida em partes iguais'], ['Two equal bars cost 20: 10 + 10 = 20, so each costs 10. Dividing 20 by 2 gives 10.', 'Dos barras iguales cuestan 20: 10 + 10 = 20, así que cada una cuesta 10. Dividir 20 entre 2 da 10.', 'Duas barras iguais custam 20: 10 + 10 = 20, então cada uma custa 10. Dividir 20 por 2 dá 10.']),
    E('example-02', ['Compare the same unit', 'Compara la misma unidad', 'Compare a mesma unidade'], ['Another pack has three equal bars for 24: 8 + 8 + 8 = 24. Its price per bar is lower.', 'Otro paquete tiene tres barras iguales por 24: 8 + 8 + 8 = 24. Su precio por barra es menor.', 'Outro pacote tem três barras iguais por 24: 8 + 8 + 8 = 24. Seu preço por barra é menor.']),
    unitPrice('guided-01', 'guided', [2, 3], [20, 24], [
      ['Enter each price per equal bar, then choose the lower one. Split each total by its quantity.', 'bar', ['Two equal bars', 'Three equal bars'], 'You compared the price of the same unit in both packs.', 'Divide each total by the number of equal bars.'],
      ['Escribe cada precio por barra igual y elige el menor. Reparte cada total entre su cantidad.', 'barra', ['Dos barras iguales', 'Tres barras iguales'], 'Comparaste el precio de la misma unidad en ambos paquetes.', 'Divide cada total entre el número de barras iguales.'],
      ['Digite cada preço por barra igual e escolha o menor. Divida cada total pela quantidade.', 'barra', ['Duas barras iguais', 'Três barras iguais'], 'Você comparou o preço da mesma unidade nos dois pacotes.', 'Divida cada total pelo número de barras iguais.'],
    ]),
    Q('guided-02', 'guided', k, 2, [
      ['Does unit price settle the purchase?', 'The cheaper pack per bar exceeds your spending limit.', ['Yes, always buy that pack', 'Yes, ignore the total price', 'No, check the total'], 'A unit-price comparison does not remove the spending limit.', 'Check both value per unit and the total you must pay.'],
      ['¿El menor precio unitario decide la compra?', 'El paquete más barato por barra cuesta en total más de lo que puedes gastar hoy.', ['Sí, siempre compra ese paquete', 'Sí, ignora el precio total', 'No, el total también debe caber'], 'Comparar precios unitarios no elimina el límite de gasto.', 'Comprueba el valor por unidad y el total que debes pagar.'],
      ['O menor preço unitário decide a compra?', 'O pacote mais barato por barra custa no total mais do que você pode gastar hoje.', ['Sim, sempre compre esse pacote', 'Sim, ignore o preço total', 'Não, o total também deve caber'], 'Comparar preços unitários não elimina o limite de gasto.', 'Confira o valor por unidade e o total que precisa pagar.'],
    ]),
    unitPrice('practice-01', 'practice', [4, 6], [28, 48], [
      ['These equal cans contain the same amount. Find each unit price and select the lower one.', 'can', ['Four equal cans', 'Six equal cans'], 'The larger pack did not automatically offer the lower unit price.', 'Compare one equal can from each pack.'],
      ['Estas latas iguales contienen lo mismo. Halla cada precio unitario y elige el menor.', 'lata', ['Cuatro latas iguales', 'Seis latas iguales'], 'El paquete grande no ofrecía automáticamente el menor precio unitario.', 'Compara una lata igual de cada paquete.'],
      ['Estas latas iguais contêm a mesma quantidade. Ache cada preço unitário e escolha o menor.', 'lata', ['Quatro latas iguais', 'Seis latas iguais'], 'O pacote maior não oferecia automaticamente o menor preço unitário.', 'Compare uma lata igual de cada pacote.'],
    ]),
    Q('practice-02', 'practice', k, 1, [
      ['What must be checked first?', 'Unequal bottles: the smaller has the lower price.', ['Only the number of bottles', 'The price for an equal volume', 'Only which bottle is cheaper'], 'Different bottle sizes are not equal comparison units.', 'Use the same amount of product in both comparisons.'],
      ['¿Qué debes comprobar primero?', 'Una botella es mucho mayor que otra. La pequeña cuesta menos por botella.', ['Solo el número de botellas', 'El precio por un volumen igual', 'Solo cuál botella cuesta menos'], 'Botellas de distintos tamaños no son unidades iguales.', 'Usa la misma cantidad de producto en ambas comparaciones.'],
      ['O que conferir primeiro?', 'Uma garrafa é muito maior que a outra. A pequena custa menos por garrafa.', ['Só o número de garrafas', 'O preço por um volume igual', 'Só qual garrafa custa menos'], 'Garrafas de tamanhos diferentes não são unidades iguais.', 'Use a mesma quantidade de produto nas duas comparações.'],
    ]),
    Q('practice-03', 'practice', k, 0, [
      ['What cancels the saving?', 'A pack costs less per portion but will spoil before you finish it.', ['Paying for wasted portions', 'Comparing equal portions', 'Knowing the total price'], 'Unused spoiled portions reduce the value of the purchase.', 'Compare useful portions, not just everything inside the pack.'],
      ['¿Qué puede eliminar el ahorro aparente?', 'Un paquete de comida cuesta menos por porción igual, pero no lo usarás antes de que se eche a perder.', ['Pagar por porciones que no usarás', 'Comparar porciones iguales', 'Conocer el precio total'], 'Las porciones desperdiciadas reducen el valor de la compra.', 'Compara porciones útiles, no solo todo lo que trae el paquete.'],
      ['O que pode eliminar a economia aparente?', 'Um pacote de comida custa menos por porção igual, mas não será usado antes de estragar.', ['Pagar por porções que não usará', 'Comparar porções iguais', 'Conhecer o preço total'], 'As porções desperdiçadas reduzem o valor da compra.', 'Compare porções úteis, não só tudo que vem no pacote.'],
    ]),
    unitPrice('transfer-01', 'transfer', [3, 5], [27, 40], [
      ['Compare equal replacement filters. Enter the price of one filter in each pack and select the lower unit price.', 'filter', ['Three equal filters', 'Five equal filters'], 'You compared equal units in a new purchase context.', 'Divide each pack price by the filters it contains.'],
      ['Compara filtros de reemplazo iguales. Escribe el precio de un filtro en cada paquete y elige el menor.', 'filtro', ['Tres filtros iguales', 'Cinco filtros iguales'], 'Comparaste unidades iguales en una nueva situación de compra.', 'Divide el precio de cada paquete entre los filtros que contiene.'],
      ['Compare filtros de reposição iguais. Digite o preço de um filtro em cada pacote e escolha o menor.', 'filtro', ['Três filtros iguais', 'Cinco filtros iguais'], 'Você comparou unidades iguais em uma nova situação de compra.', 'Divida o preço de cada pacote pelos filtros que contém.'],
    ]),
  ] }), makeLesson({ number: 13, slug: 'a-percent-is-a-share', unit, title: ['A percent is a share', 'Un porcentaje es una parte', 'Um percentual é uma parte'],
  skill: 'price.percent', kc: 'money.percent-intro', prerequisites: ['cash.balance', 'price.unit'],
  outcome: 'Interpret a percentage as parts of a hundred and calculate a discount amount from its stated original price.',
  misconception: 'Treating the percent number as a fixed currency amount regardless of the original price.', numeracy: 'The grid divides the whole into a hundred equal parts; examples show bases of 100 and 200 before independent use.',
  relevance: ['A discount removes part of a price. These examples use dollars; percentages describe shares, not fixed amounts.', 'Un descuento quita parte del precio. En estos ejemplos en pesos, el porcentaje indica una parte, no un monto fijo.', 'Um desconto retira parte do preço. Nestes exemplos em reais, o percentual indica uma parte, não um valor fixo.'],
  segments: [
    E('example-01', ['Parts of a hundred', 'Partes de cien', 'Partes de cem'], ['Percent means out of a hundred. A 20% discount on 100 removes 20; each grid square represents one equal part.', 'Por ciento significa de cada cien. Un descuento de 20% sobre 100 quita 20; cada cuadro representa una parte igual.', 'Por cento significa de cada cem. Um desconto de 20% sobre 100 retira 20; cada quadrado representa uma parte igual.']),
    percent('example-02', 'example', 100, 20, [
      ['Move the grid to 20%. See how 20 of the 100 equal parts become the discount amount.'],
      ['Mueve la cuadrícula a 20%. Observa cómo 20 de las 100 partes iguales forman el descuento.'],
      ['Mova a grade para 20%. Veja como 20 das 100 partes iguais formam o desconto.'],
    ]),
    percent('guided-01', 'guided', 100, 30, [
      ['Set a 30% discount on 100 and enter the discount amount. Each square represents one unit here.', 'You matched the share to the amount of this whole.', 'Discount means the removed amount. Count marked parts, not the remainder.'],
      ['Marca un descuento de 30% sobre 100 y escribe su monto. Aquí cada cuadro representa una unidad.', 'Relacionaste la parte con el monto de este total.', 'El descuento es lo que quitas, no el precio final. Cuenta las partes marcadas.'],
      ['Marque um desconto de 30% sobre 100 e digite seu valor. Aqui cada quadrado representa uma unidade.', 'Você relacionou a parte ao valor deste total.', 'O desconto é o que retira, não o preço final. Conte as partes marcadas.'],
    ]),
    E('example-03', ['A different whole', 'Un total distinto', 'Um total diferente'], ['For a price of 200, each hundredth is 2. A 10% share is ten parts: 10 × 2 = 20.', 'Con un precio de 200, cada centésima parte vale 2. Un 10% son diez partes: 10 × 2 = 20.', 'Com um preço de 200, cada centésima parte vale 2. Um 10% são dez partes: 10 × 2 = 20.']),
    percent('guided-02', 'guided', 200, 10, [
      ['Set 10% of 200 and enter the discount amount. Each equal part represents 2.', 'You used the original price to value each equal part.', 'The percent chooses parts; the original price sets their value.'],
      ['Marca 10% de 200 y escribe el descuento. Cada parte igual representa 2.', 'Usaste el precio original para valorar cada parte igual.', 'El porcentaje elige partes; el precio original determina su valor.'],
      ['Marque 10% de 200 e digite o desconto. Cada parte igual representa 2.', 'Você usou o preço original para valorar cada parte igual.', 'O percentual escolhe partes; o preço original define seu valor.'],
    ]),
    percent('practice-01', 'practice', 200, 25, [
      ['A 200 item has a 25% discount. Set the percentage and enter the discount amount.', 'The amount matches this share of the original price.', 'Use the stated original price, not the percentage alone.'],
      ['Un artículo de 200 tiene 25% de descuento. Marca el porcentaje y escribe el monto descontado.', 'El monto corresponde a esta parte del precio original.', 'Usa el precio original, no solo el porcentaje.'],
      ['Um item de 200 tem 25% de desconto. Marque o percentual e digite o valor descontado.', 'O valor corresponde a esta parte do preço original.', 'Use o preço original, não só o percentual.'],
    ]),
    Q('practice-02', 'practice', 'money.percent-intro', 1, [
      ['Does equal percent mean equal amount?', 'Different prices offer the same discount percentage.', ['Always the same amount', 'No, the original price matters', 'Only the percent number matters'], 'The same share of different wholes can have different amounts.', 'A percent always refers to a particular whole.'],
      ['¿Igual porcentaje significa igual monto?', 'Dos precios son distintos, pero ofrecen el mismo porcentaje de descuento.', ['Siempre el mismo monto', 'No, importa el precio original', 'Solo importa el porcentaje'], 'La misma parte de totales distintos puede dar montos distintos.', 'Un porcentaje siempre se refiere a un total concreto.'],
      ['Percentuais iguais dão valores iguais?', 'Dois preços são diferentes, mas oferecem o mesmo percentual de desconto.', ['Sempre o mesmo valor', 'Não, o preço original importa', 'Só o percentual importa'], 'A mesma parte de totais diferentes pode dar valores diferentes.', 'Um percentual sempre se refere a um total específico.'],
    ]),
    percent('practice-03', 'practice', 400, 10, [
      ['A repair quote of 400 offers 10% off. Set the percentage and enter the amount removed.', 'You found the stated share of a different original amount.', 'Split the original amount into equal hundredths.'],
      ['Una reparación cotizada en 400 ofrece 10% de descuento. Marca el porcentaje y escribe lo que se quita.', 'Hallaste la parte indicada de otro monto original.', 'Reparte el monto original en cien partes iguales.'],
      ['Um conserto orçado em 400 oferece 10% de desconto. Marque o percentual e digite o valor retirado.', 'Você achou a parte indicada de outro valor original.', 'Divida o valor original em cem partes iguais.'],
    ]),
    percent('transfer-01', 'transfer', 300, 20, [
      ['A maintenance service priced at 300 offers 20% off. Set the percentage and enter the discount amount.', 'You used the whole and its share in a new context.', 'The whole is the stated service price before the discount.'],
      ['Un mantenimiento de 300 ofrece 20% de descuento. Marca el porcentaje y escribe el monto descontado.', 'Usaste el total y su parte en una situación nueva.', 'El total es el precio del servicio antes del descuento.'],
      ['Uma manutenção de 300 oferece 20% de desconto. Marque o percentual e digite o valor descontado.', 'Você usou o total e sua parte em uma situação nova.', 'O total é o preço do serviço antes do desconto.'],
    ]),
  ] })];
