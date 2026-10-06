import { q } from './helpers.mjs';
import { numeric, input, subtract } from '../factory.mjs';
const id = n => `fe-production-investment-comparison-${String(n).padStart(2, '0')}`;
const income = 'fe-production-investing-foundations-04';
export const comparisonReviews = [{
  id: 'fe-production-investment-comparison-review-1', primary: id(1),
  title:'Investment Comparisons|Lee la comparación completa|Leia a comparação completa',
  relevance: 'Check what the figures include before deciding what an investment comparison says.|Revisa qué incluyen las cifras antes de interpretar una comparación de inversiones.|Confira o que os números incluem antes de interpretar uma comparação de investimentos.',
  outcome: 'Calculate net gains and identify mismatched periods, omitted losses and unsuitable investment exposure.',
  misconception: 'The biggest reported gain settles the comparison without considering costs, components or risk.',
  skills: [id(1), id(2), id(3), id(4), id(5), income, id(1)],
  segments: [
    numeric(q('practice-01', 'practice', [
      'What gain remains?|Gross gain: 60. Trading fee: 7; ongoing fee: 3.|50~57~60|Both fees reduce the gain kept.|Subtract each stated fee once.',
      '¿Qué ganancia queda?|Ganancia bruta: 60. Comisión de operación: 7; mantenimiento: 3.|50~57~60|Ambas comisiones reducen la ganancia conservada.|Resta una vez cada comisión indicada.',
      'Qual ganho sobra?|Ganho bruto: 60. Tarifa da operação: 7; manutenção: 3.|50~57~60|Ambas as tarifas reduzem o ganho mantido.|Subtraia uma vez cada tarifa dada.',
    ]), [60, 7, 3], subtract(subtract(input(0), input(1)), input(2))),
    q('practice-02', 'practice', [
      'What prevents comparison?|A fund report shows one quarter’s price change. Another includes a year’s payouts and price changes.|Both period and components differ~Only their starting prices~Nothing needs checking|The reports answer different time-and-income questions.|Align dates and included distributions.',
      '¿Qué impide comparar?|Un reporte muestra cambio de precio trimestral. Otro incluye pagos y precios de un año.|Difieren periodo y componentes~Solo sus precios iniciales~Nada requiere revisión|Los reportes responden preguntas distintas de tiempo e ingresos.|Alinea fechas y pagos incluidos.',
      'O que impede comparar?|Um relatório mostra preços de um trimestre. Outro inclui pagamentos e preços de um ano.|Período e partes diferem~Só seus preços iniciais~Nada exige revisão|Os relatórios respondem perguntas distintas de tempo e renda.|Alinhe datas e pagamentos incluídos.',
    ]),
    q('practice-03', 'practice', [
      'What evidence is missing?|A brochure highlights the best month while hiding the rest of the record.|Other outcomes, including losses~A brighter best-month chart~More celebration of winners|Selected success omits the range of results.|Ask which periods and outcomes were excluded.',
      '¿Qué evidencia falta?|Un folleto destaca el mejor mes y oculta el resto del historial.|Otros resultados, incluidas pérdidas~Una gráfica más brillante~Más celebración de ganadores|El éxito seleccionado omite la variedad de resultados.|Pregunta qué periodos y resultados excluyeron.',
      'Qual evidência falta?|Um folheto destaca o melhor mês e esconde o resto do histórico.|Outros resultados, incluindo perdas~Um gráfico mais brilhante~Mais festa dos vencedores|O sucesso escolhido omite a variedade de resultados.|Pergunte quais períodos e resultados foram excluídos.',
    ]),
    q('practice-04', 'practice', [
      'Does this fund fit?|A goal calls for broad company exposure. The fund holds shares in only one mining company.|No, its holdings are narrow~Yes, the word fund guarantees breadth|The holdings do not provide the requested broad exposure.|Compare actual contents with the goal.',
      '¿Este fondo coincide?|La meta pide exposición amplia a empresas. El fondo tiene acciones de una sola minera.|No, sus inversiones son estrechas~Sí, la palabra fondo garantiza amplitud|Las inversiones no ofrecen la exposición amplia solicitada.|Compara contenido real con la meta.',
      'Esse fundo combina?|A meta pede variedade de empresas. O fundo tem ações de uma só mineradora.|Não, seus ativos são restritos~Sim, a palavra fundo garante variedade|Os ativos não oferecem a variedade pedida.|Compare conteúdo real com a meta.',
    ]),
    q('practice-05', 'practice', [
      'What does tracking promise?|An index fund aims to follow a basket that can fall.|An aim to follow, with possible differences~Guaranteed gains in every period~Always beating the basket|Tracking is a strategy, not a guarantee of gains.|Separate the target from a promised outcome.',
      '¿Qué promete seguir?|Un fondo indexado intenta seguir una canasta que puede caer.|Intento de seguir, con posibles diferencias~Obtener utilidad siempre~Superar siempre la canasta|Seguir es estrategia, no garantía de ganar.|Distingue objetivo de resultado prometido.',
      'O que seguir promete?|Um fundo de índice tenta seguir uma cesta que pode cair.|Tentar seguir, com possíveis diferenças~Ganhos garantidos sempre~Sempre superar a cesta|Seguir é estratégia, não garantia de ganhar.|Separe meta de resultado prometido.',
    ]),
    q('practice-06', 'practice', [
      'Which parts determine the result?|An asset pays cash income but loses resale value during the same period.|Both income and value change~Income alone~Value alone|Income and price changes are separate result components.|Include both before describing the overall result.',
      '¿Qué partes determinan el resultado?|Un activo paga ingreso en efectivo y pierde valor de venta en el mismo periodo.|Ingresos y cambio de valor~Solo ingresos~Solo valor|Ingresos y cambios de precio son componentes distintos.|Incluye ambos antes de describir el resultado total.',
      'Quais partes definem o resultado?|Um ativo paga renda em dinheiro e perde valor de venda no mesmo período.|Renda e mudança de valor~Só renda~Só valor|Renda e mudanças de preço são partes distintas.|Inclua ambas antes de descrever o resultado total.',
    ]),
    numeric(q('transfer-01', 'transfer', [
      'What remains from this exit?|Sale gain before costs: 95. Mandatory exit charge: 10; settlement fee: 5.|80~85~95|Both exit costs reduce the gain available.|Subtract both mandatory charges from the gain.',
      '¿Qué queda de esta salida?|Ganancia de venta antes de costos: 95. Cargo de salida: 10; liquidación: 5.|80~85~95|Ambos costos de salida reducen la ganancia disponible.|Resta ambos cargos obligatorios de la ganancia.',
      'O que sobra dessa saída?|Ganho da venda antes dos custos: 95. Cobrança de saída: 10; liquidação: 5.|80~85~95|Ambos os custos de saída reduzem o ganho disponível.|Subtraia ambas as cobranças obrigatórias do ganho.',
    ]), [95, 10, 5], subtract(subtract(input(0), input(1)), input(2))),
  ],
}, {
  id: 'fe-production-investment-comparison-review-2', primary: id(6),
  title:'Offer Checks|Revisa la oferta completa|Confira a oferta inteira',
  relevance: 'An offer’s currency, costs and incentives can change what it means for your goal.|Moneda, costos e incentivos pueden cambiar lo que una oferta implica para tu meta.|Moeda, custos e incentivos podem mudar o que uma oferta significa para sua meta.',
  outcome: 'Identify currency exposure, selling incentives, allocation drift and unsupported promises in fresh offers.',
  misconception: 'A persuasive recommendation or high foreign return removes the need to check actual-use assumptions.',
  skills: [id(6), id(7), id(8), id(9), id(10), income, id(6)],
  segments: [
    q('practice-01', 'practice', [
      'Why can local value fall?|Foreign units stay constant, but each converts into fewer local units.|The exchange rate changed~The foreign unit count necessarily fell|Conversion can reduce local value without changing foreign units.|Track the goal’s spending currency.',
      '¿Por qué puede bajar el valor local?|Las unidades extranjeras siguen iguales, pero cada una entrega menos unidades locales.|Cambió el tipo de cambio~Necesariamente bajaron las unidades extranjeras|Convertir puede reducir valor local sin cambiar unidades extranjeras.|Sigue la moneda de gasto de la meta.',
      'Por que o valor local pode cair?|As unidades estrangeiras ficam iguais, mas cada uma entrega menos unidades locais.|O câmbio mudou~As unidades estrangeiras necessariamente caíram|Converter pode reduzir valor local sem mudar unidades estrangeiras.|Siga a moeda de gasto da meta.',
    ]),
    q('practice-02', 'practice', [
      'Which incentive matters?|A salesperson earns more when clients choose a higher-fee product.|Payment favors selling that product~The higher fee proves better outcomes~Friendliness removes the conflict|Compensation can influence which product is promoted.|Compare the sales incentive with the client’s goal.',
      '¿Qué incentivo importa?|Quien vende gana más si el cliente elige un producto con comisión mayor.|El pago favorece vender ese producto~Mayor comisión prueba mejores resultados~La amabilidad elimina el conflicto|La remuneración puede influir en el producto promovido.|Compara el incentivo de venta con la meta del cliente.',
      'Qual incentivo importa?|Quem vende ganha mais se o cliente escolhe um produto com tarifa maior.|O pagamento favorece vender esse produto~Tarifa maior prova melhores resultados~Simpatia elimina o conflito|A remuneração pode influenciar o produto promovido.|Compare o incentivo de venda com a meta do cliente.',
    ]),
    q('practice-03', 'practice', [
      'Which restores the target?|The plan targets equal groups. B now exceeds half; the goal is unchanged.|Reduce B’s relative share~Buy more B because it rose~Erase the target|Reducing the overweight group moves back toward the target.|Compare current weights with the unchanged plan.',
      '¿Qué dirección recupera la meta?|La cartera busca grupos iguales. B creció sobre la mitad; el objetivo no cambia.|Reducir la parte relativa de B~Comprar más B porque subió~Borrar la meta|Reducir el exceso acerca a la mezcla objetivo.|Compara pesos actuales con el plan vigente.',
      'Qual direção retoma a meta?|A carteira busca grupos iguais. B cresceu acima da metade; o objetivo não muda.|Reduzir a parte relativa de B~Comprar mais B porque subiu~Apagar a meta|Reduzir o excesso aproxima da composição da meta.|Compare pesos atuais com o plano vigente.',
    ]),
    q('practice-04', 'practice', [
      'What makes the ranking incomplete?|One after-cost quote includes tax and exit fees; another omits both.|Unequal net-return assumptions~Only their starting balances~Nothing if dates match|The omitted conditions affect the amount actually available.|Align taxes and exit costs before ranking.',
      '¿Qué vuelve incompleta la clasificación?|Una cifra neta incluye impuestos y salida; otra omite ambos.|Supuestos netos desiguales~Solo sus saldos iniciales~Nada si coinciden fechas|Las condiciones omitidas afectan el monto realmente disponible.|Alinea impuestos y costos de salida antes de ordenar.',
      'O que torna a ordem incompleta?|Um valor líquido inclui impostos e saída; outro omite ambos.|Hipóteses líquidas desiguais~Só seus saldos iniciais~Nada se as datas são iguais|As condições omitidas afetam o valor de fato disponível.|Alinhe impostos e custos de saída antes de ordenar.',
    ]),
    q('practice-05', 'practice', [
      'How should the claim be checked?|A stranger’s message promises huge guaranteed returns and provides its own verification number.|Find official information independently~Use only that number~Pay before asking|The sender’s own channel cannot independently verify the claim.|Verify the provider and offer before sending money.',
      '¿Cómo verificas la promesa?|Un desconocido promete enormes ganancias garantizadas y proporciona su propio número de verificación.|Buscar información oficial independientemente~Usar solo ese número~Pagar antes de preguntar|El canal del remitente no verifica independientemente la promesa.|Verifica proveedor y oferta antes de enviar dinero.',
      'Como conferir a promessa?|Um desconhecido promete ganhos enormes garantidos e fornece seu próprio número de verificação.|Buscar dados oficiais de forma independente~Usar só esse número~Pagar antes de perguntar|O canal do remetente não verifica a promessa de forma independente.|Confira prestador e oferta antes de enviar dinheiro.',
    ]),
    q('practice-06', 'practice', [
      'What changed without a sale?|A holding pays cash income while its quoted resale price stays flat.|Income was received~A price gain occurred~Nothing affected the result|A payment can contribute to return without a price change.|Separate payouts from changes in quoted value.',
      '¿Qué cambió sin vender?|Una inversión paga efectivo mientras su precio de reventa no cambia.|Se recibió ingreso~Hubo ganancia de precio~Nada afectó el resultado|Un pago puede aportar rendimiento sin cambiar el precio.|Distingue pagos de cambios del valor cotizado.',
      'O que mudou sem vender?|Uma aplicação paga dinheiro enquanto seu preço de revenda fica igual.|Houve renda recebida~Houve ganho no preço~Nada afetou o resultado|Um pagamento pode render sem mudar o preço.|Separe pagamentos de mudanças no valor cotado.',
    ]),
    q('transfer-01', 'transfer', [
      'What needs conversion?|A travel fund earns in one currency; the trip is paid in another.|The value into payment currency~Only the original balance~Only the fund name|The trip requires the currency used by its actual bills.|Evaluate the amount after conversion into the payment currency.',
      '¿Qué conviertes para la meta?|Un fondo de viaje gana en una moneda; el viaje debe pagarse en otra.|Su valor al tipo de cambio~Solo el saldo en moneda original~Solo el nombre del fondo|El viaje requiere la moneda de sus cuentas reales.|Evalúa el monto convertido a la moneda de pago.',
      'O que converter para a meta?|Um fundo de viagem rende numa moeda; a viagem precisa ser paga em outra.|Seu valor pela taxa de câmbio~Só o saldo na moeda original~Só o nome do fundo|A viagem exige a moeda das suas contas reais.|Avalie o valor convertido para a moeda do pagamento.',
    ]),
  ],
}];
