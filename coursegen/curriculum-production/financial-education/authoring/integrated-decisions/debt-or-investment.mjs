import { capstone, Q } from './factory.mjs';
export const debtOrInvestment = resolve => capstone(7, resolve,
 ['Debt or investment?', '¿Deuda o inversión?', 'Dívida ou investimento?'],
 ['Compare the same usable surplus while protecting near-term needs.', 'Compara el mismo sobrante utilizable y protege las necesidades próximas.', 'Compare a mesma sobra utilizável e preserve as necessidades próximas.'],
 'Treating hoped-for returns as guaranteed or changing the available surplus when comparing repayment methods.',
 s => ({ evidence:[0,1,2,0,1,0], segments:[
 Q('practice-01','practice',s[0],1,[
 ['Highest-rate-first targets which debt?','Minimums are covered; the same extra amount is available. A has the higher rate; B the smaller balance.',['Debt B','Debt A'],'Highest-rate-first directs extra payments to the higher-rate debt.','A smaller balance is the other method’s priority.'],
 ['¿Cuál prioriza mayor tasa primero?','Mínimos cubiertos; mismo monto extra disponible. A tiene mayor tasa; B tiene menor saldo.',['Deuda B','Deuda A'],'Mayor tasa primero dirige el extra a la deuda más cara.','El menor saldo es la prioridad del otro método.'],
 ['Qual prioriza maior taxa primeiro?','Mínimos cobertos; mesmo valor extra disponível. A tem maior taxa; B tem menor saldo.',['Dívida B','Dívida A'],'Maior taxa primeiro direciona o extra à dívida mais cara.','O menor saldo é a prioridade do outro método.'],
 ]),
 Q('practice-02','practice',s[1],0,[
 ['Can this person absorb the loss?','They welcome risk, but losing this money leaves next month’s essentials unpaid.',['No, financial capacity is limited','Yes, willingness ensures capacity'],'Willingness does not fund essential bills after a loss.','Distinguish feelings about risk from ability to bear its consequences.'],
 ['¿Puede absorber la pérdida?','Acepta el riesgo de invertir, pero perder este dinero dejaría sin pagar necesidades del próximo mes.',['No, su capacidad financiera es limitada','Sí, querer garantiza poder'],'Aceptar el riesgo no financia necesidades después de una pérdida.','Distingue actitud ante el riesgo y capacidad de asumir consecuencias.'],
 ['Consegue absorver a perda?','Aceita o risco de investir, mas perder este dinheiro deixaria necessidades do próximo mês sem pagamento.',['Não, a capacidade financeira é limitada','Sim, querer garante poder'],'Aceitar risco não financia necessidades após uma perda.','Distinga atitude diante do risco e capacidade de assumir consequências.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['Where keep next week’s reserve?','A: immediate access without fees; B: locked for a year. Both have the same stated safety.',['Only B','Either; access is irrelevant','A meets the deadline'],'Immediate access preserves the reserve’s stated near-term purpose.','A later release cannot fund next week’s required payment.'],
 ['¿Dónde guardar la reserva próxima?','A: acceso inmediato sin comisión; B: bloqueo de un año. Ambas tienen igual seguridad indicada.',['Solo B','Cualquiera; el acceso no importa','A cumple el plazo'],'El acceso inmediato conserva la finalidad próxima de la reserva.','Una liberación posterior no paga la obligación de la próxima semana.'],
 ['Onde guardar a reserva próxima?','A: acesso imediato sem tarifa; B: bloqueio por um ano. Ambas têm a mesma segurança informada.',['Só B','Qualquer uma; acesso não importa','A atende ao prazo'],'O acesso imediato preserva a finalidade próxima da reserva.','Uma liberação posterior não paga a obrigação da próxima semana.'],
 ]),
 Q('practice-04','practice',s[0],0,[
 ['What makes the comparison fair?','One repayment model uses extra money; the other none, with identical minimums.',['Use the same feasible extra','Declare the faster result superior','Ignore the different budgets'],'Different extra amounts confound the comparison between repayment methods.','Hold available surplus constant when comparing the two priorities.'],
 ['¿Qué vuelve justa la comparación?','Una simulación usa dinero extra; la otra ninguno. Los pagos mínimos son iguales.',['Usar el mismo extra viable','Declarar superior el resultado rápido','Ignorar presupuestos diferentes'],'Distintos extras distorsionan la comparación entre métodos de pago.','Mantén constante el sobrante disponible al comparar ambas prioridades.'],
 ['O que torna a comparação justa?','Uma simulação usa dinheiro extra; a outra nenhum. Os pagamentos mínimos são iguais.',['Usar o mesmo extra viável','Declarar superior o resultado rápido','Ignorar os orçamentos diferentes'],'Extras diferentes distorcem a comparação entre métodos de pagamento.','Mantenha constante a sobra disponível ao comparar as prioridades.'],
 ]),
 Q('practice-05','practice',s[1],1,[
 ['What establishes loss capacity?','An investor enjoys risk; essentials depend on this money and a bonus is unconfirmed.',['Enjoying risk','Funds covering needs after loss','An unconfirmed bonus'],'Capacity depends on resources remaining after the loss.','Neither enthusiasm nor an unconfirmed payment protects essential needs.'],
 ['¿Qué demuestra capacidad de pérdida?','Le gusta el riesgo y espera un bono; sus necesidades dependen del dinero que invertiría.',['Disfrutar el riesgo','Fondos para necesidades tras perder','Un bono sin confirmar'],'La capacidad depende de los recursos restantes tras perder.','Ni entusiasmo ni un pago sin confirmar protegen necesidades esenciales.'],
 ['O que demonstra capacidade de perda?','Gosta de risco e espera um bônus; suas necessidades dependem do dinheiro que investiria.',['Gostar de risco','Recursos para necessidades após perder','Um bônus não confirmado'],'A capacidade depende dos recursos restantes após a perda.','Nem entusiasmo nem pagamento não confirmado protegem necessidades essenciais.'],
 ]),
 Q('transfer-01','transfer',s[0],0,[
 ['Which follows that priority?','Reserve and minimums protected. Priority: highest-rate debt, A. Investment returns are uncertain.',['Extra payment to A','Invest for a hoped-for return','Extra payment to smaller debt B'],'Paying A follows the priority without assuming investment returns.','Use the stated priority and feasible surplus, not hoped-for returns.'],
 ['¿Qué cumple la prioridad indicada?','Reserva y mínimos protegidos; prioridad: reducir deuda de mayor tasa. Rendimiento incierto; A tiene la mayor tasa.',['Pago extra a A','Invertir por un rendimiento esperado','Pago extra a la deuda menor B'],'Pagar A sigue la prioridad sin suponer rendimientos de inversión.','Usa la prioridad y sobrante viable, no rendimientos esperados.'],
 ['O que atende à prioridade?','Reserva e mínimos protegidos; prioridade: reduzir dívida de maior taxa. Retorno incerto; A tem a maior taxa.',['Pagamento extra a A','Investir por um retorno esperado','Pagamento extra à dívida menor B'],'Pagar A segue a prioridade sem supor retornos de investimento.','Use a prioridade e a sobra viável, não retornos esperados.'],
 ]),
 ]}));
