import { capstone, Q } from './factory.mjs';
export const crossBorderPayment = resolve => capstone(11, resolve,
 ['Across borders', 'Entre países', 'Entre países'],
 ['A transfer must arrive in a usable form before the payment deadline.', 'Una transferencia debe llegar utilizable antes del vencimiento.', 'Uma transferência deve chegar utilizável antes do vencimento.'],
 'Choosing a headline exchange rate without considering recipient amount, access or uncertain arrival.',
 s=>({evidence:[0,1,2,0,2,0],segments:[
 Q('practice-01','practice',s[0],1,[
 ['Which offer meets the need?','Both deliver equal amounts before Friday. A requires distant pickup; B reaches the recipient’s accessible account.',['A, ignoring pickup','B, accessible delivery'],'B meets the stated access constraint as well as the deadline.','Compare collection conditions alongside amount and arrival.'],
 ['¿Qué oferta cumple la necesidad?','Ambas entregan igual monto antes del viernes. A exige retiro lejano; B llega a la cuenta accesible del destinatario.',['A, ignorando el retiro','B, entrega accesible'],'B cumple la condición de acceso y también el plazo.','Compara condiciones de cobro, monto y llegada.'],
 ['Qual oferta atende?','Ambas entregam igual valor antes de sexta. A exige retirada distante; B chega à conta acessível do destinatário.',['A, ignorando a retirada','B, entrega acessível'],'B atende à condição de acesso e também ao prazo.','Compare condições de recebimento, valor e chegada.'],
 ]),
 Q('practice-02','practice',s[1],0,[
 ['Can the receipt fund Monday?','Bill due Monday; transfer guaranteed by Wednesday, with no other money.',['Not reliably on time','Yes, Wednesday is guaranteed'],'A Wednesday guarantee does not establish Monday access.','Compare the guaranteed arrival with the actual due date.'],
 ['¿La entrada paga el lunes?','La cuenta vence el lunes; la transferencia solo se garantiza para el miércoles. Sin otro dinero.',['No asegura pagar a tiempo','Sí, el miércoles está garantizado'],'Garantizar el miércoles no demuestra acceso el lunes.','Compara la llegada garantizada con la fecha real de vencimiento.'],
 ['O recebimento paga segunda?','A conta vence segunda; a transferência só é garantida até quarta. Sem outro dinheiro.',['Não assegura pagar no prazo','Sim, quarta está garantida'],'Garantir quarta não comprova acesso na segunda.','Compare a chegada garantida com o vencimento real.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['Which problem is shown?','Each month’s confirmed income covers expenses, but arrives after that month’s bill deadline.',['A permanent monthly deficit','No problem at all','A recurring timing gap'],'The totals suffice, but the calendar repeatedly leaves a gap.','Separate amount sufficiency from the timing of access.'],
 ['¿Qué problema aparece?','Cada mes el ingreso confirmado cubre gastos, pero llega después del vencimiento de la cuenta.',['Un déficit mensual permanente','Ningún problema','Un desfase recurrente de fechas'],'Los totales alcanzan, pero el calendario deja un desfase recurrente.','Separa suficiencia de montos y momento de acceso.'],
 ['Qual problema aparece?','Todo mês a renda confirmada cobre despesas, mas chega depois do vencimento da conta.',['Um déficit mensal permanente','Nenhum problema','Um desencontro recorrente de datas'],'Os totais bastam, mas o calendário deixa um desencontro recorrente.','Separe suficiência de valores e momento de acesso.'],
 ]),
 Q('practice-04','practice',s[0],0,[
 ['Which offer delivers more?', 'Same sending cost and timing: A delivers 90 after all deductions; B delivers 85 after all deductions.',['A','B','Cannot compare net amounts'],'A delivers more under the stated equal cost and timing.','Compare what the recipient actually receives after deductions.'],
 ['¿Qué oferta entrega más?','Mismo costo de envío y plazo: A entrega 90 tras descuentos; B entrega 85 tras descuentos.',['A','B','No se comparan montos netos'],'A entrega más con el mismo costo y plazo indicados.','Compara lo recibido realmente después de los descuentos.'],
 ['Qual oferta entrega mais?','Mesmo custo de envio e prazo: A entrega 90 após descontos; B entrega 85 após descontos.',['A','B','Não se comparam valores líquidos'],'A entrega mais com o mesmo custo e prazo informados.','Compare o recebimento real depois dos descontos.'],
 ]),
 Q('practice-05','practice',s[2],1,[
 ['Would earlier arrival solve this?', 'Every month expenses exceed confirmed income, even if every transfer arrives before the deadline.',['Yes, timing solves any deficit','No, an amount gap remains'],'Earlier access cannot fill a persistent shortfall in total funds.','Changing dates does not increase the amount received.'],
 ['¿Llegar antes lo resolvería?','Cada mes los gastos superan ingresos confirmados, aunque todas las transferencias lleguen antes del vencimiento.',['Sí, las fechas resuelven todo déficit','No, sigue faltando monto'],'Acceder antes no cubre un faltante persistente de fondos totales.','Cambiar fechas no aumenta el monto recibido.'],
 ['Chegar antes resolveria?','Todo mês as despesas superam a renda confirmada, mesmo com transferências antes do vencimento.',['Sim, datas resolvem qualquer déficit','Não, ainda falta valor'],'Acesso antecipado não cobre uma falta persistente de recursos totais.','Mudar datas não aumenta o valor recebido.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which offer fits this bill?', 'Bill due tomorrow. A: more money, uncertain arrival; B: enough tomorrow, accessible pickup.',['A because amount is higher','Either: both send money','B meets the constraints'],'B combines sufficient amount, timely arrival and accessible collection.','A larger receipt cannot compensate for missing the required deadline.'],
 ['¿Qué oferta sirve para esta cuenta?','Vence mañana. A: mayor monto, llegada incierta; B: monto suficiente mañana, retiro accesible.',['A porque entrega más','Cualquiera porque ambas envían','B cumple las condiciones'],'B combina monto suficiente, llegada a tiempo y cobro accesible.','Un monto mayor no compensa incumplir el plazo necesario.'],
 ['Qual oferta serve para esta conta?','Vence amanhã. A: maior valor, chegada incerta; B: valor suficiente amanhã, retirada acessível.',['A porque entrega mais','Qualquer uma porque ambas enviam','B atende às condições'],'B combina valor suficiente, chegada no prazo e recebimento acessível.','Um valor maior não compensa perder o prazo necessário.'],
 ]),
 ]}));
