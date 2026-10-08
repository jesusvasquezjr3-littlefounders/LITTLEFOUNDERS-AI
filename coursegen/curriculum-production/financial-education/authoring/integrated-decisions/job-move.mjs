import { capstone, Q, numeric, input, subtract, add } from './factory.mjs';
export const jobMove = resolve => capstone(4, resolve,
 ['Changing work', 'Cambiar de trabajo', 'Mudar de trabalho'],
 ['Compare what the move changes, including costs before the first payment.', 'Compara lo que cambia al mudarte, incluidos costos antes del primer pago.', 'Compare o que muda, incluindo custos antes do primeiro pagamento.'],
 'Treating a higher advertised salary as an immediate increase in available money.',
 s => ({ evidence: [0, 1, 2, 0, 1, 0], segments: [
 Q('practice-01','practice',s[0],1,[
 ['Which comparison is fair?','Offer A states gross pay; offer B states take-home pay. Deductions for A are unknown.',['Compare the stated amounts','First estimate A’s take-home pay'],'Compare pay after deductions on the same basis.','Gross and take-home amounts are not directly comparable.'],
 ['¿Qué comparación es justa?','A indica sueldo bruto; B indica pago neto. Desconoces las deducciones de A.',['Comparar los montos indicados','Estimar primero el neto de A'],'Compara el pago tras deducciones con la misma base.','El bruto y el neto no se comparan directamente.'],
 ['Qual comparação é justa?','A informa salário bruto; B informa líquido. As deduções de A são desconhecidas.',['Comparar os valores informados','Estimar primeiro o líquido de A'],'Compare o pagamento após deduções na mesma base.','Valores brutos e líquidos não são diretamente comparáveis.'],
 ]),
 numeric(Q('practice-02','practice',s[1],0,[
 ['Cash needed before moving?','Required before arrival: deposit 200, moving service 100, first rent 300.',['600','400','300'],'200 + 100 + 300 = 600 must be available.','Include all required upfront payments, even a refundable deposit.'],
 ['¿Dinero previo a la mudanza?','Antes de llegar: depósito 200, mudanza 100, primera renta 300.',['600','400','300'],'200 + 100 + 300 = 600 deben estar disponibles.','Incluye todos los pagos iniciales, aunque el depósito sea reembolsable.'],
 ['Dinheiro antes da mudança?','Antes de chegar: caução 200, mudança 100, primeiro aluguel 300.',['600','400','300'],'200 + 100 + 300 = 600 precisam estar disponíveis.','Inclua todos os pagamentos iniciais, mesmo uma caução reembolsável.'],
 ]),[200,100,300],add(add(input(0),input(1)),input(2))),
 Q('practice-03','practice',s[2],2,[
 ['What must be checked?','New work raises income; an income-linked benefit’s rule is unknown.',['Assume the benefit continues','Assume every benefit stops','Verify this benefit’s official rule'],'The specific rule determines whether this income change matters.','A change in work alone does not establish eligibility or ineligibility.'],
 ['¿Qué debes verificar?','Un apoyo depende del ingreso declarado. El nuevo trabajo lo aumenta; desconoces la regla aplicable.',['Suponer que sigue el apoyo','Suponer que todos se cancelan','Verificar la regla oficial del apoyo'],'La regla concreta determina si este cambio de ingreso afecta.','Cambiar de trabajo no demuestra por sí solo elegibilidad o exclusión.'],
 ['O que verificar?','Um benefício depende da renda declarada. O novo trabalho aumenta a renda; a regra aplicável é desconhecida.',['Supor que o benefício continua','Supor que todos acabam','Verificar a regra oficial do benefício'],'A regra específica determina se esta mudança de renda afeta.','Mudar de emprego não comprova, sozinho, elegibilidade ou exclusão.'],
 ]),
 numeric(Q('practice-04','practice',s[0],1,[
 ['Monthly gain after work costs?','New take-home pay: 900; new work costs: 180. Current take-home after work costs: 680.',['220','40','720'],'900 − 180 − 680 = 40 more each month.','Compare both roles after their work costs.'],
 ['¿Mejora mensual tras costos laborales?','Nuevo pago neto: 900; nuevos costos laborales: 180. Neto actual tras costos laborales: 680.',['220','40','720'],'900 − 180 − 680 = 40 más al mes.','Compara ambos trabajos tras sus respectivos costos laborales.'],
 ['Ganho mensal após custos do trabalho?','Novo líquido: 900; novos custos do trabalho: 180. Líquido atual após custos: 680.',['220','40','720'],'900 − 180 − 680 = 40 a mais por mês.','Compare os dois empregos após seus respectivos custos de trabalho.'],
 ]),[900,180,680],subtract(subtract(input(0),input(1)),input(2))),
 Q('practice-05','practice',s[1],0,[
 ['What blocks the move now?','Deposit due Monday; first pay arrives Friday, with no funds for Monday.',['The upfront funding gap','A proven monthly shortfall','The deposit’s refundable label'],'Monday needs accessible funds before Friday’s payment arrives.','A refundable payment still needs funding when it is due.'],
 ['¿Qué impide mudarte ahora?','El depósito vence el lunes; el primer sueldo llega el viernes. No hay fondos para el lunes.',['El faltante de fondos iniciales','Un faltante mensual comprobado','Que el depósito sea reembolsable'],'El lunes exige fondos accesibles antes del pago del viernes.','Un pago reembolsable necesita fondos cuando vence.'],
 ['O que impede a mudança agora?','A caução vence segunda; o primeiro salário chega sexta. Não há recursos para segunda.',['A falta de recursos iniciais','Uma falta mensal comprovada','A caução ser reembolsável'],'Segunda exige recursos acessíveis antes do pagamento de sexta.','Um pagamento reembolsável precisa de recursos no vencimento.'],
 ]),
 Q('transfer-01','transfer',s[0],1,[
 ['Which conclusion is supported?','Remote work pays more net but removes valuable coverage; replacement cost is unknown.',['Definitely better finances','Compare replacement cost before deciding','Ignore the lost coverage'],'Unknown replacement costs prevent a complete financial comparison.','Compare the whole change, not only the larger payment.'],
 ['¿Qué conclusión está respaldada?','Una oferta remota paga más neto, pero quita cobertura valiosa. Desconoces cuánto cuesta reemplazarla.',['La oferta mejora seguro tus finanzas','Comparar el costo de reemplazo','Ignorar la cobertura perdida'],'El costo de reemplazo desconocido impide una comparación financiera completa.','Compara todo el cambio, no solo el pago mayor.'],
 ['Qual conclusão tem respaldo?','Uma oferta remota paga mais líquido, mas retira cobertura valiosa. O custo de reposição é desconhecido.',['A oferta certamente melhora as finanças','Comparar o custo de reposição','Ignorar a cobertura perdida'],'O custo de reposição desconhecido impede uma comparação financeira completa.','Compare a mudança inteira, não apenas o pagamento maior.'],
 ]),
 ]}));
