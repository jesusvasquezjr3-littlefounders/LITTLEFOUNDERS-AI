import { capstone, Q, numeric, input, subtract, add } from './factory.mjs';
export const accountReconciliation = resolve => capstone(6, resolve,
 ['Before funding a goal', 'Antes de financiar una meta', 'Antes de financiar uma meta'],
 ['Reconcile records before treating every displayed balance as spendable.', 'Concilia registros antes de considerar gastable todo saldo mostrado.', 'Concilie registros antes de considerar disponível todo saldo mostrado.'],
 'Counting an own-account transfer as income or ignoring a known pending payment.',
 s => ({ evidence: [0,1,2,0,1,0], segments: [
 Q('practice-01','practice',s[0],2,[
 ['Which transaction is unmatched?','Receipts: groceries 30, transport 10. Statement: groceries 30, transport 10, fee 5.',['Groceries 30','Transport 10','Fee 5'],'The fee appears on the statement without a matching receipt entry.','Match each statement entry with the log before identifying the difference.'],
 ['¿Qué movimiento no coincide?','Comprobantes: comida 30, transporte 10. Estado: comida 30, transporte 10, comisión 5.',['Comida 30','Transporte 10','Comisión 5'],'La comisión aparece en el estado sin registro correspondiente.','Compara cada movimiento del estado con el registro.'],
 ['Qual movimento não corresponde?','Comprovantes: comida 30, transporte 10. Extrato: comida 30, transporte 10, tarifa 5.',['Comida 30','Transporte 10','Tarifa 5'],'A tarifa aparece no extrato sem registro correspondente.','Compare cada movimento do extrato com o registro.'],
 ]),
 numeric(Q('practice-02','practice',s[1],0,[
 ['Available after reserving the purchase?','Displayed balance: 100, excluding a known pending purchase of 25. No other commitments.',['75','100','125'],'100 − 25 = 75 remains after this known purchase.','The display explicitly excludes the pending purchase; reserve it once.'],
 ['¿Disponible tras reservar la compra?','Saldo mostrado: 100, sin descontar una compra pendiente conocida de 25. No hay otros compromisos.',['75','100','125'],'100 − 25 = 75 quedan tras esta compra conocida.','El saldo excluye la compra pendiente; resérvala una vez.'],
 ['Disponível após reservar a compra?','Saldo mostrado: 100, sem descontar uma compra pendente conhecida de 25. Sem outros compromissos.',['75','100','125'],'100 − 25 = 75 restam após esta compra conhecida.','O saldo exclui a compra pendente; reserve uma vez.'],
 ]),[100,25],subtract(input(0),input(1))),
 numeric(Q('practice-03','practice',s[2],1,[
 ['Total after the transfer?','Your accounts hold 80 and 20. You move 30 between them with no fee.',['130','100','70'],'80 + 20 = 100; the transfer changes location only.','Do not add the transferred money to the existing combined total.'],
 ['¿Total tras transferir?','Tus cuentas tienen 80 y 20. Mueves 30 entre ellas sin comisión.',['130','100','70'],'80 + 20 = 100; la transferencia solo cambia de lugar.', 'No sumes lo transferido al total combinado que ya existía.'],
 ['Total após transferir?','Suas contas têm 80 e 20. Você move 30 entre elas sem tarifa.',['130','100','70'],'80 + 20 = 100; a transferência só muda o local.','Não some o valor transferido ao total conjunto já existente.'],
 ]),[80,20,30],add(input(0),input(1))),
 Q('practice-04','practice',s[0],0,[
 ['What does reconciliation establish?','An unfamiliar statement entry has no matching record.',['The entry needs investigation','The entry is certainly fraud','The entry must be income'],'An unmatched entry identifies a question, not its cause.', 'Check details before labeling the unexplained transaction.'],
 ['¿Qué establece la conciliación?','Un movimiento del estado no tiene registro correspondiente; desconoces su descripción.',['Hay que investigar el movimiento','Es fraude con certeza','Tiene que ser un ingreso'],'Un movimiento sin coincidencia señala una duda, no su causa.','Revisa detalles antes de clasificar el movimiento desconocido.'],
 ['O que a conciliação estabelece?','Um movimento do extrato não tem registro correspondente; a descrição é desconhecida.',['É preciso investigar o movimento','É certamente fraude','Só pode ser renda'],'Um movimento sem correspondência aponta uma dúvida, não sua causa.','Confira detalhes antes de classificar o movimento desconhecido.'],
 ]),
 Q('practice-05','practice',s[1],1,[
 ['Should you subtract it again?','The available-balance label explicitly says the pending purchase is already deducted.',['Yes, every pending item twice','No, it is already reserved'],'Subtracting again would double-count the same pending purchase.','Check what the displayed balance already includes.'],
 ['¿Lo restas otra vez?','La etiqueta de saldo disponible dice expresamente que la compra pendiente ya está descontada.',['Sí, todo pendiente dos veces','No, ya está reservado'],'Restar otra vez contaría dos veces la misma compra pendiente.','Revisa qué incluye ya el saldo mostrado.'],
 ['Deve subtrair novamente?','A indicação de saldo disponível diz expressamente que a compra pendente já foi descontada.',['Sim, todo pendente duas vezes','Não, já está reservado'],'Subtrair novamente contaria duas vezes a mesma compra pendente.','Confira o que o saldo mostrado já inclui.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which mismatch remains?', 'Log: rent 70, fee 5; statement: rent 70, fee 5, transit 8. A pending food purchase is listed separately.',['Rent','Fee','Transit'],'Transit has no matching log entry; the pending item is separate.','Match the listed settled entries before considering pending transactions.'],
 ['¿Qué diferencia queda?','Registro: renta 70, comisión 5; estado: renta 70, comisión 5, transporte 8. La compra pendiente de comida está aparte.',['Renta','Comisión','Transporte'],'Transporte no tiene registro correspondiente; la compra pendiente está aparte.','Compara los movimientos liquidados antes de considerar los pendientes.'],
 ['Qual diferença resta?','Registro: aluguel 70, tarifa 5; extrato: aluguel 70, tarifa 5, transporte 8. A compra pendente de comida está separada.',['Aluguel','Tarifa','Transporte'],'Transporte não tem registro correspondente; a compra pendente está separada.','Compare os movimentos liquidados antes de considerar os pendentes.'],
 ]),
 ]}));
