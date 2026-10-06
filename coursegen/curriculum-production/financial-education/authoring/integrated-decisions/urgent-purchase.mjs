import { capstone, Q } from './factory.mjs';
export const urgentPurchase = resolve => capstone(5, resolve,
 ['An urgent replacement', 'Reemplazo urgente', 'Substituição urgente'],
 ['Urgency does not remove the need to check the purchase and financing.', 'La urgencia no elimina la necesidad de revisar compra y financiamiento.', 'Mesmo com pressa, confira a compra e o crédito.'],
 'Using urgency or a low installment to skip fit, total cost and contract checks.',
 s => ({ evidence: [0,1,2,1,2,0], segments: [
 Q('practice-01','practice',s[0],0,[
 ['What should be clarified first?','An appliance broke; the seller offers a premium replacement without checking your needs.',['The required function','The approved credit limit'],'Required function defines which alternatives can solve the problem.','Urgency does not make every replacement suitable.'],
 ['¿Qué aclarar primero?','Hay que reemplazar un aparato roto; ofrecen uno prémium sin revisar la función necesaria.',['La función que debe cumplir','El límite de crédito aprobado'],'La función necesaria define qué alternativas resuelven el problema.','La urgencia no vuelve adecuado cualquier reemplazo.'],
 ['O que esclarecer primeiro?','Um aparelho quebrou; oferecem um modelo premium sem conferir a função necessária.',['A função que deve cumprir','O limite de crédito aprovado'],'A função define quais opções servem para você.','A pressa não faz qualquer aparelho servir.'],
 ]),
 Q('practice-02','practice',s[1],1,[
 ['Which affordability check matters?','The advertised installment is small, but existing essential commitments nearly exhaust next month’s income.',['Compare it only with salary','Compare it with funds after commitments'],'Existing commitments reduce what can fund another payment.','A small installment can still exceed the available remainder.'],
 ['¿Qué revisión importa?','La mensualidad anunciada es pequeña, pero los compromisos esenciales casi agotan el ingreso del próximo mes.',['Compararla solo con el sueldo','Compararla con el resto tras compromisos'],'Los compromisos reducen lo disponible para otro pago.','Una mensualidad pequeña puede superar el resto disponible.'],
 ['Qual conferência importa?','A parcela anunciada é pequena, mas compromissos essenciais quase esgotam a renda do próximo mês.',['Comparar só com o salário','Comparar com a sobra após compromissos'],'Os compromissos reduzem o disponível para outra parcela.','Mesmo uma parcela baixa pode ser maior que a sobra.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['Which fact needs verification?','The seller promises free repairs; written terms exclude the part likely to fail.',['Only the display price','Only the verbal promise','The written repair coverage'],'The written exclusion may defeat the promised repair benefit.','Resolve the conflict before relying on the repair promise.'],
 ['¿Qué dato verificar?','Prometen reparaciones gratis de palabra; las condiciones escritas excluyen la pieza que suele fallar.',['Solo el precio exhibido','Solo la promesa verbal','La cobertura escrita aplicable'],'La exclusión escrita puede anular el beneficio de reparación esperado.','Aclara la contradicción antes de confiar en la promesa.'],
 ['Qual fato verificar?','Prometem consertos grátis verbalmente; os termos escritos excluem a peça que costuma falhar.',['Só o preço anunciado','Só a promessa verbal','A cobertura escrita aplicável'],'Os termos podem excluir o conserto que você espera.','Confira os termos antes de confiar na promessa.'],
 ]),
 Q('practice-04','practice',s[1],0,[
 ['Does financing fit?', 'Funds after essentials: 25 monthly. Proposed payments: 30 monthly; no verified additional funds.',['No, each payment exceeds available funds','Yes, the product is urgently needed'],'Urgency does not create the missing payment capacity.','Compare the proposed payment with the stated available funds.'],
 ['¿Cabe el financiamiento?','Tras necesidades quedan 25 mensuales. Los pagos serían 30 mensuales; no hay fondos adicionales verificados.',['No, cada pago supera lo disponible','Sí, el producto urge'],'La urgencia no crea la capacidad de pago faltante.','Compara el pago propuesto con los fondos disponibles indicados.'],
 ['O financiamento cabe?','Após necessidades sobram 25 mensais. As parcelas seriam 30 mensais; sem recursos adicionais verificados.',['Não, cada parcela supera o disponível','Sim, o produto é urgente'],'A urgência não cria a capacidade de pagamento que falta.','Compare a parcela proposta com os recursos disponíveis informados.'],
 ]),
 Q('practice-05','practice',s[2],1,[
 ['What remains unresolved?','Receipt: seller and price, no return conditions; the applicable rule is unchecked.',['Whether there is a receipt','What return conditions apply','The printed purchase price'],'A receipt alone does not establish the applicable return conditions.','Find the missing condition instead of inferring a universal right.'],
 ['¿Qué sigue sin aclararse?','El comprobante identifica vendedor y precio. Faltan condiciones de devolución; no se verificó la regla aplicable.',['Si existe comprobante','Qué condiciones de devolución aplican','El precio impreso'],'Un comprobante no establece por sí solo las condiciones de devolución.','Busca la condición faltante sin suponer un derecho universal.'],
 ['O que continua indefinido?','O comprovante identifica vendedor e preço. Faltam condições de devolução; a regra aplicável não foi conferida.',['Se existe comprovante','Quais condições de devolução valem','O preço impresso'],'O recibo, por si só, não diz quando pode devolver.','Confira a regra; não suponha que vale igual em todo lugar.'],
 ]),
 Q('transfer-01','transfer',s[0],1,[
 ['Which decision is ready?', 'The phone must run your work app; compatibility unknown, delivery and credit confirmed.',['Buy because credit is approved','Check the app works','Ignore the required app'],'Confirmed financing cannot make an incompatible phone meet the need.','Verify the unresolved requirement before choosing the replacement.'],
 ['¿Qué decisión está lista?','El teléfono debe ejecutar una aplicación laboral; desconoces su compatibilidad, aunque entrega y crédito están confirmados.',['Comprar porque aprobaron el crédito','Verificar compatibilidad antes de comprar','Ignorar la aplicación necesaria'],'Un crédito confirmado no vuelve compatible al teléfono.','Verifica el requisito pendiente antes de elegir el reemplazo.'],
 ['Qual decisão está pronta?','Você precisa usar um app no celular; não sabe se funciona nele, mas crédito e entrega estão certos.',['Comprar porque o crédito foi aprovado','Conferir se o app funciona','Ignorar o aplicativo necessário'],'Ter crédito não faz o app funcionar no celular.','Confira o que falta antes de escolher o novo aparelho.'],
 ]),
 ]}));
