import { define, E, Q } from './factory.mjs';
const skill = 'finance.cash.transfer';
export const transfers = define(7,
  ['Moving money', 'Mismo dinero, otro lugar', 'Mesmo dinheiro, outro lugar'],
  ['Moving your money between your own containers does not create more money.', 'Mover dinero entre tus propios fondos no crea más dinero.', 'Mover dinheiro entre seus próprios recursos não cria mais dinheiro.'], [
    E('example-01', ['Follow both sides', 'Sigue ambos lados', 'Acompanhe os dois lados'], [
      'Your wallet starts at 80. Moving 30 to your own empty box leaves 50 + 30 = 80 total.',
      'Tu cartera empieza con 80. Mover 30 a tu propia caja vacía deja 50 + 30 = 80 en total.',
      'Sua carteira começa com 80. Mover 30 para sua própria caixa vazia deixa 50 + 30 = 80 no total.',
    ]),
    Q('guided-01', 'guided', skill, 0, [
      ['What changed?', 'Money moved from your wallet into your own box. Nothing else happened.', ['Its location', 'Your earnings', 'The total you own'], 'The same money is now in a different place.', 'Both containers already belong to you.'],
      ['¿Qué cambió?', 'Moviste dinero de tu cartera a tu propia caja. No ocurrió nada más.', ['Su ubicación', 'Tu ingreso ganado', 'El total que tienes'], 'El mismo dinero ahora está en otro lugar.', 'Ambos lugares ya contienen tu dinero.'],
      ['O que mudou?', 'Você moveu dinheiro da carteira para sua própria caixa. Nada mais aconteceu.', ['O lugar', 'Sua renda ganha', 'O total que você tem'], 'O mesmo dinheiro agora está em outro lugar.', 'Os dois lugares já guardam seu dinheiro.'],
    ]),
    Q('guided-02', 'guided', skill, 1, [
      ['New income?', 'Your box received money from your wallet. The wallet lost that same amount.', ['Yes, the box received it', 'No, it was already yours', 'Yes, count both entries as earnings'], 'The incoming and outgoing entries describe one transfer of your money.', 'Look at both sides of the same movement.'],
      ['¿La entrada es ingreso nuevo?', 'Tu caja recibió dinero de tu cartera. De la cartera salió ese mismo monto.', ['Sí, la caja lo recibió', 'No, ya era tuyo', 'Sí, ambas anotaciones son ingresos'], 'La entrada y la salida describen una transferencia de tu propio dinero.', 'Observa ambos lados del mismo movimiento.'],
      ['A entrada é renda nova?', 'Sua caixa recebeu dinheiro da carteira. Da carteira saiu esse mesmo valor.', ['Sim, a caixa recebeu', 'Não, já era seu', 'Sim, as duas anotações são renda'], 'A entrada e a saída descrevem uma transferência do seu dinheiro.', 'Observe os dois lados do mesmo movimento.'],
    ]),
    Q('practice-01', 'practice', skill, 2, [
      ['Which event adds money?', 'A customer pays you. Separately, you move existing cash into your own box.', ['Only moving cash', 'Both events', 'Only the customer payment'], 'The customer adds money from outside your existing containers.', 'Moving money you already own changes its location, not the total.'],
      ['¿Qué evento agrega dinero?', 'Un cliente te paga. Aparte, mueves efectivo que ya tenías a tu propia caja.', ['Solo mover efectivo', 'Ambos eventos', 'Solo el pago del cliente'], 'El cliente agrega dinero desde fuera de tus fondos existentes.', 'Mover tu dinero cambia su ubicación, no el monto combinado.'],
      ['Qual evento acrescenta dinheiro?', 'Um cliente paga você. Separadamente, você move dinheiro já existente para sua própria caixa.', ['Só mover dinheiro', 'Os dois eventos', 'Só o pagamento do cliente'], 'O cliente acrescenta dinheiro de fora dos seus recursos existentes.', 'Mover seu dinheiro muda o lugar, não o valor combinado.'],
    ]),
    Q('practice-02', 'practice', skill, 0, [
      ['What is missing?', 'Money enters your box from your wallet; the record omits that outgoing entry.', ['The matching outgoing side', 'Another source of earnings', 'A second transfer into the box'], 'Ignoring the outgoing side makes the same money look new.', 'Connect the receiving entry with where that money came from.'],
      ['¿Qué falta en este registro?', 'La nota cuenta tu transferencia a la caja, pero ignora la salida de tu cartera.', ['La salida correspondiente', 'Otra fuente de ingresos', 'Otra transferencia a la caja'], 'Ignorar la salida hace que el mismo dinero parezca nuevo.', 'Relaciona la entrada con el lugar del que salió ese dinero.'],
      ['O que falta neste registro?', 'A anotação conta sua transferência para a caixa, mas ignora a saída da carteira.', ['A saída correspondente', 'Outra fonte de renda', 'Outra transferência para a caixa'], 'Ignorar a saída faz o mesmo dinheiro parecer novo.', 'Relacione a entrada com o lugar de onde saiu esse dinheiro.'],
    ]),
    Q('practice-03', 'practice', skill, 1, [
      ['Did this create income?', 'You moved your existing cash into a savings envelope; nobody paid you.', ['Yes, the envelope grew', 'No, the location changed', 'Yes, saving is always new income'], 'Setting money aside changes its purpose or location, not its source.', 'Check whether new money actually entered your total.'],
      ['¿Ahorrar aquí creó ingreso?', 'Moviste dinero existente a tu sobre de ahorro. Nadie te dio dinero nuevo.', ['Sí, aumentó el sobre', 'No, cambió de lugar', 'Sí, ahorrar siempre es ingreso nuevo'], 'Apartar dinero cambia su destino o ubicación, no su origen.', 'Revisa si realmente entró dinero nuevo al total.'],
      ['Guardar aqui criou renda?', 'Você moveu dinheiro existente para seu envelope de poupança. Ninguém pagou nada novo.', ['Sim, o envelope cresceu', 'Não, mudou de lugar', 'Sim, poupar sempre é renda nova'], 'Separar dinheiro muda seu destino ou lugar, não sua origem.', 'Confira se dinheiro novo realmente entrou no total.'],
    ]),
    Q('transfer-01', 'transfer', skill, 2, [
      ['New income?', 'You withdrew cash from your own account with no fee. The account fell by the same amount.', ['Yes, you received cash', 'Yes, both balances increased', 'No, your money moved'], 'The cash came from money already held in your own account.', 'Include the account decrease as well as the cash received.'],
      ['¿El retiro creó ingreso?', 'Retiraste efectivo de tu propia cuenta sin comisión. La cuenta bajó por el mismo monto.', ['Sí, recibiste efectivo', 'Sí, ambos saldos aumentaron', 'No, moviste tu dinero'], 'El efectivo salió de dinero que ya tenías en tu propia cuenta.', 'Incluye tanto la reducción en la cuenta como el efectivo recibido.'],
      ['O saque criou renda?', 'Você sacou dinheiro da sua própria conta sem tarifa. A conta caiu pelo mesmo valor.', ['Sim, recebeu dinheiro', 'Sim, os dois saldos aumentaram', 'Não, seu dinheiro mudou de lugar'], 'O dinheiro saiu de recursos que já estavam na sua própria conta.', 'Inclua tanto a redução na conta quanto o dinheiro recebido.'],
    ]),
  ]);
