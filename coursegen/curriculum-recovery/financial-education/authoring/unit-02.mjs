import { makeLesson, examples as E, choice as Q } from './assemble.mjs';
const unit = 'fe-solid-02-a-plan-that-fits';
const k = 'biz.needs-vs-wants';
export const plans = [makeLesson({ number: 6, slug: 'protect-what-matters', unit,
  title: ['Protect what matters now', 'Protege lo necesario hoy', 'Proteja o necessário agora'], skill: 'plan.priority', kc: k, prerequisites: ['cash.reserved', 'cash.dates'],
  outcome: 'Prioritize a payment using its stated consequence and deadline, rather than labeling an object as always necessary or always optional.',
  misconception: 'Treating needs and wants as permanent labels on objects or judging another person spending without context.', numeracy: 'Amounts are not needed; compare explicit consequences and deadlines.',
  relevance: ['When money is limited, ask what happens if a payment waits. The answer depends on the person and the situation.', 'Cuando el dinero es limitado, pregunta qué pasa si un pago espera. La respuesta depende de la persona y la situación.', 'Quando o dinheiro é limitado, pergunte o que acontece se um pagamento esperar. A resposta depende da pessoa e da situação.'],
  segments: [
    E('example-01', ['One object, two uses', 'Un objeto, dos usos', 'Um objeto, dois usos'], ['A phone can be essential for receiving work calls. Replacing a working phone just for a new color can wait.', 'Un teléfono puede ser necesario para recibir llamadas de trabajo. Cambiar uno que funciona solo por otro color puede esperar.', 'Um telefone pode ser necessário para receber chamadas de trabalho. Trocar um que funciona só por outra cor pode esperar.']),
    E('example-02', ['Name the consequence', 'Nombra la consecuencia', 'Diga a consequência'], ['Ask: what stops working if I delay this? Protect a stated essential use before an upgrade with no urgent purpose.', 'Pregunta: ¿qué deja de funcionar si lo aplazo? Protege un uso necesario antes que una mejora sin urgencia.', 'Pergunte: o que deixa de funcionar se eu adiar? Proteja um uso necessário antes de uma melhoria sem urgência.']),
    Q('guided-01', 'guided', k, 0, [
      ['Which payment protects the stated need?', 'Ana needs transport to work tomorrow. A new phone case is optional.', ['Transport tomorrow', 'The new phone case', 'Both are equally urgent'], 'Transport protects the stated work trip; the case can wait.', 'Look at the consequence of delaying each payment.'],
      ['¿Qué pago protege la necesidad indicada?', 'Ana necesita transporte para trabajar mañana. Una funda nueva es opcional.', ['El transporte de mañana', 'La funda nueva', 'Ambos son igual de urgentes'], 'El transporte protege el viaje al trabajo; la funda puede esperar.', 'Mira la consecuencia de aplazar cada pago.'],
      ['Qual pagamento protege a necessidade?', 'Ana precisa de transporte para trabalhar amanhã. Uma capa nova é opcional.', ['O transporte de amanhã', 'A capa nova', 'Ambos são igualmente urgentes'], 'O transporte protege a ida ao trabalho; a capa pode esperar.', 'Veja a consequência de adiar cada pagamento.'],
    ]),
    Q('guided-02', 'guided', k, 2, [
      ['What decides the priority?', 'One phone receives work calls. Someone wants another solely for its color.', ['The word phone', 'Who earns more', 'The use and consequence of delay'], 'The same object can serve different needs.', 'Compare the purpose, not just the object name.'],
      ['¿Qué determina la prioridad?', 'Un teléfono recibe llamadas de trabajo. Otra persona quiere un segundo teléfono por su color.', ['La palabra teléfono', 'Quién gana más', 'El uso y la consecuencia de aplazar'], 'El mismo objeto puede servir a necesidades distintas.', 'Compara el propósito, no solo el nombre del objeto.'],
      ['O que define a prioridade?', 'Um telefone recebe chamadas de trabalho. Outra pessoa quer um segundo telefone por sua cor.', ['A palavra telefone', 'Quem ganha mais', 'O uso e a consequência de adiar'], 'O mesmo objeto pode servir a necessidades diferentes.', 'Compare o propósito, não só o nome do objeto.'],
    ]),
    Q('practice-01', 'practice', k, 1, [
      ['Which purchase can wait?', 'Food is needed today. The old headphones still work; a new pair is only a style upgrade.', ['Food today', 'The headphone upgrade', 'Neither can wait'], 'The upgrade has no urgent function in the stated situation.', 'Use the facts given, not a rule about all headphones.'],
      ['¿Qué puede esperar en esta situación?', 'Hace falta comida hoy. Los audífonos funcionan; unos nuevos solo cambiarían el estilo.', ['La comida de hoy', 'Cambiar los audífonos', 'Nada puede esperar'], 'El cambio no cumple una función urgente en esta situación.', 'Usa los datos dados, no una regla sobre todos los audífonos.'],
      ['O que pode esperar nesta situação?', 'Falta comida hoje. Os fones funcionam; um par novo só mudaria o estilo.', ['A comida de hoje', 'A troca dos fones', 'Nada pode esperar'], 'A troca não tem uma função urgente nesta situação.', 'Use os fatos dados, não uma regra sobre todos os fones.'],
    ]),
    Q('practice-02', 'practice', k, 0, [
      ['What must you ask first?', 'Someone calls their internet unnecessary; you do not know its use.', ['What would stop working?', 'Why not cancel now?', 'Why must everyone have it?'], 'The consequence is missing; the label alone cannot set the priority.', 'Ask how the person uses the service.'],
      ['¿Qué debes preguntar primero?', 'Alguien dice que su internet es innecesario. No sabes para qué lo usa.', ['¿Qué se detendría si lo cortan?', '¿Por qué no cancelarlo ya?', '¿Por qué todos lo necesitan?'], 'Falta la consecuencia; la etiqueta no determina la prioridad.', 'Una prioridad necesita información sobre la situación.'],
      ['O que perguntar primeiro?', 'Alguém diz que sua internet é desnecessária. Você não sabe como a usa.', ['O que pararia se fosse cortada?', 'Por que não cancelar agora?', 'Por que todos precisam dela?'], 'Falta a consequência; o rótulo não define a prioridade.', 'Uma prioridade precisa de informações sobre a situação.'],
    ]),
    Q('practice-03', 'practice', k, 2, [
      ['Why protect this repair?', 'A leak damages the room. Painting an undamaged wall is decorative.', ['The repair is cheaper', 'Painting takes less time', 'Delay worsens damage'], 'The stated damage explains the priority without judging decoration.', 'Ask which delay creates a concrete problem.'],
      ['¿Por qué proteger esta reparación?', 'Una fuga daña el cuarto. Pintar una pared intacta solo sería decorativo.', ['La reparación tiene un precio menor', 'Pintar toma menos tiempo', 'Aplazar la fuga empeora el daño'], 'El daño indicado explica la prioridad sin juzgar la decoración.', 'Pregunta qué aplazamiento crea un problema concreto.'],
      ['Por que proteger este conserto?', 'Um vazamento danifica o quarto. Pintar uma parede intacta seria só decorativo.', ['O conserto tem um preço menor', 'Pintar leva menos tempo', 'Adiar o vazamento piora o dano'], 'O dano informado explica a prioridade sem julgar a decoração.', 'Pergunte qual adiamento cria um problema concreto.'],
    ]),
    Q('transfer-01', 'transfer', k, 1, [
      ['Which purchase protects the stated activity?', 'A cook needs safe shoes tomorrow; theirs are broken. A poster is optional.', ['The poster', 'The safe replacement shoes', 'Whichever has the larger discount'], 'Replacing broken work equipment protects the stated activity.', 'Use the consequence and deadline, even for a new kind of object.'],
      ['¿Qué compra protege la actividad indicada?', 'Un cocinero necesita calzado seguro para mañana; el actual está roto. Un póster es opcional.', ['El póster', 'Reemplazar el calzado roto', 'Lo que tenga el mayor descuento'], 'Reemplazar el equipo roto protege la actividad indicada.', 'Usa la consecuencia y el plazo, aunque sea otro objeto.'],
      ['Qual compra protege a atividade indicada?', 'Um cozinheiro precisa de calçado seguro amanhã; o atual está quebrado. Um pôster é opcional.', ['O pôster', 'Substituir o calçado quebrado', 'O que tiver o maior desconto'], 'Substituir o equipamento quebrado protege a atividade indicada.', 'Use a consequência e o prazo, mesmo com outro objeto.'],
    ]),
  ],
}), makeLesson({ number: 7, slug: 'a-week-of-real-payments', unit, kind: 'consolidate', title: ['A week of real payments', 'Una semana de pagos reales', 'Uma semana de pagamentos'],
  skill: 'cash.received', kc: 'life.track-earnings', prerequisites: ['cash.direction'], retrieve: ['cash.direction', 'cash.received', 'cash.balance', 'cash.reserved', 'cash.dates'],
  outcome: 'Use payment status, direction, running balance, reserved money and deadlines together in a new week of decisions.', misconception: 'Keeping separate definitions without using them together when deciding what can be spent.', numeracy: 'Use previously taught addition, subtraction and date order with small whole amounts.',
  relevance: ['Use the tools together in a new week. Read each situation on its own; the facts change between decisions.', 'Usa las herramientas juntas en otra semana. Lee cada situación por separado; los datos cambian entre decisiones.', 'Use as ferramentas juntas em outra semana. Leia cada situação separadamente; os fatos mudam entre decisões.'],
  evidenceSkills: { 'practice-01': 'cash.direction', 'practice-02': 'cash.balance', 'practice-03': 'cash.reserved', 'practice-04': 'cash.dates' },
  segments: [
    Q('practice-01', 'practice', 'life.track-earnings', 2, [
      ['What happens to Luis money?', 'A store returns money to Luis after he returns a defective lamp.', ['Money leaves Luis', 'Nothing changes', 'Money enters Luis balance'], 'The refund goes to Luis, so his money increases.', 'Follow the money, not the lamp.'],
      ['¿Qué pasa con el dinero de Luis?', 'Una tienda devuelve dinero a Luis cuando él regresa una lámpara defectuosa.', ['Sale dinero de Luis', 'Nada cambia', 'Entra dinero al saldo de Luis'], 'La devolución llega a Luis, así que su dinero aumenta.', 'Sigue el dinero, no la lámpara.'],
      ['O que acontece com o dinheiro de Luis?', 'Uma loja devolve dinheiro a Luis quando ele devolve uma luminária com defeito.', ['Sai dinheiro de Luis', 'Nada muda', 'Entra dinheiro no saldo de Luis'], 'O reembolso chega a Luis, então seu dinheiro aumenta.', 'Acompanhe o dinheiro, não a luminária.'],
    ]),
    Q('practice-02', 'practice', 'life.track-earnings', 1, [
      ['What remains?', 'You have 70, receive 20, then pay 30.', ['90', '60', '70'], 'You included the starting amount and both completed changes.', 'Add what arrived and subtract what was paid.'],
      ['¿Cuánto queda?', 'Tienes 70, recibes 20 y después pagas 30.', ['90', '60', '70'], 'Incluiste el monto inicial y ambos cambios realizados.', 'Suma lo recibido y resta lo pagado.'],
      ['Quanto resta?', 'Você tem 70, recebe 20 e depois paga 30.', ['90', '60', '70'], 'Você incluiu o valor inicial e as duas mudanças realizadas.', 'Some o que chegou e subtraia o que foi pago.'],
    ]),
    Q('practice-03', 'practice', 'money.simple-budget', 0, [
      ['Which purchase protects the bill?', 'You have 90; 60 covers the only bill before new income.', ['Spend 30', 'Spend 60', 'Spend 90'], 'The purchase fits after the stated bill amount is protected.', 'Reserved money remains visible, but already has a planned use.'],
      ['¿Qué compra conserva lo del recibo?', 'Tienes 90; apartaste 60 para un recibo. No hay otros pagos antes de la próxima entrada.', ['Una compra de 30', 'Una compra de 60', 'Una compra de 90'], 'La compra cabe después de proteger el monto del recibo.', 'El monto apartado sigue en el saldo, pero ya tiene un propósito.'],
      ['Qual compra preserva o dinheiro da conta?', 'Você tem 90; reservou 60 para uma conta. Não há outros pagamentos antes da próxima entrada.', ['Uma compra de 30', 'Uma compra de 60', 'Uma compra de 90'], 'A compra cabe depois de proteger o valor da conta.', 'O valor reservado ainda está no saldo, mas já tem um propósito.'],
    ]),
    Q('practice-04', 'practice', 'money.simple-budget', 2, [
      ['What blocks this plan?', 'A bill is due Wednesday; your only income arrives Thursday.', ['Income exceeds monthly spending', 'The bill is recorded', 'Money arrives too late'], 'The arrival is after the stated deadline.', 'Check the order before comparing the monthly total.'],
      ['¿Qué impide este plan?', 'Un recibo vence el miércoles. El único ingreso disponible llega el jueves.', ['El ingreso no tiene propósito', 'El recibo no se puede registrar', 'El dinero llega demasiado tarde'], 'La entrada ocurre después del vencimiento indicado.', 'Revisa el orden antes de comparar el total mensual.'],
      ['O que impede este plano?', 'Uma conta vence na quarta. A única renda disponível chega na quinta.', ['A renda não tem propósito', 'A conta não pode ser registrada', 'O dinheiro chega tarde demais'], 'A entrada ocorre depois do vencimento informado.', 'Confira a ordem antes de comparar o total mensal.'],
    ]),
    Q('practice-05', 'practice', 'life.track-earnings', 1, [
      ['Which receipt is usable today?', 'One transfer is marked completed and usable. Another is only scheduled.', ['The scheduled one', 'The completed one', 'Both automatically'], 'A scheduled instruction is not a completed receipt.', 'Check whether the money is actually available.'],
      ['¿Qué entrada puedes usar hoy?', 'Una transferencia figura completada y disponible. Otra solo está programada.', ['La programada', 'La completada', 'Ambas automáticamente'], 'Una instrucción programada no es una entrada realizada.', 'Comprueba si el dinero realmente está disponible.'],
      ['Qual entrada pode usar hoje?', 'Uma transferência consta como concluída e disponível. Outra só está agendada.', ['A agendada', 'A concluída', 'As duas automaticamente'], 'Uma instrução agendada não é uma entrada concluída.', 'Confira se o dinheiro está realmente disponível.'],
    ]),
    Q('transfer-01', 'transfer', 'life.track-earnings', 0, [
      ['What funds a purchase today?', 'You have no usable money; a buyer promises payment after delivery.', ['No received payment yet', 'The buyer promise', 'The agreed selling price'], 'An agreed sale does not mean its payment has arrived.', 'Separate agreement, delivery and completed payment.'],
      ['¿Qué respalda una compra hoy?', 'No tienes dinero disponible. Un comprador promete pagar tras la entrega, pero aún no paga.', ['Todavía no hay pago recibido', 'La promesa del comprador', 'El precio de venta acordado'], 'Una venta acordada no significa que el pago haya llegado.', 'Separa acuerdo, entrega y pago realizado.'],
      ['O que sustenta uma compra hoje?', 'Você não tem dinheiro disponível. Um comprador promete pagar após a entrega, mas ainda não pagou.', ['Ainda não há pagamento recebido', 'A promessa do comprador', 'O preço de venda combinado'], 'Uma venda combinada não significa que o pagamento chegou.', 'Separe acordo, entrega e pagamento realizado.'],
    ]),
  ],
})];
