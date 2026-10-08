import { readFileSync } from 'node:fs';
import path from 'node:path';
import { root, makeLesson, examples as E, choice as Q, ledger } from './assemble.mjs';
const unit = 'fe-solid-01-money-today';
const k = 'life.track-earnings';
function adopt(file, number, slug, skill, prerequisites, outcome, misconception) {
  const old = JSON.parse(readFileSync(path.join(root, 'plans', file), 'utf8'));
  return makeLesson({ number, slug, unit, title: Object.values(old.title), skill, kc: old.knowledge_component_ids[0], prerequisites, outcome, misconception,
    relevance: Object.values(old.segments[0].copy).map(copy => copy.line),
    numeracy: number === 4 ? 'A previous interactive ledger teaches adding receipts and subtracting payments; the worked example subtracts the reserved amount explicitly.' : 'No arithmetic is assumed. Follow one named person and the payment status.',
    segments: old.segments.slice(1) });
}
export const plans = [
  adopt('fe-recovery-adult-01-money-moves.json', 1, 'money-moves', 'cash.direction', [], 'Identify whether a completed transaction increases, decreases or does not change the money held by the named person.', 'Following the object sold instead of the direction of the money.'),
  adopt('fe-recovery-adult-02-received-not-promised.json', 2, 'received-not-promised', 'cash.received', ['cash.direction'], 'Distinguish money received and usable today from an unpaid promise before making a spending decision.', 'Treating an expected payment as money already available.'),
  makeLesson({ number: 3, slug: 'update-your-balance', unit, title: ['Follow your balance', 'Sigue tu saldo', 'Acompanhe seu saldo'], skill: 'cash.balance', kc: k, prerequisites: ['cash.direction', 'cash.received'],
    outcome: 'Update a starting balance after completed receipts and payments, and distinguish the balance from the size of one transaction.',
    misconception: 'Ignoring the starting amount or adding a payment instead of subtracting it.', numeracy: 'The visible meter and replay show each addition and subtraction before independent calculation.',
    relevance: ['Track receipts and payments in dollars to see what remains. Your balance changes after each completed payment.', 'Registra entradas y pagos en pesos para ver lo que queda. El saldo cambia con cada pago realizado.', 'Registre entradas e pagamentos em reais para ver o que resta. O saldo muda com cada pagamento realizado.'],
    segments: [
      E('example-01', ['Start, then change', 'Inicio y cambio', 'Início e mudança'], ['Start with 20 and receive 10: 20 + 10 = 30. Then pay 5: 30 − 5 = 25 remains.', 'Empieza con 20 y recibe 10: 20 + 10 = 30. Luego paga 5: 30 − 5 = 25 restantes.', 'Comece com 20 e receba 10: 20 + 10 = 30. Depois pague 5: 30 − 5 = 25 restantes.']),
      ledger('example-02', 'example', k, 20, 10, 5, ['sale', 'cost'], [['Receive 10, then pay 5. Watch the balance. Replay the moves to see why 25 remains.'], ['Recibe 10 y paga 5. Observa el saldo. Repite los movimientos para ver por qué quedan 25.'], ['Receba 10 e pague 5. Observe o saldo. Reveja os movimentos para ver por que restam 25.']]),
      ledger('guided-01', 'guided', k, 30, 10, 5, ['cost'], [
        ['From a balance of 30, log a payment of 5. Subtract it from the start and enter the balance.', 'You subtracted the payment from the starting balance.', 'A payment reduces what you had. Use the starting amount.'],
        ['Con un saldo de 30, registra un pago de 5. Réstalo al monto inicial y escribe el saldo.', 'Restaste el pago al saldo inicial.', 'Un pago reduce lo que tenías. Usa el monto inicial.'],
        ['Com um saldo de 30, registre um pagamento de 5. Subtraia do início e digite o saldo.', 'Você subtraiu o pagamento do saldo inicial.', 'Um pagamento reduz o que você tinha. Use o valor inicial.'],
      ]),
      Q('guided-02', 'guided', k, 1, [
        ['What was missed?', 'You had 40 and paid 10. A note says the balance is 10.', ['The payment', 'The starting amount', 'A future payment'], 'The note copied the payment instead of subtracting it from the start.', 'The balance is what remains, not the size of the payment.'],
        ['¿Qué faltó considerar?', 'Tenías 40 y pagaste 10. Una nota dice que el saldo es 10.', ['El pago', 'El monto inicial', 'Un pago futuro'], 'La nota copió el pago en vez de restarlo al monto inicial.', 'El saldo es lo que queda, no el tamaño del pago.'],
        ['O que ficou de fora?', 'Você tinha 40 e pagou 10. Uma nota diz que o saldo é 10.', ['O pagamento', 'O valor inicial', 'Um pagamento futuro'], 'A nota copiou o pagamento em vez de subtraí-lo do início.', 'O saldo é o que resta, não o tamanho do pagamento.'],
      ]),
      ledger('practice-01', 'practice', k, 15, 20, 5, ['sale'], [
        ['You have 15 and receive 20 for a repair. Log the receipt and enter the balance.', 'You included both the starting money and the completed receipt.', 'Receiving money increases the amount already there.'],
        ['Tienes 15 y recibes 20 por una reparación. Registra la entrada y escribe el saldo.', 'Incluiste el dinero inicial y el pago recibido.', 'Recibir dinero aumenta el monto que ya había.'],
        ['Você tem 15 e recebe 20 por um conserto. Registre a entrada e digite o saldo.', 'Você incluiu o dinheiro inicial e o pagamento recebido.', 'Receber dinheiro aumenta o valor que já estava lá.'],
      ]),
      ledger('practice-02', 'practice', k, 50, 20, 15, ['cost', 'cost'], [
        ['You have 50 and pay 15 twice. Log both payments and enter the balance.', 'You counted both payments, including the repeated one.', 'Each completed payment changes the balance, even when the amounts match.'],
        ['Tienes 50 y pagas 15 dos veces. Registra ambos pagos y escribe el saldo.', 'Contaste ambos pagos, incluido el repetido.', 'Cada pago cambia el saldo, aunque los montos sean iguales.'],
        ['Você tem 50 e paga 15 duas vezes. Registre os dois pagamentos e digite o saldo.', 'Você contou os dois pagamentos, inclusive o repetido.', 'Cada pagamento muda o saldo, mesmo com valores iguais.'],
      ]),
      Q('practice-03', 'practice', k, 2, [
        ['Which note is complete?', 'You had 60. You received 20 and paid 10.', ['Record only the receipt', 'Record only the payment', 'Record both changes'], 'Both changes affect the money remaining.', 'The balance must include everything that actually entered or left.'],
        ['¿Qué registro está completo?', 'Tenías 60. Recibiste 20 y pagaste 10.', ['Anotar solo la entrada', 'Anotar solo el pago', 'Anotar ambos cambios'], 'Ambos cambios afectan el dinero que queda.', 'El saldo debe incluir todo lo que realmente entró o salió.'],
        ['Qual registro está completo?', 'Você tinha 60. Recebeu 20 e pagou 10.', ['Anotar só a entrada', 'Anotar só o pagamento', 'Anotar as duas mudanças'], 'As duas mudanças afetam o dinheiro restante.', 'O saldo deve incluir tudo o que realmente entrou ou saiu.'],
      ]),
      ledger('transfer-01', 'transfer', k, 40, 10, 20, ['cost', 'sale'], [
        ['Starting with 40, pay 20 for transport, then receive a refund of 10. Log both and enter the balance.', 'You combined the payment and the refund with the starting balance.', 'Track the completed movements in their stated order.'],
        ['Partiendo de 40, pagas 20 de transporte y recibes una devolución de 10. Registra ambos y escribe el saldo.', 'Combinaste el pago y la devolución con el saldo inicial.', 'Sigue los movimientos realizados en el orden indicado.'],
        ['Partindo de 40, pague 20 de transporte e receba um reembolso de 10. Registre ambos e digite o saldo.', 'Você combinou o pagamento e o reembolso com o saldo inicial.', 'Acompanhe os movimentos realizados na ordem indicada.'],
      ]),
    ] }),
  adopt('fe-recovery-adult-03-protect-committed-money.json', 4, 'protect-committed-money', 'cash.reserved', ['cash.received', 'cash.balance'], 'Calculate the money free to spend after protecting a stated necessary payment, then check whether a purchase fits.', 'Confusing the full balance with the amount available for a new purchase.'),
  makeLesson({ number: 5, slug: 'money-has-dates', unit, title: ['Money has dates', 'El dinero tiene fechas', 'O dinheiro tem datas'], skill: 'cash.dates', kc: 'money.simple-budget', prerequisites: ['cash.received', 'cash.reserved'],
    outcome: 'Check whether money is available by the payment deadline instead of relying only on a monthly total.', misconception: 'Assuming a later receipt can pay an earlier bill.', numeracy: 'Use ordered weekdays and compare visible amounts; no interest, percentages or calendar arithmetic.',
    relevance: ['A monthly total can look fine while a payment is due before the money arrives. Check the order of events.', 'El total del mes puede alcanzar, pero un pago vencer antes de que llegue el dinero. Revisa el orden.', 'O total do mês pode bastar, mas uma conta vencer antes de o dinheiro chegar. Confira a ordem.'],
    segments: [
      E('example-01', ['A gap before payday', 'Un hueco entre fechas', 'Um intervalo entre datas'], ['Ana has 20 on Monday; a bill of 40 is due Tuesday. Another 50 arrives Friday, after the deadline.', 'Ana tiene 20 el lunes; un recibo de 40 vence el martes. Otros 50 llegan el viernes, después del vencimiento.', 'Ana tem 20 na segunda; uma conta de 40 vence na terça. Outros 50 chegam na sexta, após o vencimento.']),
      E('example-02', ['Check the deadline first', 'Primero, el vencimiento', 'Primeiro, o vencimento'], ['Ana has only 20 for the Tuesday bill of 40. She must address this shortfall before Tuesday.', 'Antes del martes, Ana solo tiene 20 para el recibo de 40. Debe atender el faltante antes del vencimiento.', 'Antes da terça, Ana só tem 20 para a conta de 40. Precisa tratar a falta antes do vencimento.']),
      Q('guided-01', 'guided', 'money.simple-budget', 1, [
        ['Does the money arrive in time?', 'The bill is due Tuesday. The money arrives Friday.', ['Yes, the same week', 'No, after the deadline', 'Yes, if it is larger'], 'The deadline comes before the money arrives.', 'Put the due date and the arrival date in order.'],
        ['¿El pago posterior llega a tiempo?', 'El recibo vence el martes. El dinero llega el viernes.', ['Sí, es la misma semana', 'No, llega después de vencer', 'Sí, si el monto es mayor'], 'El vencimiento llega antes que el dinero.', 'Ordena la fecha de vencimiento y la de llegada.'],
        ['O pagamento posterior chega a tempo?', 'A conta vence na terça. O dinheiro chega na sexta.', ['Sim, é a mesma semana', 'Não, chega após o vencimento', 'Sim, se o valor for maior'], 'O vencimento chega antes do dinheiro.', 'Coloque o vencimento e a chegada em ordem.'],
      ]),
      Q('guided-02', 'guided', 'money.simple-budget', 0, [
        ['What information is missing?', 'A note says: money arrives this week; the bill is due this week.', ['The exact days', 'The total received last week', 'The total spent last month'], 'The order cannot be checked without the days.', 'The same week can still contain a late payment.'],
        ['¿Qué información falta?', 'Una nota dice: el dinero llega esta semana; el recibo vence esta semana.', ['Los días exactos', 'Lo recibido la semana anterior', 'Lo gastado el mes anterior'], 'Sin los días no se puede comprobar el orden.', 'Dentro de la misma semana, un pago puede llegar tarde.'],
        ['Qual informação falta?', 'Uma nota diz: o dinheiro chega nesta semana; a conta vence nesta semana.', ['Os dias exatos', 'O recebido na semana anterior', 'O gasto no mês anterior'], 'Sem os dias, não dá para conferir a ordem.', 'Na mesma semana, um pagamento ainda pode chegar tarde.'],
      ]),
      Q('practice-01', 'practice', 'money.simple-budget', 2, [
        ['Which money is available by Wednesday?', 'Today is Monday; you have 30. Another 50 arrives Friday.', ['Only the Friday payment', 'Both amounts', 'Only the 30 already held'], 'The later receipt is not available by Wednesday.', 'Count money that is available before the deadline.'],
        ['¿Qué dinero tienes para el miércoles?', 'Hoy es lunes; tienes 30. Otros 50 llegan el viernes.', ['Solo el pago del viernes', 'Ambos montos', 'Solo los 30 que ya tienes'], 'La entrada posterior no está disponible para el miércoles.', 'Cuenta el dinero disponible antes del vencimiento.'],
        ['Qual dinheiro está disponível até quarta?', 'Hoje é segunda; você tem 30. Outros 50 chegam na sexta.', ['Só o pagamento de sexta', 'Os dois valores', 'Só os 30 que já tem'], 'A entrada posterior não está disponível até quarta.', 'Conte o dinheiro disponível antes do vencimento.'],
      ]),
      Q('practice-02', 'practice', 'money.simple-budget', 0, [
        ['What needs checking first?', 'A bill is due Friday; money arrives the following Monday. Today, you lack enough.', ['An agreed new deadline', 'The monthly total alone', 'An assumed automatic extension'], 'Changing the deadline requires an agreement, not just an expectation.', 'A due date does not move just because money will arrive later.'],
        ['¿Qué compruebas antes del viernes?', 'El recibo vence este viernes; el dinero llegará el lunes siguiente. Hoy no alcanza.', ['Si acuerdan otra fecha de pago', 'Si las fechas caen en el mismo mes', 'Si el ingreso mensual supera los gastos'], 'Solo un cambio acordado modifica el vencimiento; esperarlo no basta.', 'El vencimiento no se mueve porque el dinero llegue después.'],
        ['O que verificar antes de sexta?', 'A conta vence nesta sexta; o dinheiro chegará na segunda seguinte. Hoje não basta.', ['Se foi acordado outro vencimento', 'Se as datas estão no mesmo mês', 'Se a renda mensal supera os gastos'], 'Só uma mudança acordada altera o vencimento; esperar não basta.', 'O vencimento não muda porque o dinheiro chega depois.'],
      ]),
      Q('practice-03', 'practice', 'money.simple-budget', 1, [
        ['Which plan respects the dates?', 'You have 80; transport costs 50 tomorrow. More money arrives next week.', ['Spend all 80 today', 'Keep 50 for tomorrow', 'Count future money as received'], 'The money for tomorrow is protected before the later receipt.', 'Tomorrow arrives before next week.'],
        ['¿Qué plan respeta las fechas?', 'Tienes 80; el transporte cuesta 50 mañana. Otro pago llega la próxima semana.', ['Gastar los 80 hoy', 'Guardar 50 para mañana', 'Contar el pago futuro como recibido'], 'El dinero de mañana queda protegido antes de la próxima entrada.', 'Mañana llega antes que la próxima semana.'],
        ['Qual plano respeita as datas?', 'Você tem 80; o transporte custa 50 amanhã. Outro pagamento chega na próxima semana.', ['Gastar os 80 hoje', 'Guardar 50 para amanhã', 'Contar o pagamento futuro como recebido'], 'O dinheiro de amanhã fica protegido antes da próxima entrada.', 'Amanhã chega antes da próxima semana.'],
      ]),
      Q('transfer-01', 'transfer', 'money.simple-budget', 2, [
        ['Does the monthly total suffice?', 'Rent is due early this month; most income arrives late.', ['Yes, if income exceeds spending', 'Yes, both happen monthly', 'No, check money at the deadline'], 'A sufficient monthly total can hide a shortfall at the deadline.', 'Compare money available at the deadline, not only the final total.'],
        ['¿El total mensual demuestra que alcanza?', 'La renta de un cuarto vence al inicio del mes. La mayor entrada llega al final.', ['Sí, si el ingreso total es mayor', 'Sí, porque ambos son mensuales', 'No, revisa el dinero al vencer'], 'Un total mensual suficiente puede ocultar un faltante al vencer.', 'Compara el dinero al vencimiento, no solo el total final.'],
        ['O total mensal basta?', 'O aluguel de um quarto vence no início do mês. A maior entrada chega no fim.', ['Sim, se a renda total for maior', 'Sim, porque ambos são mensais', 'Não, confira o dinheiro ao vencer'], 'Um total mensal suficiente pode esconder uma falta no vencimento.', 'Compare o dinheiro no vencimento, não só o total final.'],
      ]),
    ] }),
];
