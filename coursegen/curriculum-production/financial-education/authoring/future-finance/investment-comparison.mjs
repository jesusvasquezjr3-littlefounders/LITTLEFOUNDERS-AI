import { teach, ex, q, workedFees } from './helpers.mjs';
import { numeric, input, subtract } from '../factory.mjs';
const d = 'investment-comparison';
export const investmentComparison = [
teach(d,1,'After Fees|¿Qué queda tras comisiones?|O que sobra após tarifas?',
  'Quoted gains are not the amount you keep when fees must still be paid.|Las ganancias anunciadas no son lo que conservas si faltan comisiones por pagar.|Ganhos anunciados não são o que fica com você quando ainda faltam tarifas.',
  'A displayed gross gain already accounts for every transaction and ongoing charge.', [
  ex('example-01', 'Start with the gain|Empieza por la ganancia|Comece pelo ganho', 'A gain before costs is gross. Subtract each stated fee once to find the gain left after those costs.|La ganancia antes de costos es bruta. Resta cada comisión indicada una vez para hallar lo que queda tras esos costos.|O ganho antes dos custos é bruto. Subtraia cada tarifa dada uma vez para achar o que sobra desses custos.'),
  workedFees('guided-01', 50, 5, 2, [
    'Gross gain: 50 dollars; trade fee: 5; ongoing fee: 2. Finish the steps.|Gross gain|Subtract trading fee|Subtract ongoing fee|The remaining gain deducts both fees once.|Subtract each fee from the gain, not from each other.',
    'Ganancia bruta: 50 pesos; comisión de operación: 5; de mantenimiento: 2. Completa los pasos.|Ganancia bruta|Resta la comisión de operación|Resta la comisión de mantenimiento|La ganancia restante descuenta ambas comisiones una vez.|Resta cada comisión de la ganancia, no entre sí.',
    'Ganho bruto: 50 reais; tarifa da operação: 5; de manutenção: 2. Complete os passos.|Ganho bruto|Subtraia a tarifa da operação|Subtraia a tarifa de manutenção|O ganho restante desconta ambas as tarifas uma vez.|Subtraia cada tarifa do ganho, não uma da outra.',
  ]),
  q('guided-02', 'guided', [
    'Subtract which charges?|A quoted gain excludes trading and ongoing fees. Both are mandatory for this holding period.|Both fees once~Only the smaller fee~Neither fee|Both stated mandatory charges reduce what the investor keeps.|Count every included-period fee once.',
    '¿Qué cargos restas?|La ganancia anunciada excluye comisiones de operación y mantenimiento. Ambas son obligatorias para este periodo.|Ambas una vez~Solo la menor~Ninguna|Ambos cargos obligatorios reducen lo que conserva quien invierte.|Cuenta una vez cada comisión del periodo.',
    'Quais cobranças subtrair?|O ganho anunciado exclui tarifas de operação e manutenção. Ambas são obrigatórias neste período.|Ambas uma vez~Só a menor~Nenhuma|Ambas as cobranças obrigatórias reduzem o que fica com você.|Conte uma vez cada tarifa do período.',
  ]),
  numeric(q('practice-01', 'practice', [
    'What gain remains?|Gross gain is 80. Trading costs 6; ongoing charges cost 4.|70~76~80|Both fees reduce the gross gain.|Subtract both fees from the gain.',
    '¿Qué ganancia queda?|La ganancia bruta es 80. Operar cuesta 6; mantener cuesta 4.|70~76~80|Ambas comisiones reducen la ganancia bruta.|Resta ambas comisiones de la ganancia.',
    'Qual ganho sobra?|O ganho bruto é 80. Operar custa 6; manter custa 4.|70~76~80|Ambas as tarifas reduzem o ganho bruto.|Subtraia as duas tarifas do ganho.',
  ]), [80, 6, 4], subtract(subtract(input(0), input(1)), input(2))),
  q('practice-02', 'practice', [
    'Deduct again?|The statement explicitly reports a gain after both fees. Someone subtracts those same fees again.|No, they are already included~Yes, every fee must be doubled|Subtracting included fees again counts the same cost twice.|Read whether the figure is before or after costs.',
    '¿Restar otra vez?|El estado indica ganancia después de ambas comisiones. Alguien resta las mismas comisiones otra vez.|No, ya están incluidas~Sí, hay que duplicarlas|Restar comisiones incluidas cuenta dos veces el mismo costo.|Lee si el monto es antes o después de costos.',
    'Subtrair outra vez?|O extrato mostra ganho após ambas as tarifas. Alguém subtrai essas mesmas tarifas de novo.|Não, já estão incluídas~Sim, deve duplicá-las|Subtrair tarifas incluídas conta duas vezes o mesmo custo.|Leia se o valor é antes ou depois dos custos.',
  ]),
  q('practice-03', 'practice', [
    'Can net gain be negative?|The gross gain is smaller than the mandatory fees for the same period.|Yes, fees can exceed the gain~No, any gross gain ensures profit|Costs above the gain leave a negative result.|Compare all costs with the gross gain.',
    '¿La ganancia neta puede ser negativa?|La ganancia bruta es menor que las comisiones obligatorias del mismo periodo.|Sí, pueden superar la ganancia~No, ganar bruto asegura utilidad|Costos mayores que la ganancia dejan un resultado negativo.|Compara todos los costos con la ganancia bruta.',
    'O ganho líquido pode ser negativo?|O ganho bruto é menor que as tarifas obrigatórias do mesmo período.|Sim, podem superar o ganho~Não, ganho bruto assegura lucro|Custos acima do ganho deixam um resultado negativo.|Compare todos os custos com o ganho bruto.',
  ]),
  numeric(q('transfer-01', 'transfer', [
    'What remains after sale costs?|Selling produces a gain of 45 before costs. Exit fee: 8; custody charge: 7.|30~37~45|The sale gain is reduced by both stated costs.|Deduct the exit fee and custody charge once.',
    '¿Qué queda tras los costos de venta?|Vender genera ganancia de 45 antes de costos. Salida: 8; custodia: 7.|30~37~45|Ambos costos indicados reducen la ganancia de venta.|Descuenta salida y custodia una vez.',
    'O que sobra após os custos da venda?|Vender gera ganho de 45 antes dos custos. Saída: 8; custódia: 7.|30~37~45|Ambos os custos dados reduzem o ganho da venda.|Desconte saída e custódia uma vez.',
  ]), [45, 8, 7], subtract(subtract(input(0), input(1)), input(2))),
]),
teach(d,2,'Comparable Returns|Compara el mismo rendimiento|Compare o mesmo rendimento',
  'Two attractive percentages may describe different periods or leave out different payments.|Dos porcentajes atractivos pueden describir periodos distintos u omitir pagos diferentes.|Dois percentuais atraentes podem descrever períodos distintos ou deixar pagamentos diferentes de fora.',
  'Any pair of reported percentages can be ranked without checking dates and distributions.', [
  ex('example-01', 'Align the comparison|Alinea la comparación|Alinhe a comparação', 'One report includes cash payouts; another reports price change alone. Compare the same period and include payouts consistently.|Un reporte incluye pagos en efectivo; otro solo cambios de precio. Compara el mismo periodo y trata igual los pagos.|Um relatório inclui pagamentos; outro mostra só mudança no preço. Compare o mesmo período e trate os pagamentos igualmente.'),
  q('guided-01', 'guided', [
    'What must match?|A return covers one month; another covers one year. Someone ranks the percentages directly.|The comparison period~Only the larger printed number|Different periods do not provide the same return comparison.|Align the start and end dates.',
    '¿Qué debe coincidir?|Un rendimiento cubre un mes; otro, un año. Comparan directamente los porcentajes.|El periodo comparado~Solo el número mayor|Periodos distintos no ofrecen la misma comparación de rendimiento.|Alinea las fechas de inicio y fin.',
    'O que deve coincidir?|Um rendimento cobre um mês; outro, um ano. Comparam os percentuais diretamente.|O período comparado~Só o número maior|Períodos distintos não oferecem a mesma comparação de rendimento.|Alinhe as datas de início e fim.',
  ]),
  q('guided-02', 'guided', [
    'What is inconsistent?|Both reports cover the same dates. Only one includes dividends paid during that period.|Treatment of distributions~The matching dates~Their starting balances|Including payouts in only one report distorts the comparison.|Count the same return components on both sides.',
    '¿Qué es inconsistente?|Ambos reportes cubren iguales fechas. Solo uno incluye dividendos pagados durante ese periodo.|El tratamiento de pagos~Las fechas coincidentes~Sus saldos iniciales|Incluir pagos solo en un reporte distorsiona la comparación.|Cuenta los mismos componentes en ambos lados.',
    'O que está desigual?|Os dois relatórios cobrem as mesmas datas. Só um inclui dividendos pagos no período.|O tratamento dos pagamentos~As datas iguais~Seus saldos iniciais|Incluir pagamentos só num relatório distorce a comparação.|Conte as mesmas partes dos ganhos nos dois lados.',
  ]),
  q('practice-01', 'practice', [
    'Can these be ranked fairly?|Two reports share dates and both include distributions, but only one deducts fees.|Not until costs are treated consistently~Yes, matching dates settle everything|Different fee treatment still makes the reported results unequal.|Align components as well as time.',
    '¿Puedes ordenarlos justamente?|Dos reportes coinciden en fechas y pagos, pero solo uno descuenta comisiones.|No, falta igualar el tratamiento de costos~Sí, bastan fechas iguales|Tratar distinto las comisiones mantiene resultados no comparables.|Alinea componentes además del tiempo.',
    'Pode comparar de forma justa?|Dois relatórios têm datas e pagamentos iguais, mas só um desconta tarifas.|Não, falta tratar custos do mesmo modo~Sim, datas iguais bastam|Tratar tarifas de modo distinto mantém resultados não comparáveis.|Alinhe as partes além do tempo.',
  ]),
  q('practice-02', 'practice', [
    'Which comparison fits?|A learner wants the result for the last calendar year, including cash payouts.|Both reports for that year with payouts~One lifetime chart and one yearly price change|The first pair answers the same period-and-component question.|Use the question’s exact period and included payments.',
    '¿Qué comparación sirve?|Buscan el resultado del último año calendario, incluidos pagos en efectivo.|Ambos reportes de ese año con pagos~Una gráfica histórica y un cambio anual|El primer par responde al mismo periodo y componentes.|Usa el periodo exacto y pagos incluidos de la pregunta.',
    'Qual comparação serve?|Buscam o resultado do último ano civil, incluindo pagamentos em dinheiro.|Ambos desse ano com pagamentos~Um gráfico histórico e uma mudança anual|O primeiro par responde ao mesmo período e às mesmas partes.|Use o período exato e os pagamentos da pergunta.',
  ]),
  q('practice-03', 'practice', [
    'What must be clarified?|One chart says “growth” without saying whether payouts were reinvested.|How payouts were treated~Only the starting price~Nothing, growth is always identical|Reinvestment assumptions can change the reported growth.|Read what the return measure includes.',
    '¿Qué debes aclarar?|Una gráfica dice «crecimiento» sin indicar si se reinvirtieron los pagos.|Cómo trataron los pagos~Solo el precio inicial~Nada, crecer siempre significa lo mismo|Suponer reinversión puede cambiar el crecimiento reportado.|Lee qué incluye la medida de rendimiento.',
    'O que esclarecer?|Um gráfico diz “crescimento” sem dizer se os pagamentos foram reaplicados.|Como trataram os pagamentos~Só o preço inicial~Nada, crescer sempre significa o mesmo|Supor reaplicação pode mudar o crescimento mostrado.|Leia o que a medida de rendimento inclui.',
  ]),
  q('transfer-01', 'transfer', [
    'What needs repair?|For the same year, a property report includes rent; a fund report shows only prices.|Include income consistently~Ignore rent~Compare headings alone|The two reports include different components of investment return.|Keep the same dates and treatment of income.',
    '¿Qué comparación corriges?|Un reporte inmobiliario incluye rentas; uno de fondo solo cambios de precio. Ambos cubren igual año.|Incluir ingresos de forma consistente~Ignorar rentas solo por ser efectivo~Comparar solo títulos|Los reportes incluyen componentes distintos del rendimiento.|Conserva iguales fechas y tratamiento de ingresos.',
    'Qual comparação corrigir?|Um relatório de imóvel inclui aluguéis; um de fundo mostra só preços. Ambos cobrem o mesmo ano.|Incluir rendimentos de modo igual~Ignorar aluguéis só por serem dinheiro~Comparar só os títulos|Os relatórios incluem partes distintas do rendimento.|Mantenha iguais as datas e o tratamento da renda.',
  ]),
]),
teach(d,3,'Chart Omissions|Pregunta qué omite la gráfica|Pergunte o que o gráfico omite',
  'The best past result cannot tell you how bad a different period could have been.|El mejor resultado pasado no dice qué tan malo pudo ser otro periodo.|O melhor resultado passado não conta o quanto outro período poderia ter sido ruim.',
  'A selected best return is enough to judge the full risk of an investment.', [
  ex('example-01', 'Winners are only part|Ganar es solo una parte|Ganhos são só uma parte', 'An ad shows the best year and hides losing years. Ask about losses and the full period before judging risk.|Un anuncio muestra el mejor año y oculta años de pérdidas. Pregunta por pérdidas y el periodo completo antes de juzgar.|Um anúncio mostra o melhor ano e esconde anos de perdas. Pergunte sobre perdas e o período todo antes de avaliar.'),
  q('guided-01', 'guided', [
    'What is missing?|An offer displays only its strongest past month.|Other months, including losses~A bigger version of that number~More praise from the seller|One selected month omits the range of outcomes.|Ask what happened outside the highlighted period.',
    '¿Qué falta?|Una oferta muestra únicamente su mejor mes pasado.|Otros meses, incluidas pérdidas~El mismo número más grande~Más elogios del vendedor|Un mes seleccionado omite la variedad de resultados.|Pregunta qué pasó fuera del periodo destacado.',
    'O que falta?|Uma oferta mostra apenas seu melhor mês passado.|Outros meses, incluindo perdas~O mesmo número maior~Mais elogios do vendedor|Um mês escolhido omite a variedade de resultados.|Pergunte o que ocorreu fora do período destacado.',
  ]),
  q('guided-02', 'guided', [
    'Which question reveals risk?|A seller explains possible gains but says nothing about losing invested money.|How much could be lost, and when?~Which logo looks safest?~How many followers approve?|Loss size and timing matter to the spending goal.|Ask about consequences, not popularity.',
    '¿Qué pregunta revela riesgo?|Un vendedor explica posibles ganancias, pero no habla de perder el dinero invertido.|¿Cuánto se podría perder y cuándo?~¿Qué logotipo parece seguro?~¿Cuántos seguidores aprueban?|El tamaño y momento de pérdidas afectan la meta.|Pregunta por consecuencias, no popularidad.',
    'Qual pergunta revela risco?|Um vendedor explica possíveis ganhos, mas não fala em perder o dinheiro aplicado.|Quanto poderia perder, e quando?~Qual logotipo parece seguro?~Quantos seguidores aprovam?|O tamanho e o momento das perdas afetam a meta.|Pergunte sobre consequências, não popularidade.',
  ]),
  q('practice-01', 'practice', [
    'Does an average settle risk?|An investment’s average return is shown without any information about variation or losses.|No, different paths can share an average~Yes, averages forbid bad years|An average alone hides the path and possible losses.|Ask about the range behind the average.',
    '¿El promedio resuelve el riesgo?|Muestran rendimiento promedio sin información de variación o pérdidas.|No, distintas trayectorias comparten promedio~Sí, promediar impide años malos|Un promedio solo oculta la trayectoria y posibles pérdidas.|Pregunta por la variedad detrás del promedio.',
    'A média resolve o risco?|Mostram rendimento médio sem dados de variação ou perdas.|Não, caminhos distintos têm igual média~Sim, média impede anos ruins|Uma média sozinha esconde o caminho e possíveis perdas.|Pergunte pela variedade por trás da média.',
  ]),
  q('practice-02', 'practice', [
    'Which evidence is stronger?|A promotion shows selected winning clients. Another record includes all outcomes over a stated period.|The complete stated-period record~Only the happiest clients|A complete record avoids selecting only winners.|Check who and which dates were excluded.',
    '¿Qué evidencia es más completa?|Una promoción elige clientes ganadores. Otro registro incluye todos los resultados de un periodo indicado.|El registro completo del periodo~Solo los clientes más felices|Un registro completo evita seleccionar únicamente ganadores.|Revisa quiénes y qué fechas quedaron fuera.',
    'Qual evidência é mais completa?|Uma promoção escolhe clientes vencedores. Outro registro inclui todos os resultados de um período dado.|O registro completo do período~Só os clientes mais felizes|Um registro completo evita escolher apenas vencedores.|Confira quem e quais datas ficaram de fora.',
  ]),
  q('practice-03', 'practice', [
    'What remains uncertain?|A full historical record is available, including losses. Someone says future outcomes are now certain.|The future remains uncertain~History guarantees repetition|Even complete history does not guarantee future results.|Better evidence reduces omissions, not all uncertainty.',
    '¿Qué sigue incierto?|Hay historial completo con pérdidas. Alguien dice que el futuro ya es seguro.|El futuro sigue incierto~El historial garantiza repetición|Ni el historial completo garantiza resultados futuros.|Mejor evidencia reduce omisiones, no toda incertidumbre.',
    'O que continua incerto?|Há histórico completo com perdas. Alguém diz que o futuro agora é certo.|O futuro continua incerto~O histórico garante repetição|Nem o histórico completo garante resultados futuros.|Melhor evidência reduz omissões, não toda incerteza.',
  ]),
  q('transfer-01', 'transfer', [
    'What is missing?|A rental-investment pitch shows rent from fully occupied months and omits vacant months.|Results including vacant periods and costs~Only photos of occupied rooms~The best month repeated|Vacancies can change the result the selected months imply.|Ask for relevant omitted outcomes.',
    '¿Qué debes solicitar?|Una oferta inmobiliaria muestra rentas de meses ocupados y omite meses vacíos.|Resultados con meses vacíos y costos~Solo fotos de habitaciones ocupadas~Repetir el mejor mes|Los meses vacíos pueden cambiar el resultado sugerido.|Pregunta por resultados relevantes omitidos.',
    'O que pedir?|Uma oferta imobiliária mostra aluguéis de meses ocupados e omite meses vazios.|Resultados com meses vazios e custos~Só fotos de quartos ocupados~Repetir o melhor mês|Meses vazios podem mudar o resultado sugerido.|Pergunte por resultados relevantes omitidos.',
  ]),
]),
teach(d,4,'Fund Fit|¿El fondo coincide con la meta?|O fundo combina com a meta?',
  'A fund can follow its own objective perfectly and still be wrong for the exposure you intended.|Un fondo puede cumplir su objetivo y aun así no coincidir con la exposición que buscabas.|Um fundo pode cumprir sua meta e ainda não combinar com o risco que você pretendia assumir.',
  'A fund’s attractive name or successful performance proves it matches the learner’s desired exposure.', [
  ex('example-01', 'Match contents to purpose|Relaciona contenido y propósito|Relacione conteúdo e propósito', 'You want many industries. A fund holds only energy shares, so it does not provide the broad exposure you wanted.|Buscas varias industrias. Un fondo solo tiene acciones energéticas, así que no ofrece la exposición amplia que querías.|Você busca vários setores. Um fundo só tem ações de energia, então não oferece a variedade que você queria.'),
  q('guided-01', 'guided', [
    'Does this match?|The stated goal is broad industry exposure. The fund owns only bank shares.|No, it concentrates in banking~Yes, banks are investments|One industry does not meet the stated broad-exposure goal.|Compare the holdings with the actual goal.',
    '¿Coincide?|La meta indica exposición a varias industrias. El fondo solo posee acciones bancarias.|No, se concentra en bancos~Sí, los bancos son inversiones|Una industria no cumple la meta de exposición amplia.|Compara las inversiones con la meta real.',
    'Combina?|A meta pede vários setores. O fundo só possui ações de bancos.|Não, concentra em bancos~Sim, bancos são investimentos|Um setor não atende à meta de variedade.|Compare os ativos com a meta real.',
  ]),
  q('guided-02', 'guided', [
    'Which record helps?|A learner wants short-term debt exposure. Two funds have unclear names.|Their objectives and holdings~Only the names~Their recent returns|The documents reveal what exposure each fund seeks and holds.|Read beyond the label.',
    '¿Qué registro ayuda?|Buscan exposición a deuda de corto plazo. Dos fondos tienen nombres poco claros.|Sus objetivos e inversiones~Solo los nombres~Sus rendimientos recientes|Los documentos revelan qué exposición busca y tiene cada fondo.|Lee más allá de la etiqueta.',
    'Qual registro ajuda?|Buscam dívida de curto prazo. Dois fundos têm nomes pouco claros.|Suas metas e ativos~Só os nomes~Seus retornos recentes|Os documentos mostram o que cada fundo busca e possui.|Leia além do rótulo.',
  ]),
  q('practice-01', 'practice', [
    'Does a good return fix mismatch?|A learner wants no share exposure. A share fund had excellent recent returns.|No, it still holds shares~Yes, good returns change its holdings|Performance does not change the stated exposure mismatch.|Check what is owned, not just past performance.',
    '¿Ganar resuelve la diferencia?|Una persona no quiere exposición a acciones. Un fondo accionario tuvo ganancias recientes excelentes.|No, sigue teniendo acciones~Sí, ganar cambia sus inversiones|El rendimiento no cambia la exposición incompatible indicada.|Revisa lo que posee, no solo resultados pasados.',
    'Ganhar resolve a diferença?|Uma pessoa não quer ações. Um fundo de ações teve ótimos ganhos recentes.|Não, ainda tem ações~Sim, ganhar muda seus ativos|O rendimento não muda o risco que a pessoa não queria.|Confira o que possui, não só ganhos passados.',
  ]),
  q('practice-02', 'practice', [
    'Which fund fits?|The goal is several countries. A holds one local company; B spans those countries.|B matches the requested scope~A has fewer pages|B’s holdings match the geographic scope requested.|Use holdings to check the requested scope.',
    '¿Qué fondo coincide?|La meta pide empresas de varios países. A tiene una empresa local; B abarca los países indicados.|B coincide con lo pedido~A porque tiene menos páginas|Las inversiones de B coinciden con el alcance geográfico pedido.|Usa las inversiones para revisar el alcance solicitado.',
    'Qual fundo combina?|A meta pede empresas de vários países. A tem uma empresa local; B abrange os países dados.|B combina com o pedido~A por ter menos páginas|Os ativos de B combinam com os países pedidos.|Use os ativos para conferir o alcance pedido.',
  ]),
  q('practice-03', 'practice', [
    'What should be rechecked?|A fund changes its permitted holdings from bonds to mixed bonds and shares.|Whether its exposure still fits~Only its unchanged name|A policy change can alter the exposure being purchased.|Revisit contents when the stated strategy changes.',
    '¿Qué debes volver a revisar?|Un fondo cambia sus inversiones permitidas de bonos a una mezcla de bonos y acciones.|Si la exposición todavía coincide~Solo su nombre sin cambios|Cambiar reglas puede cambiar la exposición comprada.|Revisa el contenido cuando cambie la estrategia indicada.',
    'O que conferir de novo?|Um fundo muda seus ativos permitidos de títulos para títulos e ações.|Se o risco ainda combina~Só seu nome igual|Mudar as regras pode mudar o risco comprado.|Reveja o conteúdo quando mudar a estratégia dada.',
  ]),
  q('transfer-01', 'transfer', [
    'Does the mix fit?|A saver wants local-currency debt. A fund’s name sounds local, but it mainly holds foreign-currency shares.|No, assets and currency differ~Yes, the local name is enough|The holdings differ in both asset type and currency.|Compare the actual mix with both stated constraints.',
    '¿La mezcla real coincide?|Buscan deuda en moneda local. El nombre del fondo parece local, pero contiene sobre todo acciones en moneda extranjera.|No, cambian activos y moneda~Sí, basta el nombre local|Las inversiones difieren en tipo de activo y moneda.|Compara la mezcla real con ambas condiciones.',
    'A composição real combina?|Buscam dívida em moeda local. O nome do fundo parece local, mas predominam ações em moeda estrangeira.|Não, ativos e moeda diferem~Sim, basta o nome local|Os ativos diferem em tipo e moeda.|Compare a composição real com ambas as condições.',
  ]),
]),
teach(d,5,'Index Tracking|Seguir un índice no es prometer|Seguir um índice não é prometer',
  'A strategy explains what a fund tries to follow; it does not promise to outperform or avoid losses.|Una estrategia explica qué intenta seguir un fondo; no promete superar resultados ni evitar pérdidas.|Uma estratégia explica o que um fundo tenta seguir; não promete superar resultados nem evitar perdas.',
  'Index tracking promises to beat the index, avoid losses or match it exactly after costs.', [
  ex('example-01', 'A reference basket|Una canasta de referencia|Uma cesta de referência', 'An index tracks a defined basket. An index fund aims to follow that basket, with fees and tracking differences possible.|Un índice sigue una canasta definida. Un fondo indexado intenta seguirla; puede haber comisiones y diferencias de seguimiento.|Um índice acompanha uma cesta definida. Um fundo de índice tenta segui-la; pode haver tarifas e diferenças de acompanhamento.'),
  q('guided-01', 'guided', [
    'What is the stated aim?|A fund says its strategy is to track a specified index.|Follow that index’s performance~Guarantee beating the index~Guarantee no losses|Tracking aims to follow, not promise superiority.|Read the strategy’s actual objective.',
    '¿Cuál es el objetivo?|Un fondo dice que su estrategia sigue un índice específico.|Seguir el rendimiento del índice~Garantizar superarlo~Garantizar cero pérdidas|Seguir busca aproximarse, no prometer superioridad.|Lee el objetivo real de la estrategia.',
    'Qual é a meta?|Um fundo diz que sua estratégia segue um índice específico.|Seguir o rendimento do índice~Garantir superá-lo~Garantir zero perdas|Seguir busca acompanhar, não prometer superar.|Leia a meta real da estratégia.',
  ]),
  q('guided-02', 'guided', [
    'What if the index falls?|The tracked basket loses market value during a downturn.|The fund can fall too~Tracking prevents any decline|Following a falling basket can include losses.|An index is not a loss-protection policy.',
    '¿Y si cae el índice?|La canasta seguida pierde valor de mercado durante una caída económica.|El fondo también puede caer~Seguir impide cualquier caída|Seguir una canasta que cae puede incluir pérdidas.|Un índice no es protección contra pérdidas.',
    'E se o índice cair?|A cesta seguida perde valor de mercado durante uma crise.|O fundo também pode cair~Seguir impede qualquer queda|Seguir uma cesta que cai pode incluir perdas.|Um índice não é proteção contra perdas.',
  ]),
  q('practice-01', 'practice', [
    'Must results match exactly?|A fund follows an index but charges fees that the index calculation excludes.|No, fees can create a difference~Yes, tracking erases fees|Fees can reduce the fund’s result relative to its index.|Compare the fund’s costs with the reference calculation.',
    '¿Deben coincidir exactamente?|Un fondo sigue un índice, pero cobra comisiones excluidas del cálculo del índice.|No, comisiones pueden crear diferencias~Sí, seguir elimina comisiones|Las comisiones pueden reducir el resultado frente al índice.|Compara costos del fondo con el cálculo de referencia.',
    'Devem coincidir exatamente?|Um fundo segue um índice, mas cobra tarifas que o cálculo do índice não inclui.|Não, tarifas podem criar diferenças~Sim, seguir apaga tarifas|Tarifas podem reduzir o resultado diante do índice.|Compare custos do fundo com o cálculo de referência.',
  ]),
  q('practice-02', 'practice', [
    'Is every index broad?|A fund tracks an index containing only companies in one narrow industry.|No, this index is concentrated~Yes, index means all industries|The selected index determines the exposure being followed.|Inspect the basket before assuming diversification.',
    '¿Todo índice es amplio?|Un fondo sigue un índice formado solo por empresas de una industria específica.|No, este índice está concentrado~Sí, índice significa todas las industrias|El índice elegido determina la exposición seguida.|Inspecciona la canasta antes de suponer diversificación.',
    'Todo índice é amplo?|Um fundo segue um índice só com empresas de um setor específico.|Não, esse índice é concentrado~Sim, índice significa todos os setores|O índice escolhido define o risco seguido.|Veja a cesta antes de supor variedade.',
  ]),
  q('practice-03', 'practice', [
    'Which claim exceeds the strategy?|An ad says its index fund follows a basket and therefore always beats that basket.|Always beating the basket~Following a stated basket|Tracking alone cannot support a promise of always outperforming.|Separate the strategy from the extra advertising promise.',
    '¿Qué afirmación excede la estrategia?|Un anuncio dice que su fondo sigue una canasta y por eso siempre la supera.|Superar siempre la canasta~Seguir una canasta indicada|Seguir no respalda prometer que siempre superará resultados.|Distingue estrategia de promesa publicitaria adicional.',
    'Qual afirmação excede a estratégia?|Um anúncio diz que seu fundo segue uma cesta e por isso sempre a supera.|Sempre superar a cesta~Seguir uma cesta dada|Seguir não sustenta prometer que sempre superará resultados.|Separe estratégia de promessa extra do anúncio.',
  ]),
  q('transfer-01', 'transfer', [
    'What needs checking?|Two index funds follow different baskets: local bonds and global shares.|Which basket fits the goal~Which prints index larger~Both must have equal risk|The tracked baskets create different underlying exposures.|The common strategy label does not make holdings identical.',
    '¿Qué debes aclarar?|Dos fondos indexados siguen canastas distintas: bonos locales y acciones mundiales.|Qué canasta coincide con la exposición buscada~Cuál escribe índice más grande~Ambos deben tener igual riesgo|Las canastas seguidas crean exposiciones subyacentes distintas.|Compartir estrategia no vuelve iguales sus inversiones.',
    'O que esclarecer?|Dois fundos de índice seguem cestas distintas: títulos locais e ações mundiais.|Qual cesta combina com o risco buscado~Qual escreve índice maior~Ambos devem ter risco igual|As cestas seguidas criam riscos subjacentes diferentes.|O nome comum da estratégia não torna os ativos iguais.',
  ]),
]),
teach(d,6,'Currency Exposure|La meta tiene moneda|A meta tem uma moeda',
  'An unchanged foreign balance can buy a different amount of the currency needed for your goal.|Un saldo extranjero sin cambios puede comprar distinta cantidad de la moneda que necesita tu meta.|Um saldo estrangeiro sem mudança pode comprar outra quantia da moeda necessária para sua meta.',
  'An unchanged balance in the investment currency guarantees an unchanged amount in the spending currency.', [
  ex('example-01', 'Two moving parts|Dos partes que cambian|Duas partes que mudam', 'A foreign balance stays unchanged. A worse conversion rate can leave less money for the same local bill.|Una inversión extranjera no cambia en su moneda. Un cambio menos favorable puede reducir el dinero para tu cuenta local.|Uma aplicação estrangeira não muda na própria moeda. Um câmbio pior pode reduzir o dinheiro para sua conta local.'),
  q('guided-01', 'guided', [
    'What can change?|Foreign units stay unchanged. Each now converts into fewer units of the bill’s currency.|The amount available for the bill~Nothing, foreign units are unchanged|The conversion now provides fewer spending-currency units.|Follow the currency the bill actually requires.',
    '¿Qué puede cambiar?|Las unidades extranjeras no cambian. Cada una se convierte ahora en menos unidades de la moneda de pago.|El monto disponible para pagar~Nada, las unidades extranjeras siguen iguales|La conversión entrega menos unidades de la moneda necesaria.|Sigue la moneda que exige la cuenta.',
    'O que pode mudar?|As unidades estrangeiras não mudam. Cada uma agora vira menos unidades da moeda da conta.|O valor disponível para pagar~Nada, as unidades estrangeiras são iguais|A conversão entrega menos unidades da moeda necessária.|Siga a moeda exigida pela conta.',
  ]),
  q('guided-02', 'guided', [
    'Which changes matter?|A foreign asset changes price before conversion into the currency used for the goal.|Asset value and exchange rate~Only the asset’s foreign price~Only the account name|Both asset performance and conversion can affect the spending result.|Track the investment and the currency conversion separately.',
    '¿Qué dos cambios importan?|Un activo extranjero cambia de precio antes de convertirse a la moneda de la meta.|Valor del activo y tipo de cambio~Solo su precio extranjero~Solo el nombre de cuenta|Activo y conversión pueden afectar el resultado para gastar.|Sigue la inversión y la conversión por separado.',
    'Quais duas mudanças importam?|Um ativo estrangeiro muda de preço antes da conversão para a moeda da meta.|Valor do ativo e câmbio~Só seu preço estrangeiro~Só o nome da conta|Ativo e conversão podem afetar o resultado para gastar.|Siga a aplicação e a conversão separadamente.',
  ]),
  q('practice-01', 'practice', [
    'Does foreign gain settle it?|An asset gains abroad, but conversion moves against the spending currency.|No, check the combined result~Yes, foreign gains guarantee local gains|The exchange-rate effect can offset an asset gain.|Evaluate the result in the goal’s currency.',
    '¿Basta ganar en moneda extranjera?|El activo gana en moneda extranjera, pero el cambio se vuelve desfavorable para la moneda de pago.|No, falta revisar el resultado combinado~Sí, ganar afuera garantiza más dinero local|El efecto del cambio puede compensar la ganancia del activo.|Evalúa el resultado en la moneda de la meta.',
    'Basta ganhar em moeda estrangeira?|O ativo ganha em moeda estrangeira, mas o câmbio fica pior para a moeda da conta.|Não, falta conferir o resultado conjunto~Sim, ganhar fora garante mais dinheiro local|O efeito do câmbio pode anular o ganho do ativo.|Avalie o resultado na moeda da meta.',
  ]),
  q('practice-02', 'practice', [
    'Which currency is relevant?|The goal is tuition priced in another country’s currency, not local household spending.|The tuition currency~Always the account display currency|The obligation’s currency defines the conversion need.|Start from the payment the money must fund.',
    '¿Qué moneda importa?|La meta es colegiatura fijada en moneda de otro país, no gasto local del hogar.|La moneda de la colegiatura~Siempre la moneda mostrada en cuenta|La moneda de la obligación define la necesidad de conversión.|Empieza por el pago que ese dinero cubrirá.',
    'Qual moeda importa?|A meta é mensalidade fixada na moeda de outro país, não gasto local da casa.|A moeda da mensalidade~Sempre a moeda exibida na conta|A moeda da obrigação define a necessidade de conversão.|Comece pelo pagamento que esse dinheiro vai cobrir.',
  ]),
  q('practice-03', 'practice', [
    'Which claim is unsupported?|A seller says holding foreign currency automatically removes every financial risk.|The claim of removing every risk~That currencies can be exchanged|Changing currencies introduces a different exposure, not universal safety.|Compare the currency with the actual spending need.',
    '¿Qué afirmación no se sostiene?|Un vendedor dice que tener moneda extranjera elimina automáticamente todo riesgo financiero.|Que elimine todo riesgo~Que las monedas se puedan cambiar|Cambiar monedas crea otra exposición, no seguridad universal.|Compara la moneda con la necesidad real de gasto.',
    'Qual afirmação não se sustenta?|Um vendedor diz que ter moeda estrangeira elimina todo risco financeiro.|Que elimina todo risco~Que moedas podem ser trocadas|Trocar moedas cria outro risco, não segurança universal.|Compare a moeda com a necessidade real do gasto.',
  ]),
  q('transfer-01', 'transfer', [
    'Why a larger gap?|An overseas bill stays fixed. Household currency now buys fewer foreign units.|More household currency is needed~The repair necessarily rose~Exchange cannot matter|The same foreign bill now costs more household currency.|Track the currency needed to settle the bill.',
    '¿Por qué creció el faltante?|Una reparación extranjera conserva su precio. La moneda del hogar compra menos unidades de esa moneda.|Se necesita más moneda del hogar~La reparación necesariamente subió~El cambio no puede importar|La misma cuenta extranjera ahora cuesta más moneda del hogar.|Sigue la moneda necesaria para liquidar la cuenta.',
    'Por que a falta cresceu?|Um conserto no exterior mantém seu preço. A moeda da casa compra menos unidades daquela moeda.|Precisa de mais moeda da casa~O conserto necessariamente encareceu~O câmbio não pode importar|A mesma conta estrangeira agora custa mais moeda da casa.|Siga a moeda necessária para pagar a conta.',
  ]),
]),
teach(d,7,'Sales Incentives|¿Quién gana con la venta?|Quem ganha com a venda?',
  'A seller’s pay can create an incentive that differs from your financial goal.|El pago de un vendedor puede crear un incentivo distinto de tu meta financiera.|O pagamento do vendedor pode criar um incentivo diferente da sua meta financeira.',
  'A recommendation is impartial simply because it sounds confident or comes from a friendly person.', [
  ex('example-01', 'Follow the payment|Sigue el pago|Siga o pagamento', 'A seller earns more from one product than another. Ask how they are paid before treating their recommendation as neutral.|Un vendedor gana más con un producto que con otro. Pregunta cómo le pagan antes de considerar neutral su recomendación.|Um vendedor ganha mais com um produto que com outro. Pergunte como recebe antes de tratar a sugestão como neutra.'),
  q('guided-01', 'guided', [
    'Which incentive exists?|A seller receives a bonus only when customers buy Fund A.|An incentive to promote A~Proof A is best for everyone~Proof every statement is false|The bonus rewards selling A regardless of the customer’s outcome.|Identify the incentive without assuming every claim is false.',
    '¿Qué incentivo existe?|Un vendedor recibe un bono solo cuando compran el Fondo A.|Incentivo para promover A~Prueba de que A conviene a todos~Prueba de que todo es falso|El bono premia vender A, sin asegurar el resultado del cliente.|Identifica el incentivo sin suponer falsa toda afirmación.',
    'Qual incentivo existe?|Um vendedor recebe bônus só quando compram o Fundo A.|Incentivo para promover A~Prova de que A serve para todos~Prova de que tudo é falso|O bônus premia vender A, sem garantir resultado ao cliente.|Identifique o incentivo sem supor falsa toda afirmação.',
  ]),
  q('guided-02', 'guided', [
    'Ask what?|Two investments look similar. The adviser strongly favors one without explaining compensation.|How are you paid for each option?~Which performed best last year?~What minimum deposit is required?|Different compensation can help explain a sales preference.|Ask about payment and incentives directly.',
    '¿Qué pregunta ayuda?|Dos inversiones parecen similares. Favorecen una sin explicar la remuneración.|¿Cómo te pagan por cada opción?~¿Cuál rindió más el año pasado?~¿Qué depósito mínimo exige?|Pagos distintos pueden explicar una preferencia de venta.|Pregunta directamente por pago e incentivos.',
    'Qual pergunta ajuda?|Duas aplicações parecem similares. Favorecem uma sem explicar a remuneração.|Como recebe por cada opção?~Qual rendeu mais no ano passado?~Qual é o depósito mínimo?|Pagamentos distintos podem explicar uma preferência de venda.|Pergunte diretamente sobre pagamento e incentivos.',
  ]),
  q('practice-01', 'practice', [
    'Does disclosure remove the conflict?|A seller clearly discloses a commission that rises with the purchase amount.|No, the incentive still exists~Yes, naming it cancels it|Disclosure explains an incentive; it does not erase it.|Use the disclosure when evaluating the proposal.',
    '¿Revelarlo elimina el conflicto?|Un vendedor informa una comisión que aumenta con el monto comprado.|No, el incentivo sigue existiendo~Sí, nombrarlo lo cancela|Informar explica un incentivo; no lo borra.|Usa esa información al evaluar la propuesta.',
    'Informar elimina o conflito?|Um vendedor informa uma comissão que cresce com o valor comprado.|Não, o incentivo continua~Sim, dar nome o cancela|Informar explica um incentivo; não o apaga.|Use essa informação ao avaliar a proposta.',
  ]),
  q('practice-02', 'practice', [
    'What can this fee encourage?|A service earns a fee whenever a customer makes another trade.|More frequent trading~Guaranteed better customer returns|Per-trade payment can reward activity rather than useful outcomes.|Compare the incentive with the customer’s goal.',
    '¿Qué puede incentivar el cobro?|Un servicio gana una comisión cada vez que el cliente opera otra vez.|Operar más seguido~Garantizar mejores rendimientos del cliente|Cobrar por operación puede premiar actividad, no resultados útiles.|Compara el incentivo con la meta del cliente.',
    'O que a cobrança pode incentivar?|Um serviço recebe tarifa toda vez que o cliente faz outra operação.|Operar mais vezes~Garantir melhores ganhos ao cliente|Cobrar por operação pode premiar atividade, não resultados úteis.|Compare o incentivo com a meta do cliente.',
  ]),
  q('practice-03', 'practice', [
    'What next?|A pay conflict is disclosed. The learner still needs to evaluate the investment.|Costs, risks and goal fit~Only the seller’s friendliness~Disclosure approves everything|Knowing the incentive does not replace evaluating the product.|Check the offer’s actual conditions independently.',
    '¿Qué comparas después?|Se revela un conflicto de remuneración. Todavía necesitas evaluar la inversión.|Costos, riesgos y ajuste a la meta~Solo la amabilidad~Nada, informar aprueba la compra|Conocer el incentivo no sustituye evaluar el producto.|Revisa independientemente las condiciones reales de la oferta.',
    'O que comparar depois?|Revelam um conflito de remuneração. Ainda é preciso avaliar a aplicação.|Custos, riscos e ajuste à meta~Só a simpatia~Nada, informar aprova a compra|Conhecer o incentivo não substitui avaliar o produto.|Confira de forma independente as condições reais da oferta.',
  ]),
  q('transfer-01', 'transfer', [
    'Which hidden incentive matters?|A popular educator receives payment for every account opened through a private referral link.|Payment for successful referrals~The number of lessons posted~The educator’s own portfolio|Referral payments can influence which provider gets promoted.|Check financial incentives behind apparently educational promotion.',
    '¿Qué incentivo oculto importa?|Una persona que enseña recibe dinero por cada cuenta abierta mediante su enlace de referencia.|El pago por referencias exitosas~Cuántas lecciones publica~Su cartera personal|Los pagos por referir pueden influir en qué proveedor promueve.|Revisa incentivos financieros tras una promoción aparentemente educativa.',
    'Qual incentivo oculto importa?|Uma pessoa que ensina recebe por cada conta aberta pelo seu link de indicação.|O pagamento por indicações bem-sucedidas~Quantas aulas publica~Sua carteira pessoal|Pagamentos por indicar podem influenciar qual prestador promove.|Confira incentivos financeiros por trás de uma promoção educativa.',
  ]),
]),
teach(d,8,'Restore Allocation|Regresa a la mezcla elegida|Volte à composição escolhida',
  'A portfolio change can restore a plan or abandon it to chase yesterday’s winner.|Un cambio puede recuperar el plan de cartera o abandonarlo para perseguir al ganador de ayer.|Uma mudança pode retomar o plano da carteira ou abandoná-lo para seguir o vencedor de ontem.',
  'Buying more of the recent winner is always the same as restoring the chosen allocation.', [
  ex('example-01', 'Compare target and current|Compara meta y estado actual|Compare meta e estado atual', 'A plan splits money equally between two groups. One grows larger; restoring equal shares differs from buying more of it.|Un plan divide el dinero por igual entre dos grupos. Uno crece más; recuperar mitades difiere de comprar más de ese.|Um plano divide o dinheiro em dois grupos iguais. Um cresce mais; retomar metades difere de comprar mais dele.'),
  q('guided-01', 'guided', [
    'Which direction restores the plan?|Target: equal shares in A and B. A now exceeds half; B is below half.|Reduce A’s share relative to B~Increase A because it rose|The target calls for less relative weight in A.|Compare the current mix with the stated target.',
    '¿Qué dirección recupera el plan?|Meta: partes iguales en A y B. A supera la mitad; B queda debajo.|Reducir A respecto a B~Aumentar A porque subió|La meta requiere menor peso relativo de A.|Compara la mezcla actual con la meta indicada.',
    'Qual direção retoma o plano?|Meta: partes iguais em A e B. A passa da metade; B fica abaixo.|Reduzir A em relação a B~Aumentar A porque subiu|A meta pede menor peso relativo de A.|Compare a composição atual com a meta dada.',
  ]),
  q('guided-02', 'guided', [
    'What is being followed?|An investor increases an already overweight holding solely because it topped last month’s chart.|Recent performance, not the target~The original target automatically|Adding to an overweight holding moves farther from the target.|Identify the reason for the change.',
    '¿Qué está siguiendo?|Aumentan una inversión ya sobreponderada solo porque encabezó la gráfica del mes pasado.|El rendimiento reciente, no la meta~Automáticamente la meta original|Agregar a una parte excesiva aleja más de la meta.|Identifica el motivo del cambio.',
    'O que está seguindo?|Aumentam um ativo já acima do peso da meta só porque liderou o gráfico passado.|O ganho recente, não a meta~A meta original automaticamente|Adicionar a uma parte excessiva afasta mais da meta.|Identifique o motivo da mudança.',
  ]),
  q('practice-01', 'practice', [
    'Which action fits this rule?|Target shares are unchanged. New contributions may be directed to the group below its target.|Add to the underweight group~Add only to the latest winner|The stated rule uses new money to restore the mix.|Follow the target rather than the ranking.',
    '¿Qué acción cumple la regla?|Las proporciones meta no cambian. Pueden dirigir aportaciones nuevas al grupo debajo de su meta.|Aportar al grupo insuficiente~Aportar solo al último ganador|La regla usa dinero nuevo para recuperar la mezcla.|Sigue la meta en lugar de la clasificación.',
    'Qual ação cumpre a regra?|Os pesos da meta não mudam. Novos aportes podem ir ao grupo abaixo da meta.|Aportar ao grupo insuficiente~Aportar só ao último vencedor|A regra usa dinheiro novo para retomar a composição.|Siga a meta em vez da classificação.',
  ]),
  q('practice-02', 'practice', [
    'What should be checked?|A proposed rebalance restores target weights but incurs trading fees and possible taxes.|Those costs before acting~Only whether the weights match~Assume all changes are free|Restoring weights can still create costs.|Compare the intended adjustment with its actual charges.',
    '¿Qué debes revisar?|Un ajuste recupera las proporciones meta, pero genera comisiones y posibles impuestos.|Esos costos antes de actuar~Solo si coinciden proporciones~Suponer que cambiar es gratis|Recuperar proporciones todavía puede generar costos.|Compara el ajuste buscado con sus cargos reales.',
    'O que conferir?|Um ajuste retoma os pesos da meta, mas gera tarifas e possíveis impostos.|Esses custos antes de agir~Só se os pesos coincidem~Supor que mudar é grátis|Retomar pesos ainda pode gerar custos.|Compare o ajuste desejado com suas cobranças reais.',
  ]),
  q('practice-03', 'practice', [
    'Must the old target last forever?|A major goal change alters the investor’s time horizon and loss capacity.|No, reassess the target deliberately~Yes, no target can ever change|A changed goal can justify reviewing the planned mix.|Separate a reasoned plan change from chasing recent prices.',
    '¿La meta anterior dura siempre?|Cambiar una meta importante modifica plazo y capacidad para perder.|No, reevalúa deliberadamente la mezcla~Sí, ninguna meta puede cambiar|Una meta distinta puede justificar revisar la mezcla planeada.|Distingue revisar razonadamente de perseguir precios recientes.',
    'A meta antiga dura sempre?|Mudar uma meta importante altera prazo e capacidade de perder.|Não, reavalie a composição com critério~Sim, nenhuma meta pode mudar|Uma meta distinta pode justificar rever a composição planejada.|Separe rever com critério de seguir preços recentes.',
  ]),
  q('transfer-01', 'transfer', [
    'Which restores the plan?|Target: mostly A, less B. B exceeds its target; the goal is unchanged.|Reduce B’s relative weight~Double the recent winner B~Ignore the target|Reducing B’s excess moves toward the unchanged target.|Use the stated mix, not a universal equal split.',
    '¿Qué propuesta recupera el plan?|Meta: mayoría A y menor parte B. B supera su meta; el objetivo no cambia.|Reducir el peso relativo de B~Duplicar B porque ganó~Ignorar por completo la meta|Reducir el exceso de B acerca a la meta vigente.|Usa la mezcla indicada, no mitades universales.',
    'Qual proposta retoma o plano?|Meta: maior parte A e menor B. B passa da meta; o objetivo não muda.|Reduzir o peso relativo de B~Dobrar B porque ganhou~Ignorar toda a meta|Reduzir o excesso de B aproxima da meta atual.|Use a composição dada, não metades universais.',
  ]),
]),
teach(d,9,'Keepable Returns|Compara lo que conservas|Compare o que fica com você',
  'A fair net comparison uses the same costs, tax assumptions and access conditions.|Una comparación neta justa usa los mismos costos, supuestos de impuestos y condiciones de acceso.|Uma comparação líquida justa usa os mesmos custos, hipóteses de impostos e condições de acesso.',
  'A bigger headline return always means more money available for the learner’s goal.', [
  ex('example-01', 'Find the missing assumption|Busca el supuesto faltante|Ache a hipótese que falta', 'One offer shows returns before tax and fees; another deducts them. Align the assumptions before comparing what remains.|Una oferta muestra rendimientos antes de impuestos y comisiones; otra los descuenta. Iguala supuestos antes de comparar lo restante.|Uma oferta mostra ganhos antes de impostos e tarifas; outra os desconta. Iguale hipóteses antes de comparar o que sobra.'),
  q('guided-01', 'guided', [
    'What prevents comparison?|Both returns cover the same period, but only one deducts required account fees.|Unequal fee treatment~The matching dates~The account names|One figure includes a cost the other still omits.|Compare both after the same relevant charges.',
    '¿Qué impide comparar?|Ambos rendimientos cubren igual periodo, pero solo uno descuenta comisiones obligatorias de cuenta.|El trato desigual de comisiones~Las fechas coincidentes~Los nombres de cuenta|Un monto incluye un costo que el otro omite.|Compara ambos tras los cargos relevantes equivalentes.',
    'O que impede comparar?|Ambos os ganhos cobrem igual período, mas só um desconta tarifas obrigatórias da conta.|O trato desigual das tarifas~As datas iguais~Os nomes das contas|Um valor inclui um custo que o outro omite.|Compare ambos após cobranças relevantes iguais.',
  ]),
  q('guided-02', 'guided', [
    'Which assumption is missing?|An offer labels its figure “after tax” without stating whose tax situation it assumes.|The applicable tax assumptions~Only the investment term~Assume everyone owes the same|An after-tax figure depends on its stated tax assumptions.|Do not import an unstated person’s tax situation.',
    '¿Qué supuesto falta?|Una oferta dice «después de impuestos» sin indicar qué situación fiscal supone.|Los supuestos fiscales aplicados~Solo el plazo de inversión~Suponer impuestos iguales para todos|Un monto neto depende de los supuestos fiscales indicados.|No importes una situación fiscal sin conocerla.',
    'Qual hipótese falta?|Uma oferta diz “após impostos” sem dizer qual situação fiscal supõe.|As hipóteses fiscais usadas~Só o prazo do investimento~Supor impostos iguais para todos|Um valor líquido depende das hipóteses fiscais dadas.|Não importe uma situação fiscal sem conhecê-la.',
  ]),
  q('practice-01', 'practice', [
    'Which cost matters?|The goal needs cash early. An offer’s net figure assumes waiting until maturity, avoiding its early-exit fee.|The actual early-exit fee~Only the no-fee figure|The comparison must use the learner’s actual withdrawal timing.|Check costs under the intended use.',
    '¿Qué costo de retiro importa?|La meta necesita efectivo antes. Una cifra neta supone mantener hasta vencimiento, evitando comisión de salida anticipada.|La comisión de la salida real~Solo la cifra sin comisión al vencimiento|La comparación debe usar el momento real del retiro.|Revisa costos bajo el uso previsto.',
    'Qual custo de saque importa?|A meta precisa de dinheiro antes. Um valor líquido supõe esperar o vencimento, sem tarifa de saída antecipada.|A tarifa da saída real~Só o valor sem tarifa no vencimento|A comparação deve usar o prazo real do saque.|Confira custos no uso previsto.',
  ]),
  q('practice-02', 'practice', [
    'Is an unknown fee zero?|A comparison omits a mandatory custody fee because its amount is unavailable.|No, the comparison is incomplete~Yes, absent means free|A missing price does not establish zero cost.|Obtain the missing mandatory charge.',
    '¿Una comisión desconocida es cero?|Omiten una comisión obligatoria de custodia porque no conocen su monto.|No, la comparación está incompleta~Sí, ausente significa gratis|Un precio faltante no establece costo cero.|Obtén el cargo obligatorio faltante.',
    'Tarifa desconhecida é zero?|Omitem uma tarifa obrigatória de custódia porque não sabem seu valor.|Não, a comparação está incompleta~Sim, ausente significa grátis|Um preço ausente não estabelece custo zero.|Obtenha a cobrança obrigatória que falta.',
  ]),
  q('practice-03', 'practice', [
    'Can assumptions travel unchanged?|A net-return example uses another country’s tax rules for a different account type.|No, verify the applicable local rules~Yes, every net return is universal|Different markets and account rules can change the net amount.|Use the rules relevant to the actual case.',
    '¿Los supuestos sirven sin cambios?|Un ejemplo neto usa reglas fiscales de otro país y otro tipo de cuenta.|No, verifica las reglas locales aplicables~Sí, todo rendimiento neto es universal|Mercados y cuentas distintos pueden cambiar el monto neto.|Usa las reglas pertinentes al caso real.',
    'As hipóteses servem sem mudança?|Um exemplo líquido usa regras fiscais de outro país e outro tipo de conta.|Não, confira as regras locais aplicáveis~Sim, todo ganho líquido é universal|Mercados e contas distintos podem mudar o valor líquido.|Use as regras pertinentes ao caso real.',
  ]),
  q('transfer-01', 'transfer', [
    'What needs correction?|A long-term offer deducts costs. A short-exit quote omits a mandatory penalty and tax assumption.|Complete short-exit assumptions~Rank printed gains~Omitted charges vanish|The short-exit quote is missing conditions affecting available money.|Compare amounts under the same actual-use assumptions.',
    '¿Qué comparación corriges?|Una oferta larga descuenta costos. Una salida corta omite penalización obligatoria y supuesto fiscal.|Completar supuestos de la salida corta~Ordenar solo ganancias impresas~Suponer que cargos omitidos desaparecen|La salida corta omite condiciones que afectan el dinero disponible.|Compara bajo los mismos supuestos de uso real.',
    'Qual comparação corrigir?|Uma oferta longa desconta custos. Uma saída curta omite multa obrigatória e hipótese fiscal.|Completar hipóteses da saída curta~Ordenar só ganhos impressos~Supor que cobranças omitidas somem|A saída curta omite condições que afetam o dinheiro disponível.|Compare sob as mesmas hipóteses de uso real.',
  ]),
]),
teach(d,10,'Verify Claims|Verifica la promesa de rendimiento|Confira a promessa de rendimento',
  'A promise can look official while leaving no independent way to verify who pays or why.|Una promesa puede parecer oficial sin permitir verificar independientemente quién paga ni por qué.|Uma promessa pode parecer oficial sem permitir verificar de forma independente quem paga ou por quê.',
  'A badge, referral or screenshot makes an implausible guaranteed-return promise trustworthy.', [
  ex('example-01', 'Pause and verify|Pausa y verifica|Pare e confira', 'An offer promises unusually high guaranteed returns. Pause payment and verify the provider and claim through independent official information.|Una oferta promete rendimientos altos garantizados. Pausa el pago y verifica al proveedor y la promesa mediante información oficial independiente.|Uma oferta promete ganhos altos garantidos. Pause o pagamento e confira o prestador e a promessa em fontes oficiais independentes.'),
  q('guided-01', 'guided', [
    'What next?|A message claims huge guaranteed gains and requests payment through its own link.|Verify independently first~Use only its link~Pay to unlock proof|A seller-controlled link cannot independently verify the seller.|Use an official source reached independently.',
    '¿Qué sigue?|Un mensaje de inversión promete enormes ganancias garantizadas y pide pagar mediante su enlace.|Verificar independientemente antes de pagar~Usar solo su enlace para comprobar~Pagar para desbloquear pruebas|Un enlace controlado por quien vende no lo verifica independientemente.|Usa una fuente oficial por una ruta independiente.',
    'O que fazer agora?|Uma mensagem promete ganhos enormes garantidos e pede pagar pelo próprio link.|Conferir de forma independente antes de pagar~Usar só seu link para conferir~Pagar para liberar provas|Um link do vendedor não o verifica de forma independente.|Use uma fonte oficial por um caminho independente.',
  ]),
  q('guided-02', 'guided', [
    'Does a badge prove the claim?|An offer displays a regulator’s logo but no independently verifiable registration details.|No, verify identity and permitted activity~Yes, any logo proves returns|A copied logo does not establish authorization or performance.|Check the actual official register.',
    '¿Un sello demuestra la promesa?|Una oferta muestra un logotipo regulatorio, sin datos de registro verificables independientemente.|No, verifica identidad y actividad permitida~Sí, cualquier logotipo prueba rendimientos|Copiar un logotipo no establece autorización ni rendimiento.|Consulta el registro oficial real.',
    'Um selo comprova a promessa?|Uma oferta mostra logotipo regulatório, sem dados de registro verificáveis de forma independente.|Não, confira identidade e atividade permitida~Sim, qualquer logotipo prova rendimento|Copiar logotipo não estabelece autorização nem rendimento.|Consulte o registro oficial real.',
  ]),
  q('practice-01', 'practice', [
    'What does one payout prove?|A friend received an early payment. The scheme’s business and obligations remain unverifiable.|Only that payment occurred~Future payments are guaranteed~Everyone’s capital is safe|One payment does not validate the scheme’s future obligations.|Ask where future payments and repayment would come from.',
    '¿Qué demuestra el cobro de un amigo?|Un amigo recibió un pago inicial. El negocio y las obligaciones del esquema siguen sin verificarse.|Solo que ocurrió ese pago~Que pagos futuros están garantizados~Que todo capital está seguro|Un pago no valida las obligaciones futuras del esquema.|Pregunta de dónde vendrán pagos y devolución futuros.',
    'O que prova o pagamento ao amigo?|Um amigo recebeu um pagamento inicial. O negócio e os deveres do esquema seguem sem prova.|Só que aquele pagamento ocorreu~Que pagamentos futuros são garantidos~Que todo capital está seguro|Um pagamento não valida os deveres futuros do esquema.|Pergunte de onde virão pagamentos e devolução futuros.',
  ]),
  q('practice-02', 'practice', [
    'Which response fits?|The official register contradicts the provider’s claimed identity. The seller demands immediate payment.|Stop and verify independently~Let urgency replace verification~Send a test payment|An unresolved identity mismatch is not cured by urgency.|Do not pay to settle an identity question.',
    '¿Qué respuesta corresponde?|El registro oficial no coincide con la identidad declarada. El vendedor exige pago inmediato.|Detenerse y aclararlo independientemente~Sustituir verificación por urgencia~Enviar un pago pequeño de prueba|La urgencia no resuelve una identidad que no coincide.|No pagues para resolver una duda de identidad.',
    'Qual resposta cabe?|O registro oficial não bate com a identidade declarada. O vendedor exige pagamento imediato.|Parar e esclarecer de forma independente~Trocar verificação por urgência~Enviar pagamento pequeno de teste|A urgência não resolve uma identidade que não confere.|Não pague para resolver uma dúvida de identidade.',
  ]),
  q('practice-03', 'practice', [
    'What remains after identity checks?|A firm exists, but its ad claims exceptional guaranteed returns without documented backing.|The claim still needs verification~Every claim is approved|A real firm’s existence does not validate an unsupported promise.|Verify the specific offer, not just the company.',
    '¿Qué queda tras verificar identidad?|La empresa existe, pero el rendimiento excepcional garantizado carece de respaldo documentado.|Todavía debes verificar la promesa~Todas las afirmaciones quedan aprobadas|Que exista una empresa no valida una promesa sin respaldo.|Verifica la oferta específica, no solo la empresa.',
    'O que resta após conferir identidade?|A empresa existe, mas o ganho excepcional garantido não tem respaldo documentado.|Ainda deve verificar a promessa~Todas as afirmações ficam aprovadas|Uma empresa existir não valida uma promessa sem respaldo.|Confira a oferta específica, não só a empresa.',
  ]),
  q('transfer-01', 'transfer', [
    'Which check is independent?|A chat sends a return certificate and a number to confirm it.|Find the official contact separately~Call only that number~Trust the certificate’s design|Independent contact avoids relying entirely on the sender’s controlled channels.|Reach the authority through your own verified route.',
    '¿Qué verificación es independiente?|Un chat privado envía un certificado atractivo de rendimiento y un teléfono para confirmarlo.|Buscar aparte el contacto oficial pertinente~Llamar solo al número enviado~Confiar en el diseño|El contacto independiente evita depender de canales controlados por quien envía.|Llega a la autoridad por tu propia ruta verificada.',
    'Qual verificação é independente?|Um chat privado envia um belo certificado de rendimento e um telefone para confirmá-lo.|Buscar à parte o contato oficial pertinente~Ligar só para o número enviado~Confiar no desenho|O contato independente evita depender dos canais de quem envia.|Chegue à autoridade por seu próprio caminho verificado.',
  ]),
]),
];
