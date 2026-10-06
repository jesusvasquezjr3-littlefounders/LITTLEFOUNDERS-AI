import { define, E, Q, numeric, input, subtract } from './factory.mjs';
const skill = 'finance.cash.reserved';
export const capacity = define(4,
  ['Does it fit?', '¿Sí alcanza?', 'Cabe no plano?'],
  ['Check a purchase against money left after protecting your commitments.', 'Compara una compra con el dinero que queda después de proteger tus compromisos.', 'Compare uma compra com o dinheiro que sobra depois de proteger seus compromissos.'], [
    E('example-01', ['Protect, then compare', 'Protege y compara', 'Proteja e compare'], [
      'You have 70 and protect 45: 70 − 45 = 25 remains. A purchase of 20 fits; one costing 30 does not.',
      'Tienes 70 y proteges 45: 70 − 45 = 25 restantes. Una compra de 20 cabe; una de 30 no.',
      'Você tem 70 e protege 45: 70 − 45 = 25 restantes. Uma compra de 20 cabe; uma de 30 não.',
    ]),
    numeric(Q('guided-01', 'guided', skill, 1, [
      ['How much is free?', 'You have 40 and protect 30. Subtract the protected amount.', ['40', '10', '30'], '40 − 30 = 10 is free for another use.', 'Separate the protected portion from the full amount.'],
      ['¿Cuánto queda libre?', 'Tienes 40 y proteges 30. Resta el monto protegido.', ['40', '10', '30'], '40 − 30 = 10 libres para otro uso.', 'Separa la parte protegida del monto completo.'],
      ['Quanto fica livre?', 'Você tem 40 e protege 30. Subtraia o valor protegido.', ['40', '10', '30'], '40 − 30 = 10 livres para outro uso.', 'Separe a parte protegida do valor inteiro.'],
    ]), [40, 30], subtract(input(0), input(1))),
    Q('guided-02', 'guided', skill, 0, [
      ['Does this purchase fit?', 'You have 40, protect 30 and have 10 free. The purchase costs 10.', ['Yes, exactly', 'No, any spending is forbidden', 'Yes, up to 40'], 'The purchase uses the free amount and leaves the protected money intact.', 'Compare the price with the free amount, not the full balance.'],
      ['¿Esta compra cabe?', 'Tienes 40, proteges 30 y quedan 10 libres. La compra cuesta 10.', ['Sí, exactamente', 'No, está prohibido gastar', 'Sí, hasta 40'], 'La compra usa el monto libre y deja intacto el dinero protegido.', 'Compara el precio con lo libre, no con el saldo completo.'],
      ['Esta compra cabe?', 'Você tem 40, protege 30 e restam 10 livres. A compra custa 10.', ['Sim, exatamente', 'Não, qualquer gasto é proibido', 'Sim, até 40'], 'A compra usa o valor livre e mantém o dinheiro protegido.', 'Compare o preço com o valor livre, não com o saldo inteiro.'],
    ]),
    Q('practice-01', 'practice', skill, 2, [
      ['Can you buy?', 'You have 50, must reserve 35 and consider a purchase of 18.', ['Yes, 18 is below 50', 'Yes, the bill is unpaid', 'No, only 15 is free'], '50 − 35 = 15. The purchase would use some protected money.', 'First remove the amount needed for the bill.'],
      ['¿La compra cabe sin usar lo apartado?', 'Tienes 50, debes apartar 35 y quieres una compra de 18.', ['Sí, 18 es menor que 50', 'Sí, la cuenta sigue pendiente', 'No, solo quedan 15 libres'], '50 − 35 = 15. La compra usaría parte del dinero protegido.', 'Primero separa el monto necesario para la cuenta.'],
      ['A compra cabe sem usar a reserva?', 'Você tem 50, precisa reservar 35 e quer uma compra de 18.', ['Sim, 18 é menor que 50', 'Sim, a conta está pendente', 'Não, só restam 15 livres'], '50 − 35 = 15. A compra usaria parte do dinheiro protegido.', 'Primeiro separe o valor necessário para a conta.'],
    ]),
    numeric(Q('practice-02', 'practice', skill, 0, [
      ['What is the spending limit?', 'You have 80. A required payment needs 50.', ['30', '80', '50'], '80 − 50 = 30 is available beyond this commitment.', 'The commitment stays protected even before payment.'],
      ['¿Cuál es el límite?', 'Tienes 80. Un pago necesario requiere 50.', ['30', '80', '50'], '80 − 50 = 30 disponibles fuera de este compromiso.', 'El compromiso sigue protegido aunque aún no lo pagues.'],
      ['Qual é o limite?', 'Você tem 80. Um pagamento necessário exige 50.', ['30', '80', '50'], '80 − 50 = 30 disponíveis além deste compromisso.', 'O compromisso fica protegido mesmo antes do pagamento.'],
    ]), [80, 50], subtract(input(0), input(1))),
    Q('practice-03', 'practice', skill, 1, [
      ['Which purchase fits?', 'You have 30. All of it is required for an unpaid bill.', ['Any purchase below 30', 'None with this money', 'A purchase after labeling the bill'], 'There is no free portion under the stated commitment.', 'A label does not create more money.'],
      ['¿Qué compra cabe?', 'Tienes 30. Todo ese dinero se necesita para una cuenta pendiente.', ['Cualquiera menor de 30', 'Ninguna con este dinero', 'Comprar tras etiquetar la cuenta'], 'No queda una parte libre bajo el compromiso indicado.', 'Una etiqueta no crea más dinero.'],
      ['Qual compra cabe?', 'Você tem 30. Todo esse dinheiro é necessário para uma conta pendente.', ['Qualquer uma abaixo de 30', 'Nenhuma com este dinheiro', 'Comprar após etiquetar a conta'], 'Não existe uma parte livre diante do compromisso informado.', 'Uma etiqueta não cria mais dinheiro.'],
    ]),
    Q('transfer-01', 'transfer', skill, 2, [
      ['Can you pay?', 'You have 60, protect 42; the advertised 16 costs 22 including the required charge.', ['Yes, use advertised 16', 'Yes, you hold 60', 'No, only 18 free'], '60 − 42 = 18. The complete price of 22 does not fit.', 'Use the displayed complete price and keep the commitment protected.'],
      ['¿Cabe el precio completo?', 'Tienes 60 y proteges 42. Los 16 anunciados son 22 con el cargo obligatorio.', ['Sí, usa los 16 anunciados', 'Sí, tienes 60', 'No, solo hay 18 libres'], '60 − 42 = 18. El precio completo de 22 no cabe.', 'Usa el precio completo indicado y protege el compromiso.'],
      ['O preço completo cabe?', 'Você tem 60 e protege 42. Os 16 anunciados viram 22 com a cobrança obrigatória.', ['Sim, use os 16 anunciados', 'Sim, você tem 60', 'Não, só há 18 livres'], '60 − 42 = 18. O preço completo de 22 não cabe.', 'Use o preço completo informado e proteja o compromisso.'],
    ]),
  ]);
