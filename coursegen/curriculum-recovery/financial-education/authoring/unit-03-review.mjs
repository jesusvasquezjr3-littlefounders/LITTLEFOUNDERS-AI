import { makeLesson, examples as E, choice as Q } from './assemble.mjs';
const unit = 'fe-solid-03-compare-before-paying';
const k = 'money.percent-intro';
export const plans = [makeLesson({ number: 14, slug: 'compare-the-final-price', unit, title: ['Compare the final price', 'Compara el precio final', 'Compare o preço final'], skill: 'price.final', kc: k, prerequisites: ['price.percent', 'price.unit', 'cash.reserved'],
  outcome: 'Compare final purchase costs after a stated discount and mandatory fee, using the same item and payment conditions.',
  misconception: 'Choosing the biggest discount percentage while ignoring the original price or a mandatory delivery charge.', numeracy: 'The worked example calculates the percentage reduction, subtracts it, then adds the stated fee.',
  relevance: ['A large discount can still leave a higher final price. Compare what you actually have to pay.', 'Un descuento grande puede dejar un precio final mayor. Compara lo que realmente tienes que pagar.', 'Um desconto grande pode deixar um preço final maior. Compare o que realmente precisa pagar.'],
  segments: [
    E('example-01', ['From offer to total', 'De la oferta al total', 'Da oferta ao total'], ['A price of 100 with 20% off removes 20, leaving 80. A required delivery charge of 10 makes 90 total.', 'Un precio de 100 con 20% de descuento quita 20 y deja 80. Un envío obligatorio de 10 da 90 en total.', 'Um preço de 100 com 20% de desconto retira 20 e deixa 80. Um frete obrigatório de 10 dá 90 no total.']),
    E('example-02', ['Use the same comparison', 'Usa la misma comparación', 'Use a mesma comparação'], ['The same item costs 85 elsewhere with delivery included. Its final price is lower, despite having no discount label.', 'El mismo artículo cuesta 85 en otra tienda con envío incluido. Su precio final es menor, aunque no anuncie descuento.', 'O mesmo item custa 85 em outra loja com frete incluído. Seu preço final é menor, mesmo sem anunciar desconto.']),
    Q('guided-01', 'guided', k, 2, [
      ['What is the final total?', 'The discounted item costs 80; required delivery costs 10.', ['80', '10', '90'], 'The total includes both the item and required delivery.', 'Add every mandatory charge, not just the advertised item price.'],
      ['¿Cuál es el total final?', 'El artículo descontado cuesta 80; el envío obligatorio cuesta 10.', ['80', '10', '90'], 'El total incluye el artículo y el envío obligatorio.', 'Suma cada cargo obligatorio, no solo el precio anunciado.'],
      ['Qual é o total final?', 'O item com desconto custa 80; o frete obrigatório custa 10.', ['80', '10', '90'], 'O total inclui o item e o frete obrigatório.', 'Some cada cobrança obrigatória, não só o preço anunciado.'],
    ]),
    Q('guided-02', 'guided', k, 0, [
      ['Which final price is lower?', 'The identical item costs 90 including delivery in one store and 85 including delivery in another.', ['85', '90', '175'], 'The identical item and included delivery make the totals comparable.', 'Compare complete prices under the same conditions.'],
      ['¿Qué precio final es menor?', 'El artículo idéntico cuesta 90 con envío en una tienda y 85 con envío en otra.', ['85', '90', '175'], 'El artículo idéntico y el envío incluido permiten comparar los totales.', 'Compara precios completos en las mismas condiciones.'],
      ['Qual preço final é menor?', 'O item idêntico custa 90 com frete em uma loja e 85 com frete em outra.', ['85', '90', '175'], 'O item idêntico e o frete incluído permitem comparar os totais.', 'Compare preços completos nas mesmas condições.'],
    ]),
    Q('practice-01', 'practice', k, 1, [
      ['What do you pay after the discount?', 'A price of 200 has 10% off and no extra fees.', ['20', '180', '190'], 'The discount amount is removed from the original price.', 'Calculate the share first, then subtract it from the price.'],
      ['¿Cuánto pagas tras el descuento?', 'Un precio de 200 tiene 10% de descuento y ningún cargo extra.', ['20', '180', '190'], 'El monto del descuento se resta al precio original.', 'Calcula primero la parte y luego réstala al precio.'],
      ['Quanto paga após o desconto?', 'Um preço de 200 tem 10% de desconto e nenhuma cobrança extra.', ['20', '180', '190'], 'O valor do desconto é subtraído do preço original.', 'Calcule primeiro a parte e depois subtraia do preço.'],
    ]),
    Q('practice-02', 'practice', k, 2, [
      ['Which offer costs less?', 'Identical items, no fees: A costs 200 minus 25%; B costs 140.', ['A offers a discount', 'Both cost the same', 'B has the lower total'], 'The larger discount label does not guarantee the lower final price.', 'Calculate the reduced amount before comparing it with the other price.'],
      ['¿Qué oferta cuesta menos?', 'Artículos idénticos: A cuesta 200 con 25% de descuento; B cuesta 140 sin descuento. No hay cargos extra.', ['A, por su mayor porcentaje', 'Ambas cuestan lo mismo', 'B, por su menor total final'], 'Un descuento mayor no garantiza el menor precio final.', 'Calcula el precio reducido antes de compararlo con el otro.'],
      ['Qual oferta custa menos?', 'Itens idênticos: A custa 200 com 25% de desconto; B custa 140 sem desconto. Não há cobranças extras.', ['A, por seu maior percentual', 'Ambas custam o mesmo', 'B, por seu menor total final'], 'Um desconto maior não garante o menor preço final.', 'Calcule o preço reduzido antes de compará-lo com o outro.'],
    ]),
    Q('practice-03', 'practice', k, 0, [
      ['Can you compare totals?', 'One price includes delivery; another omits its mandatory delivery fee.', ['No, delivery costs are missing', 'Yes, compare only item prices', 'Yes, delivery is free'], 'A missing mandatory cost prevents a complete comparison.', 'A price omitted from an advertisement is not necessarily zero.'],
      ['¿Puedes confirmar cuál cuesta menos?', 'Un vendedor incluye envío. Otro no indica cuánto cobra por el envío obligatorio.', ['No, falta conocer ese cargo', 'Sí, compara solo los artículos', 'Sí, supone que el envío es gratis'], 'Un costo obligatorio desconocido impide comparar el total.', 'Un precio omitido en el anuncio no equivale a cero.'],
      ['Pode confirmar qual custa menos?', 'Um vendedor inclui frete. Outro não informa quanto cobra pelo frete obrigatório.', ['Não, falta conhecer essa cobrança', 'Sim, compare só os itens', 'Sim, suponha que o frete é grátis'], 'Um custo obrigatório desconhecido impede comparar o total.', 'Um preço omitido no anúncio não equivale a zero.'],
    ]),
    Q('transfer-01', 'transfer', k, 1, [
      ['Which fits your 100 limit?', 'Same service: A costs 90 plus 20 mandatory fees; B costs 100 total.', ['A advertises less', 'B fits the limit', 'Both fit'], 'The full cost, including required fees, determines whether it fits.', 'Apply the spending limit after including all mandatory charges.'],
      ['¿Qué total cabe en tu límite de 100?', 'Mismo servicio: A cobra 90 más 20 obligatorios; B cobra 100 en total.', ['A, por su precio anunciado menor', 'B, porque su total completo cabe', 'Ambos caben en el límite indicado'], 'El costo completo con cargos obligatorios determina si cabe.', 'Aplica el límite después de incluir todos los cargos obligatorios.'],
      ['Qual total cabe no limite de 100?', 'Mesmo serviço: A cobra 90 mais 20 obrigatórios; B cobra 100 no total.', ['A, por seu preço anunciado menor', 'B, porque seu total completo cabe', 'Ambos cabem no limite informado'], 'O custo completo com cobranças obrigatórias determina se cabe.', 'Aplique o limite após incluir todas as cobranças obrigatórias.'],
    ]),
  ] }), makeLesson({ number: 15, slug: 'make-a-purchase-plan', unit, kind: 'consolidate', title: ['Make a purchase plan', 'Prepara una compra', 'Prepare uma compra'], skill: 'price.unit', kc: 'money.unit-price', prerequisites: ['cash.balance', 'plan.priority'], retrieve: ['plan.revise', 'price.unit', 'price.percent'],
  outcome: 'Combine a revised spending limit, equal-unit comparison and percentage interpretation in new purchase decisions.', misconception: 'Keeping calculation skills separate from the actual spending constraint.', numeracy: 'Recall equal sharing, percentage amounts and subtraction from earlier lessons.',
  relevance: ['A purchase can have good unit value and still not fit the plan. Use the calculations together.', 'Una compra puede tener buen precio unitario y aun así no caber en el plan. Usa los cálculos juntos.', 'Uma compra pode ter bom preço unitário e ainda não caber no plano. Use os cálculos juntos.'],
  evidenceSkills: { 'practice-01': 'plan.revise', 'practice-02': 'price.percent', 'practice-04': 'price.percent', 'practice-05': 'plan.revise' },
  segments: [
    Q('practice-01', 'practice', 'life.review-and-adjust-plan', 0, [
      ['What is the revised optional limit?', 'You had 60 for optional purchases. A required repair used an extra 20; no extra money arrived.', ['40', '60', '80'], 'The new limit accounts for the actual extra expense.', 'Revise the optional amount using the completed payment.'],
      ['¿Cuál es el nuevo límite opcional?', 'Tenías 60 para compras opcionales. Una reparación necesaria usó 20 extra; no llegó más dinero.', ['40', '60', '80'], 'El nuevo límite considera el gasto adicional real.', 'Ajusta el monto opcional usando el pago realizado.'],
      ['Qual é o novo limite opcional?', 'Você tinha 60 para compras opcionais. Um conserto necessário usou 20 extras; não chegou mais dinheiro.', ['40', '60', '80'], 'O novo limite considera o gasto adicional real.', 'Ajuste o valor opcional usando o pagamento realizado.'],
    ]),
    Q('practice-02', 'practice', 'money.percent-intro', 2, [
      ['How much is the discount?', 'A price of 400 has 25% off. Find the amount removed, not the final price.', ['25', '300', '100'], 'The share is calculated from the stated original amount.', 'The percentage and the currency amount are different quantities.'],
      ['¿Cuánto es el descuento?', 'Un precio de 400 tiene 25% de descuento. Halla lo que se quita, no el precio final.', ['25', '300', '100'], 'La parte se calcula a partir del monto original indicado.', 'El porcentaje y el monto en dinero son cantidades distintas.'],
      ['Quanto é o desconto?', 'Um preço de 400 tem 25% de desconto. Ache o valor retirado, não o preço final.', ['25', '300', '100'], 'A parte é calculada a partir do valor original informado.', 'O percentual e o valor em dinheiro são quantidades diferentes.'],
    ]),
    Q('practice-03', 'practice', 'money.unit-price', 1, [
      ['Which has the lower price per equal bag?', 'Identical bags: A offers two for 18; B offers three for 24.', ['A', 'B', 'They are equal per bag'], 'The unit comparison accounts for the different pack sizes.', 'Find what one equal bag costs in each offer.'],
      ['¿Cuál tiene menor precio por bolsa igual?', 'Bolsas idénticas: A ofrece dos por 18; B ofrece tres por 24.', ['A', 'B', 'Son iguales por bolsa'], 'La comparación unitaria considera los distintos tamaños de paquete.', 'Halla cuánto cuesta una bolsa igual en cada oferta.'],
      ['Qual tem menor preço por saco igual?', 'Sacos idênticos: A oferece dois por 18; B oferece três por 24.', ['A', 'B', 'São iguais por saco'], 'A comparação unitária considera os diferentes tamanhos de pacote.', 'Ache quanto custa um saco igual em cada oferta.'],
    ]),
    Q('practice-04', 'practice', 'money.percent-intro', 0, [
      ['Which amount is the stated share?', 'A 10% reduction is calculated on an original price of 500.', ['50', '10', '450'], 'The original whole determines the value of the percentage.', 'Find the removed share, not the amount left afterward.'],
      ['¿Qué monto corresponde a esa parte?', 'Una reducción de 10% se calcula sobre un precio original de 500.', ['50', '10', '450'], 'El total original determina el valor del porcentaje.', 'Halla la parte retirada, no el monto que queda después.'],
      ['Qual valor corresponde a essa parte?', 'Uma redução de 10% é calculada sobre um preço original de 500.', ['50', '10', '450'], 'O total original define o valor do percentual.', 'Ache a parte retirada, não o valor que resta depois.'],
    ]),
    Q('practice-05', 'practice', 'life.review-and-adjust-plan', 2, [
      ['What comes next?', 'Transport has cost more for weeks, reducing optional spending.', ['Keep the old estimate unchanged', 'Record only the old estimate', 'Update the estimate and future choices'], 'Repeated actual costs support a revised plan.', 'Use observed costs to improve the next decision.'],
      ['¿Cuál es el siguiente paso útil?', 'El transporte habitual cuesta más desde hace semanas y deja menos para gastos opcionales.', ['Mantener la estimación anterior', 'Registrar solo lo previsto antes', 'Actualizar la previsión y las decisiones'], 'Los costos reales repetidos justifican ajustar el plan.', 'Usa los costos observados para mejorar la próxima decisión.'],
      ['Qual é o próximo passo útil?', 'O transporte habitual custa mais há semanas e deixa menos para gastos opcionais.', ['Manter a estimativa anterior', 'Registrar só o previsto antes', 'Atualizar a previsão e as decisões'], 'Os custos reais repetidos justificam ajustar o plano.', 'Use os custos observados para melhorar a próxima decisão.'],
    ]),
    Q('transfer-01', 'transfer', 'money.unit-price', 1, [
      ['What comparison answers this?', 'Packs contain different counts of identical boxes. Compare cost per box.', ['Compare only the package totals', 'Divide total by box count', 'Choose more boxes'], 'The cost of one equal box makes the offers comparable.', 'Use a common unit before choosing between unequal packages.'],
      ['¿Qué comparación responde la pregunta?', 'Dos servicios venden distintas cantidades de cajas idénticas. Buscas el menor costo por caja.', ['Comparar solo los totales del paquete', 'Comparar total entre número de cajas', 'Elegir el paquete con más cajas'], 'El costo de una caja igual permite comparar las ofertas.', 'Usa una unidad común antes de elegir entre paquetes distintos.'],
      ['Qual comparação responde à pergunta?', 'Dois serviços vendem quantidades diferentes de caixas idênticas. Você busca o menor custo por caixa.', ['Comparar só os totais do pacote', 'Comparar total dividido pelas caixas', 'Escolher o pacote com mais caixas'], 'O custo de uma caixa igual permite comparar as ofertas.', 'Use uma unidade comum antes de escolher entre pacotes diferentes.'],
    ]),
  ] })];
