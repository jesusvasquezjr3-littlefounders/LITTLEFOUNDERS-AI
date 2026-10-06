import { q } from './helpers.mjs';
const id = n => `fe-production-investing-foundations-${String(n).padStart(2, '0')}`;
const reserve = 'fe-production-saving-resilience-04';
export const investingReviews = [{
  id: 'fe-production-investing-foundations-review-1', primary: id(1),
  title:'Investing Decisions|Antes de arriesgar dinero|Antes de arriscar dinheiro',
  relevance: 'Recheck the goal, the money needed and the investment’s actual promise.|Revisa la meta, el dinero necesario y qué promete realmente la inversión.|Confira a meta, o dinheiro necessário e o que a aplicação de fato promete.',
  outcome: 'Distinguish immediate obligations, risk capacity and investment claims in a fresh set of decisions.',
  misconception: 'A promising investment overrides the need to check spending dates, borrower reliability and the actual contract.',
  skills: [id(1), id(2), id(3), id(4), id(5), id(6), id(7), reserve, id(1)],
  segments: [
    q('practice-01', 'practice', [
      'Use which money?|A repair invoice is due tomorrow. Its reserved cash is the only payment source.|Keep the repair cash available~Invest it until the invoice is due|The repair payment cannot depend on an uncertain investment sale.|Check the obligation before considering returns.',
      '¿Qué haces con el dinero?|La reparación vence mañana. El efectivo apartado es la única fuente para pagar.|Conservar disponible ese efectivo~Invertirlo hasta el vencimiento|El pago no puede depender de una venta incierta.|Revisa la obligación antes de pensar en ganancias.',
      'O que fazer com o dinheiro?|O conserto vence amanhã. O dinheiro separado é a única fonte para pagar.|Manter esse dinheiro disponível~Investir até o vencimento|O pagamento não pode depender de uma venda incerta.|Confira a obrigação antes de pensar em ganhos.',
    ]),
    q('practice-02', 'practice', [
      'Which deadline matters?|A distant relocation plan changes: the move is now required next week.|Next week’s spending need~The original distant plan|The new date shortens the remaining investment horizon.|Use the current goal date.',
      '¿Qué plazo importa?|Una mudanza lejana cambia: ahora debe ocurrir la próxima semana.|La necesidad de la próxima semana~El plan lejano original|La nueva fecha acorta el plazo restante para invertir.|Usa la fecha actual de la meta.',
      'Qual prazo importa?|Uma mudança distante muda de data: agora precisa ocorrer na próxima semana.|A necessidade da próxima semana~O plano distante original|A nova data encurta o prazo restante para investir.|Use a data atual da meta.',
    ]),
    q('practice-03', 'practice', [
      'What limits the risk?|A person likes uncertainty, but a loss would leave a dependent without required care.|Financial capacity~Only willingness~Nothing, confidence is enough|The care obligation limits the loss that can be absorbed.|Distinguish feelings from the financial consequences.',
      '¿Qué limita el riesgo?|Una persona disfruta la incertidumbre, pero una pérdida dejaría sin cuidados necesarios a un dependiente.|La capacidad financiera~Solo su disposición~Nada, basta confianza|La obligación de cuidado limita la pérdida absorbible.|Distingue sentimientos de consecuencias financieras.',
      'O que limita o risco?|Uma pessoa gosta de incerteza, mas uma perda deixaria um dependente sem cuidado necessário.|A capacidade financeira~Só sua disposição~Nada, basta confiança|O dever de cuidado limita a perda suportável.|Separe sentimentos das consequências financeiras.',
    ]),
    q('practice-04', 'practice', [
      'Which result component?|An investment paid rent, while its estimated resale price stayed unchanged.|Income received~A resale price increase~No result of any kind|Rent is income separate from a price change.|Identify the actual payment.',
      '¿Qué parte del resultado?|Una inversión pagó renta y su precio estimado de reventa no cambió.|Ingreso recibido~Aumento del precio de reventa~Ningún resultado|La renta es ingreso distinto de un cambio de precio.|Identifica el pago real.',
      'Qual parte do resultado?|Uma aplicação pagou aluguel e seu preço estimado de revenda não mudou.|Rendimento recebido~Aumento no preço de revenda~Nenhum resultado|Aluguel é rendimento separado de mudança no preço.|Identifique o pagamento real.',
    ]),
    q('practice-05', 'practice', [
      'What did the buyer obtain?|A business raises funds by selling ownership shares, with no principal repayment promise.|An ownership stake~A loan repayment contract|The purchase grants ownership rather than a debt claim.|Read what the buyer actually receives.',
      '¿Qué obtuvo quien compró?|Un negocio recauda dinero vendiendo acciones de propiedad, sin promesa de devolver capital.|Una participación de propiedad~Un contrato de devolución de préstamo|La compra da propiedad en lugar de un derecho de deuda.|Lee qué recibe realmente quien compra.',
      'O que a pessoa comprou?|Uma empresa capta dinheiro vendendo ações, sem prometer devolver o capital.|Uma parte da empresa~Um contrato de pagar empréstimo|A compra dá uma parte, não um direito de dívida.|Leia o que a pessoa de fato recebe.',
    ]),
    q('practice-06', 'practice', [
      'Which risk is visible?|A bond borrower loses its main customer and cannot meet the next promised payment.|Credit risk~Only a change in app design|The borrower lacks resources for its debt obligation.|Follow the borrower’s ability to pay.',
      '¿Qué riesgo ves?|El deudor de un bono pierde su cliente principal y no puede cumplir el próximo pago prometido.|Riesgo de crédito~Solo cambio de diseño de la aplicación|Al deudor le faltan recursos para cumplir la deuda.|Sigue la capacidad de pago del deudor.',
      'Qual risco aparece?|O devedor de um título perde seu maior cliente e não consegue fazer o próximo pagamento.|Risco de crédito~Só mudança no desenho do aplicativo|Faltam recursos ao devedor para pagar a dívida.|Acompanhe a capacidade de pagar do devedor.',
    ]),
    q('practice-07', 'practice', [
      'Why might buyers pay less?|An older fixed bond keeps paying. Equivalent new bonds offer higher interest.|The old payments are less attractive~Fixed means resale never changes|Unchanged payments compete with better new alternatives.|Separate contractual payment from resale price.',
      '¿Por qué ofrecerían menos?|Un bono fijo anterior sigue pagando. Nuevos bonos equivalentes ofrecen más interés.|Los pagos anteriores son menos atractivos~Fijo impide cambiar de precio|Pagos sin cambios compiten con alternativas nuevas mejores.|Distingue pago contractual de precio de reventa.',
      'Por que oferecer menos?|Um título fixo antigo segue pagando. Títulos novos iguais oferecem mais juros.|Os pagamentos antigos atraem menos~Fixo impede mudar o preço|Pagamentos sem mudança competem com opções novas melhores.|Separe pagamento do acordo de preço de revenda.',
    ]),
    q('practice-08', 'practice', [
      'Where does this reserve fit?|Tomorrow’s reserve needs safe value and free access. A meets both; B locks withdrawals for months.|A~B because its quoted yield is higher|A meets the stated reserve requirements.|Access and safety matter before an advertised return.',
      '¿Dónde cabe la reserva?|La reserva de mañana exige valor seguro y acceso sin costo. A cumple; B bloquea retiros por meses.|A~B por su rendimiento anunciado mayor|A cumple los requisitos indicados de la reserva.|Acceso y seguridad importan antes que rendimiento anunciado.',
      'Onde cabe a reserva?|A reserva de amanhã exige valor seguro e acesso sem custo. A atende; B bloqueia saques por meses.|A~B por anunciar rendimento maior|A atende aos requisitos informados da reserva.|Acesso e segurança vêm antes do rendimento anunciado.',
    ]),
    q('transfer-01', 'transfer', [
      'Can this cash be invested?|A worker holds a client’s cash for tomorrow’s materials. It must remain fully available.|Keep it for materials~Invest because it is in hand|Holding someone’s committed money does not make it investable surplus.|Identify the money’s purpose and owner.',
      '¿Puedes invertir este efectivo?|Una persona guarda dinero de un cliente para materiales de mañana. Debe estar disponible completo.|Conservarlo para los materiales~Invertir porque está en mano|Guardar dinero comprometido ajeno no lo vuelve sobrante para invertir.|Identifica el propósito y dueño del dinero.',
      'Pode investir esse dinheiro?|Uma pessoa guarda dinheiro de um cliente para materiais de amanhã. Ele precisa estar disponível inteiro.|Guardá-lo para os materiais~Investir porque está em mãos|Guardar dinheiro comprometido alheio não o torna sobra para investir.|Identifique a finalidade e o dono do dinheiro.',
    ]),
  ],
}, {
  id: 'fe-production-investing-foundations-review-2', primary: id(8),
  title:'Investment Exposure|Lee la exposición oculta|Veja o risco por trás',
  relevance: 'Product names, popular gains and easy interfaces can hide the risks inside.|Los nombres, ganancias populares e interfaces sencillas pueden ocultar los riesgos internos.|Nomes, ganhos populares e telas fáceis podem esconder os riscos internos.',
  outcome: 'Identify concentration, fund contents, access restrictions and borrowed exposure without inferring safety from labels.',
  misconception: 'A larger product count, verified custodian or popular past gain guarantees the investment result.',
  skills: [id(8), id(9), id(10), id(11), id(12), id(13), id(14), reserve, id(8)],
  segments: [
    q('practice-01', 'practice', [
      'Which risk is shared?|A town’s landlord and restaurant both rely mainly on one factory’s workers.|The factory cutting employment~Only their different business names|The factory supports customers of both businesses.|Look for a common income source.',
      '¿Qué riesgo comparten?|Un arrendador y un restaurante dependen principalmente de trabajadores de una misma fábrica.|Que la fábrica reduzca empleos~Solo sus nombres diferentes|La fábrica sostiene a clientes de ambos negocios.|Busca una fuente común de ingresos.',
      'Qual risco compartilham?|Um locador e um restaurante dependem sobretudo dos empregados de uma mesma fábrica.|A fábrica cortar empregos~Só seus nomes diferentes|A fábrica sustenta clientes dos dois negócios.|Procure uma fonte comum de renda.',
    ]),
    q('practice-02', 'practice', [
      'Which conclusion is justified?|A portfolio holds unrelated sectors. A nationwide shock still affects several holdings.|Diversification does not eliminate all losses~Diversification has promised no losses|Broad shocks can affect different holdings together.|Reduced concentration does not mean certainty.',
      '¿Qué conclusión se justifica?|Una cartera tiene sectores sin relación. Un problema nacional afecta varias inversiones.|Diversificar no elimina toda pérdida~Diversificar prometió cero pérdidas|Problemas amplios pueden afectar juntas inversiones distintas.|Menor concentración no significa certeza.',
      'Qual conclusão é válida?|Uma carteira tem setores sem ligação. Uma crise nacional afeta vários ativos.|Dividir não elimina toda perda~Dividir prometeu zero perda|Crises amplas podem afetar ativos diferentes juntos.|Menos concentração não significa certeza.',
    ]),
    q('practice-03', 'practice', [
      'What reveals the exposure?|A fund’s cheerful name says little. Its document lists only mining-company shares.|Its listed holdings~Only its name~Only its management fee|The holdings reveal concentrated mining exposure.|Inspect the assets inside the fund.',
      '¿Qué revela la exposición?|El nombre alegre de un fondo dice poco. Su documento enumera solo acciones mineras.|Sus inversiones listadas~Solo su nombre~Solo la comisión de gestión|Sus inversiones revelan concentración en minería.|Inspecciona los activos dentro del fondo.',
      'O que revela o risco?|O nome alegre do fundo diz pouco. Seu documento lista só ações de mineradoras.|Os ativos listados~Só seu nome~Só a taxa de gestão|Os ativos mostram concentração em mineração.|Veja os ativos dentro do fundo.',
    ]),
    q('practice-04', 'practice', [
      'Does access fit?|A bill is due tomorrow. The supplied product terms release withdrawals only after a week.|No, the timing conflicts~Yes, displaying a balance is enough|The release date is later than the payment deadline.|Check usable cash timing.',
      '¿Coincide el acceso?|La cuenta vence mañana. Las condiciones liberan retiros solo después de una semana.|No, los plazos chocan~Sí, basta mostrar saldo|La liberación llega después del vencimiento de pago.|Revisa cuándo puedes usar el efectivo.',
      'O acesso serve?|A conta vence amanhã. As regras liberam saques só após uma semana.|Não, os prazos conflitam~Sim, basta mostrar saldo|A liberação chega após o vencimento da conta.|Veja quando pode usar o dinheiro.',
    ]),
    q('practice-05', 'practice', [
      'What does verification settle?|A custodian is genuine. The held asset can fluctuate sharply in market price.|Custodian identity, not investment returns~A guarantee against every loss|Verified custody and market performance are separate questions.|Do not turn identity checks into a return promise.',
      '¿Qué resuelve verificar?|El custodio es auténtico. El precio del activo puede variar mucho.|Identidad del custodio, no rendimientos~Garantía contra toda pérdida|Custodia verificada y rendimiento de mercado son preguntas distintas.|Verificar identidad no promete rendimientos.',
      'O que verificar resolve?|O custodiante é real. O preço do ativo pode variar muito.|Identidade, não rendimentos~Garantia contra toda perda|Custódia verificada e rendimento de mercado são questões separadas.|Verificar identidade não promete rendimento.',
    ]),
    q('practice-06', 'practice', [
      'Which risk remains?|A borrowed asset loses value. Selling it would not repay the full loan.|Debt remains beyond the sale proceeds~The lender must erase the shortfall|Selling the asset does not cancel uncovered debt.|Follow the repayment obligation after selling.',
      '¿Qué riesgo queda?|Un activo comprado con préstamo pierde valor. Venderlo no cubriría el préstamo completo.|Queda deuda después de vender~El prestamista debe borrar el faltante|Vender el activo no cancela deuda sin cubrir.|Sigue la obligación después de vender.',
      'Qual risco resta?|Um ativo comprado com empréstimo perde valor. Vendê-lo não cobriria toda a dívida.|Resta dívida após vender~O credor deve apagar a falta|Vender o ativo não cancela a dívida sem cobertura.|Siga o dever de pagar após vender.',
    ]),
    q('practice-07', 'practice', [
      'Does this establish safety?|A seller shows a past buyer’s spectacular collectible gain and promises everyone the same.|No, selected history is not a guarantee~Yes, one winner proves universal safety|One past outcome cannot guarantee later resale prices.|Look beyond the selected success story.',
      '¿La historia demuestra seguridad?|Un vendedor muestra la gran ganancia pasada de un comprador y promete lo mismo a todos.|No, un caso no garantiza resultados~Sí, un ganador prueba seguridad universal|Un resultado pasado no garantiza futuros precios de reventa.|Mira más allá del caso exitoso seleccionado.',
      'A história comprova segurança?|Um vendedor mostra um grande ganho passado e promete o mesmo a todos.|Não, um caso não garante resultados~Sim, um vencedor prova segurança geral|Um resultado passado não garante preços futuros de revenda.|Veja além do caso de sucesso escolhido.',
    ]),
    q('practice-08', 'practice', [
      'Which reserve meets the rule?|An emergency reserve must avoid market loss and withdrawal fees. A meets both; B can lose value.|A~B because its graph rose|A meets the specified reserve conditions.|Past growth does not replace the reserve’s safety constraint.',
      '¿Qué reserva cumple?|La reserva debe evitar pérdidas de mercado y comisiones de retiro. A cumple ambas; B puede bajar.|A~B porque su gráfica subió|A cumple las condiciones indicadas de reserva.|Subir antes no sustituye la condición de seguridad.',
      'Qual reserva atende?|A reserva deve evitar perda de mercado e tarifa de saque. A atende às duas; B pode cair.|A~B porque seu gráfico subiu|A atende às condições informadas para a reserva.|Subir antes não substitui a condição de segurança.',
    ]),
    q('transfer-01', 'transfer', [
      'What link is hidden?|Two funds have different names, but both hold almost only the same technology companies.|Their underlying companies overlap~Different fund names remove concentration|Overlapping holdings preserve exposure to the same companies.|Look inside both funds before counting distinct risks.',
      '¿Qué conexión está oculta?|Dos fondos tienen nombres distintos, pero casi solo poseen las mismas empresas tecnológicas.|Coinciden sus empresas subyacentes~Nombres distintos eliminan concentración|Coincidir en inversiones conserva exposición a las mismas empresas.|Mira dentro de ambos antes de contar riesgos distintos.',
      'Que ligação fica oculta?|Dois fundos têm nomes distintos, mas possuem quase só as mesmas empresas de tecnologia.|As empresas dos dois coincidem~Nomes distintos eliminam concentração|Ativos iguais mantêm o risco ligado às mesmas empresas.|Olhe dentro dos dois antes de contar riscos distintos.',
    ]),
  ],
}];
