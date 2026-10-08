import { capstone, Q, numeric, input, subtract } from './factory.mjs';
export const newDependent = resolve => capstone(8, resolve,
 ['A new dependent', 'Una persona a cargo', 'Uma pessoa dependente'],
 ['New care responsibilities change both daily money needs and protection needs.', 'Las nuevas responsabilidades cambian necesidades de dinero y protección.', 'Novas responsabilidades mudam necessidades de dinheiro e proteção.'],
 'Updating daily spending without reconsidering lost income, protection gaps or how long care lasts.',
 s=>({evidence:[0,1,2,0,2,0],segments:[
 Q('practice-01','practice',s[0],1,[
 ['What needs reassessment?','Someone now depends on your income; existing protection was chosen before that responsibility.',['Only the current premium','The needs protection must cover'],'A new dependent changes the consequences of losing income.','An unchanged policy does not prove unchanged protection needs.'],
 ['¿Qué debes reconsiderar?','Alguien ahora depende de tu ingreso; elegiste la protección antes de esa responsabilidad.',['Solo la prima actual','Las necesidades que debe cubrir'],'Una persona dependiente cambia las consecuencias de perder ingresos.','Una póliza igual no demuestra necesidades de protección iguales.'],
 ['O que reavaliar?','Alguém agora depende da sua renda; a proteção foi escolhida antes dessa responsabilidade.',['Só o prêmio atual','As necessidades que deve cobrir'],'Uma pessoa dependente muda as consequências da perda de renda.','Uma apólice igual não comprova necessidades de proteção iguais.'],
 ]),
 numeric(Q('practice-02','practice',s[1],0,[
 ['Unallocated amount after the update?','Confirmed funds: 500. Previous essentials: 350; newly required care: 100.',['50','150','250'],'500 − 350 − 100 = 50 remains unallocated.','Include the new care expense in the revised total.'],
 ['¿Monto sin asignar tras ajustar?','Fondos confirmados: 500. Necesidades anteriores: 350; nuevo cuidado necesario: 100.',['50','150','250'],'500 − 350 − 100 = 50 quedan sin asignar.','Incluye el nuevo cuidado en el total ajustado.'],
 ['Valor sem destino após ajustar?','Recursos confirmados: 500. Necessidades anteriores: 350; novo cuidado necessário: 100.',['50','150','250'],'500 − 350 − 100 = 50 ficam sem destino.','Inclua o novo cuidado no total revisto.'],
 ]),[500,350,100],subtract(subtract(input(0),input(1)),input(2))),
 Q('practice-03','practice',s[2],2,[
 ['What belongs in the temporary plan?','For three months of care, paid work falls and appointment transport costs rise.',['Transport alone','Old earnings unchanged','Lower earnings and higher transport'],'Both temporary changes affect what the household can commit.','The care period changes income as well as expenses.'],
 ['¿Qué incluye el plan temporal?','El cuidado dura tres meses; durante ese periodo baja el trabajo pagado y aumenta el transporte a citas.',['Solo el transporte','El ingreso anterior sin cambios','Menor ingreso y mayor transporte'],'Ambos cambios temporales afectan lo que el hogar puede comprometer.','El periodo de cuidado cambia ingresos además de gastos.'],
 ['O que inclui o plano temporário?','O cuidado dura três meses; nesse período cai o trabalho pago e aumenta o transporte às consultas.',['Só o transporte','A renda anterior sem mudanças','Menor renda e maior transporte'],'As duas mudanças temporárias afetam o que a família pode comprometer.','O período de cuidados muda a renda e as despesas.'],
 ]),
 Q('practice-04','practice',s[0],0,[
 ['Which next step?','New care needs; existing policy events and limits remain unchecked.',['Check coverage against new needs','Confirm only that a policy exists','Assume every care cost is insured'],'Existing coverage may leave gaps for the new responsibility.','A policy’s existence alone does not establish adequate coverage.'],
 ['¿Qué sigue?','Surgen nuevas necesidades de cuidado; existe póliza, pero no revisaste eventos cubiertos ni límites.',['Revisar si cubre las nuevas necesidades','Confirmar solo que existe una póliza','Suponer que cubre todo cuidado'],'La cobertura existente puede dejar huecos ante la nueva responsabilidad.','Tener una póliza no demuestra que la cobertura sea adecuada.'],
 ['Qual o próximo passo?','Surgem novas necessidades de cuidado; existe apólice, mas eventos cobertos e limites não foram conferidos.',['Conferir se cobre as novas necessidades','Confirmar só que existe uma apólice','Supor que cobre todo cuidado'],'A cobertura existente pode deixar lacunas diante da nova responsabilidade.','Ter uma apólice não comprova que a cobertura seja adequada.'],
 ]),
 Q('practice-05','practice',s[2],1,[
 ['When can the old plan return?','Care may end soon; paid hours and transport needs remain unchanged.',['Immediately after an estimate','When relevant conditions change','Never; changes are permanent'],'Update the plan when its income and cost assumptions change.','An estimated end date is not a confirmed restoration of income.'],
 ['¿Cuándo retomar el plan anterior?','El cuidado podría terminar pronto, pero las horas laborales y necesidades de transporte siguen iguales.',['En cuanto haya una estimación','Cuando cambien las condiciones reales','Nunca; todo cambio es permanente'],'Ajusta el plan cuando cambien sus supuestos de ingreso y costo.','Una fecha estimada no confirma que vuelva el ingreso anterior.'],
 ['Quando retomar o plano anterior?','O cuidado pode acabar logo, mas horas de trabalho e necessidades de transporte ainda não mudaram.',['Assim que houver uma estimativa','Quando as condições reais mudarem','Nunca; toda mudança é permanente'],'Ajuste o plano quando mudarem as premissas de renda e custo.','Uma data estimada não confirma a volta da renda anterior.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which review is warranted?','An adult relative now needs your care; daily costs funded, backup care unplanned.',['None: bills are funded','Buy any advertised policy','Assess the new backup-care gap'],'Funded daily bills do not settle protection if care becomes unavailable.','Review the new responsibility before choosing a protection response.'],
 ['¿Qué revisión corresponde?','Un familiar adulto vive contigo y depende de tus cuidados; gastos diarios cubiertos, pero sin cuidado de respaldo.',['Ninguna: las cuentas están pagadas','Comprar cualquier póliza anunciada','Evaluar el faltante de cuidado alterno'],'Pagar cuentas diarias no resuelve qué pasa si falta quien cuida.','Revisa la nueva responsabilidad antes de elegir una protección.'],
 ['Qual revisão é necessária?','Um familiar adulto mora com você e depende dos seus cuidados; gastos diários cobertos, mas sem cuidado substituto.',['Nenhuma: contas estão pagas','Comprar qualquer apólice anunciada','Avaliar a falta de cuidado substituto'],'Pagar contas diárias não resolve a ausência de quem cuida.','Revise a nova responsabilidade antes de escolher uma proteção.'],
 ]),
 ]}));
