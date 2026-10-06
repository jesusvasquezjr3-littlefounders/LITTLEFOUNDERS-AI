import { capstone, Q } from './factory.mjs';
export const retirementRevision = resolve => capstone(10, resolve,
 ['Revise the projection', 'Revisa la proyección', 'Revise a projeção'],
 ['A future plan needs updated assumptions, not a promise about future money.', 'Un plan futuro necesita supuestos actualizados, no promesas de dinero.', 'Um plano futuro precisa de premissas atualizadas, não promessas de dinheiro.'],
 'Confusing longer life with rising prices or protecting an old contribution at the expense of current essentials.',
 s=>({evidence:[0,1,2,0,1,0],segments:[
 Q('practice-01','practice',s[0],1,[
 ['Which risk changed?','The same yearly purchases cost more; the assumed number of retirement years is unchanged.',['Longevity alone','Inflation','Neither risk'],'Higher prices change purchasing power even with the same retirement duration.','Separate the cost per year from the number of years.'],
 ['¿Qué riesgo cambió?','Las mismas compras anuales cuestan más; no cambia la cantidad prevista de años de retiro.',['Solo longevidad','Inflación','Ningún riesgo'],'Precios mayores cambian poder de compra aunque dure igual el retiro.','Separa el costo anual de la cantidad de años.'],
 ['Qual risco mudou?','As mesmas compras anuais custam mais; o número previsto de anos de aposentadoria não muda.',['Só longevidade','Inflação','Nenhum risco'],'Preços maiores mudam poder de compra mesmo com duração igual.','Separe o custo anual da quantidade de anos.'],
 ]),
 Q('practice-02','practice',s[1],0,[
 ['What should be reassessed first?','Income falls; the old retirement contribution leaves current essentials unfunded.',['A feasible contribution after essentials','Hiding unpaid essentials','Assuming the old income'],'The changed income requires a feasible contribution plan.','An old target does not replace money for current essentials.'],
 ['¿Qué debes reconsiderar primero?','Baja el ingreso; la aportación anterior al retiro dejaría cuentas esenciales actuales sin fondos.',['Una aportación viable tras necesidades','Cómo ocultar cuentas esenciales pendientes','Cómo suponer el ingreso anterior'],'El ingreso cambiado exige una aportación viable.','Una meta anterior no reemplaza dinero para necesidades actuales.'],
 ['O que reavaliar primeiro?','A renda cai; a contribuição anterior deixaria contas essenciais atuais sem recursos.',['Uma contribuição viável após necessidades','Como esconder contas essenciais pendentes','Como supor a renda anterior'],'A renda alterada exige um plano de contribuição viável.','Uma meta anterior não substitui dinheiro para necessidades atuais.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['What does the projection mean?','The calculator assumes constant yearly returns; actual future returns are unknown.',['Every year will match','The future amount is guaranteed','An amount based on assumptions'],'The projection is conditional on assumptions, not a guaranteed payment.','A calculator can compute an assumption without proving it will happen.'],
 ['¿Qué significa la proyección?','La calculadora supone igual rendimiento cada año; los rendimientos futuros reales son desconocidos.',['Cada año coincidirá','El monto futuro está garantizado','El monto depende de los supuestos'],'La proyección depende de supuestos, no de un pago garantizado.','Calcular un supuesto no demuestra que vaya a cumplirse.'],
 ['O que significa a projeção?','A calculadora supõe o mesmo retorno anual; os retornos futuros reais são desconhecidos.',['Todo ano será igual','O valor futuro é garantido','O valor depende das premissas'],'A projeção depende de premissas, não de um pagamento garantido.','Calcular uma premissa não comprova que ela acontecerá.'],
 ]),
 Q('practice-04','practice',s[0],0,[
 ['Which risk changed now?','Yearly spending stays unchanged, but the plan must cover more years than previously assumed.',['Longevity','Inflation alone','Only the contribution date'],'More years require funding a longer spending period.','Longer duration is different from higher yearly prices.'],
 ['¿Qué riesgo cambió ahora?','El gasto anual sigue igual, pero el plan debe cubrir más años de los previstos.',['Longevidad','Solo inflación','Solo la fecha de aportación'],'Más años requieren financiar un periodo de gasto más largo.','Mayor duración es distinta de mayores precios anuales.'],
 ['Qual risco mudou agora?','O gasto anual permanece igual, mas o plano precisa cobrir mais anos que o previsto.',['Longevidade','Só inflação','Só a data de contribuição'],'Mais anos exigem financiar um período maior de gastos.','Maior duração é diferente de preços anuais maiores.'],
 ]),
 Q('practice-05','practice',s[1],1,[
 ['When can contributions rise again?','Income recovers; essential arrears temporarily absorb the increase.',['Immediately by the entire increase','After accounting for the essential arrears','Only with guaranteed future returns'],'Recovered income is not all free while essential arrears remain due.','Reassess current commitments before increasing the contribution.'],
 ['¿Cuándo aumentar aportaciones otra vez?','Se recupera el ingreso, pero un atraso esencial absorbe temporalmente los fondos adicionales.',['Ya, por todo el aumento','Tras considerar el atraso esencial','Solo con rendimientos futuros garantizados'],'El ingreso recuperado no queda libre mientras venza el atraso esencial.','Revisa compromisos actuales antes de aumentar la aportación.'],
 ['Quando aumentar contribuições novamente?','A renda se recupera, mas uma conta essencial atrasada absorve temporariamente os recursos adicionais.',['Já, por todo o aumento','Após considerar o atraso essencial','Só com retornos futuros garantidos'],'A renda recuperada não fica livre enquanto vence o atraso essencial.','Revise compromissos atuais antes de aumentar a contribuição.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which assumptions need revision?','Yearly costs rise and retirement lasts longer; projected returns remain uncertain.',['Only the retirement start date','Only the annual cost','Both annual cost and duration'],'Both changes affect funding needs; neither makes uncertain returns guaranteed.','Update each changed assumption instead of merging the two risks.'],
 ['¿Qué supuestos debes revisar?','El nuevo plan usa mayor costo de vida anual y más años de retiro; el rendimiento sigue incierto.',['Solo la fecha de retiro','Solo el costo anual','Costo anual y duración'],'Ambos cambios afectan necesidades; ninguno garantiza rendimientos inciertos.','Actualiza cada supuesto cambiado sin mezclar ambos riesgos.'],
 ['Quais premissas revisar?','O novo plano usa maior custo anual de vida e mais anos de aposentadoria; o retorno continua incerto.',['Só a data de aposentadoria','Só o custo anual','Custo anual e duração'],'As duas mudanças afetam necessidades; nenhuma garante retornos incertos.','Atualize cada premissa alterada sem misturar os dois riscos.'],
 ]),
 ]}));
