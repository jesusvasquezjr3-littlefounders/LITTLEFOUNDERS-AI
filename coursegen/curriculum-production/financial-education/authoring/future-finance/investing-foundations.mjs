import { teach, ex, q } from './helpers.mjs';
const d = 'investing-foundations';
export const investingFoundations = [
teach(d,1,'Protect Essentials|Protege el próximo pago|Proteja o próximo pagamento',
  'A bill needs spendable money on its due date, even when an investment looks promising.|Una cuenta necesita dinero disponible al vencer, aunque una inversión parezca prometedora.|Uma conta precisa de dinheiro disponível no vencimento, mesmo quando um investimento parece promissor.',
  'A possible investment gain makes money committed to a nearby obligation safe to invest.', [
  ex('example-01', 'Two different purposes|Dos funciones distintas|Duas funções diferentes', 'Rent is due tomorrow. An investment may fall today, so keep the rent accessible instead of relying on selling it.|La renta vence mañana. Una inversión puede bajar hoy; conserva disponible la renta sin depender de venderla.|O aluguel vence amanhã. Um investimento pode cair hoje; mantenha o aluguel disponível sem depender de uma venda.'),
  q('guided-01', 'guided', [
    'Protect which money?|Tomorrow’s medicine is unpaid. Investments can lose value before tomorrow.|The medicine money~Only possible investment profits~Nothing until tomorrow|The medicine payment cannot depend on an uncertain sale.|Match the payment date with reliable access.',
    '¿Qué dinero proteges?|La medicina de mañana está pendiente. La inversión puede perder valor antes.|El de la medicina~Solo posibles ganancias~Nada hasta mañana|El pago de medicina no puede depender de una venta incierta.|Relaciona la fecha de pago con acceso seguro.',
    'Qual dinheiro proteger?|O remédio de amanhã não foi pago. O investimento pode perder valor antes.|O dinheiro do remédio~Só possíveis ganhos~Nada até amanhã|O remédio não pode depender de uma venda incerta.|Relacione o vencimento com acesso confiável.',
  ]),
  q('guided-02', 'guided', [
    'Which purpose comes first?|An envelope holds next week’s required fare. Its owner considers buying shares.|Keep the fare available~Buy shares and expect gains|The envelope already has a near-term purpose.|A higher hoped-for return does not cancel the fare.',
    '¿Qué función va primero?|Un sobre guarda el pasaje necesario de la próxima semana. Consideran comprar acciones.|Conservar disponible el pasaje~Comprar acciones esperando ganar|Ese sobre ya tiene un propósito cercano.|Una ganancia esperada no elimina el pasaje.',
    'Qual função vem primeiro?|Um envelope guarda a passagem necessária da próxima semana. A pessoa pensa em comprar ações.|Manter a passagem disponível~Comprar ações esperando ganhar|O envelope já tem uma finalidade próxima.|Um ganho esperado não elimina a passagem.',
  ]),
  q('practice-01', 'practice', [
    'Does the past settle this?|A fund rose last month. Tuition is due Friday with no backup money.|No, Friday’s value is uncertain~Yes, last month proves safety|Past growth does not secure Friday’s payment.|Ask whether the payment survives a loss.',
    '¿El pasado lo resuelve?|Un fondo subió el mes pasado. La colegiatura vence el viernes, sin dinero de respaldo.|No, el valor del viernes es incierto~Sí, subir demuestra seguridad|Una subida anterior no asegura el pago del viernes.|Revisa si puedes pagar después de una pérdida.',
    'O passado resolve isso?|Um fundo subiu no mês passado. A mensalidade vence sexta, sem dinheiro de reserva.|Não, o valor de sexta é incerto~Sim, subir comprova segurança|Uma alta passada não garante o pagamento de sexta.|Veja se o pagamento resiste a uma perda.',
  ]),
  q('practice-02', 'practice', [
    'What follows?|Bills and an accessible reserve are covered. Other money funds a distant goal.|Evaluate investing that money~Every investment is safe~Invest the bill money too|Separating commitments allows evaluation; it does not remove investment risk.|Available money can still be lost in an investment.',
    '¿Qué puedes concluir?|Las cuentas y una reserva accesible están cubiertas. Otro monto tiene una meta lejana.|Puedes evaluar invertir ese monto~Toda inversión ya es segura~También debes invertir las cuentas|Separar compromisos permite evaluar; no elimina el riesgo de invertir.|Poder invertir no significa hacerlo sin riesgo.',
    'O que se pode concluir?|Contas e uma reserva acessível estão cobertas. Outra quantia tem uma meta distante.|Pode avaliar investir essa quantia~Todo investimento agora é seguro~Deve investir também as contas|Separar compromissos permite avaliar; não elimina o risco do investimento.|Poder investir não significa ausência de risco.',
  ]),
  q('practice-03', 'practice', [
    'What remains unresolved?|An investment can be sold instantly, but its sale value can fall. Rent uses this money tomorrow.|Whether enough money remains~Whether it has a sale button|Fast selling does not guarantee the amount needed.|Check value as well as access.',
    '¿Qué falta resolver?|Puedes vender al instante una inversión, pero su precio puede caer. Mañana pagas renta con ese dinero.|Si queda dinero suficiente~Si existe un botón de venta|Vender rápido no garantiza el monto necesario.|Revisa el valor además del acceso.',
    'O que falta resolver?|Um investimento pode ser vendido imediatamente, mas seu preço pode cair. Amanhã esse dinheiro paga aluguel.|Se resta dinheiro suficiente~Se existe um botão de venda|Vender rápido não garante a quantia necessária.|Confira o valor além do acesso.',
  ]),
  q('transfer-01', 'transfer', [
    'Risk the deposit?|A rental deposit must be returned next week. A friend suggests investing it meanwhile.|Keep the return money available~Invest because it is temporary~Count earned income|Money owed back is committed, even while you hold it.|Identify who needs the money and when.',
    '¿Puedes arriesgar el depósito?|Debes devolver un depósito de alquiler la próxima semana. Alguien sugiere invertirlo mientras tanto.|Conservar disponible la devolución~Invertir porque es temporal~Tratarlo como ingreso ganado|El dinero por devolver está comprometido aunque todavía lo tengas.|Identifica quién necesita el dinero y cuándo.',
    'Pode arriscar o depósito?|Um depósito de aluguel deve ser devolvido na próxima semana. Alguém sugere investi-lo enquanto isso.|Manter a devolução disponível~Investir porque é temporário~Tratar como renda recebida|Dinheiro a devolver está comprometido, mesmo em suas mãos.|Identifique quem precisa do dinheiro e quando.',
  ]),
]),
teach(d,2,'Money Timing|¿Cuándo lo necesitarás?|Quando vai precisar?',
  'The same price drop can delay one goal and prevent another payment entirely.|La misma caída puede retrasar una meta e impedir por completo otro pago.|A mesma queda pode atrasar uma meta e impedir completamente outro pagamento.',
  'A long horizon guarantees recovery or a short horizon makes losses harmless.', [
  ex('example-01', 'Time changes the consequence|El tiempo cambia la consecuencia|O tempo muda a consequência', 'A drop before tomorrow’s payment creates an immediate gap. A flexible distant goal allows waiting, without guaranteeing recovery.|Una caída antes del pago de mañana deja un faltante inmediato. Una meta lejana flexible permite esperar, sin garantizar recuperación.|Uma queda antes do pagamento de amanhã abre uma falta imediata. Uma meta distante flexível permite esperar, sem garantir recuperação.'),
  q('guided-01', 'guided', [
    'Who cannot wait?|Both investments fall today. Ana needs the money tomorrow; Bo’s optional trip has no fixed date.|Ana~Bo~Both have identical deadlines|Ana’s deadline leaves no time to wait.|Compare the stated dates, not their optimism.',
    '¿Quién no puede esperar?|Ambas inversiones caen hoy. Ana necesita el dinero mañana; el viaje opcional de Bo no tiene fecha.|Ana~Bo~Ambos tienen igual plazo|El plazo de Ana no permite esperar.|Compara las fechas, no el optimismo.',
    'Quem não pode esperar?|Ambos os investimentos caem hoje. Ana precisa amanhã; a viagem opcional de Bo não tem data.|Ana~Bo~Ambos têm prazo igual|O prazo de Ana não permite esperar.|Compare as datas, não o otimismo.',
  ]),
  q('guided-02', 'guided', [
    'What does flexibility allow?|A workshop purchase can be postponed after an investment loss.|Wait or revise the goal~Guarantee the loss disappears|Flexibility changes the response, not the investment’s guarantee.|More time is not a promise of recovery.',
    '¿Qué permite la flexibilidad?|Puedes posponer la compra de equipo tras una pérdida de inversión.|Esperar o revisar la meta~Garantizar que desaparezca la pérdida|La flexibilidad cambia la respuesta, no garantiza la inversión.|Más tiempo no promete recuperación.',
    'O que a flexibilidade permite?|Uma compra de equipamento pode ser adiada após uma perda no investimento.|Esperar ou rever a meta~Garantir que a perda desapareça|A flexibilidade muda a resposta, não garante o investimento.|Mais tempo não promete recuperação.',
  ]),
  q('practice-01', 'practice', [
    'Which horizon applies?|Someone has invested for years but now needs all the money next month.|Next month’s need~The years already elapsed|The upcoming need determines the remaining horizon.|Count forward to the spending date.',
    '¿Qué plazo importa?|Una persona lleva años invirtiendo, pero ahora necesita todo el dinero el próximo mes.|La necesidad del próximo mes~Los años transcurridos|La próxima necesidad determina el plazo que queda.|Cuenta hacia la fecha del gasto.',
    'Qual prazo importa?|Uma pessoa investe há anos, mas agora precisa de todo o dinheiro no próximo mês.|A necessidade do próximo mês~Os anos já passados|A necessidade futura determina o prazo restante.|Conte até a data do gasto.',
  ]),
  q('practice-02', 'practice', [
    'What changes the consequence?|Two identical holdings fall. One funds a fixed medical date; the other a postponable hobby.|The ability to postpone spending~The holding’s identical name|A fixed need limits the response to the loss.|Use the goal’s deadline and flexibility.',
    '¿Qué cambia la consecuencia?|Dos inversiones iguales caen. Una paga una cita médica fija; otra, un pasatiempo que puede esperar.|Poder posponer el gasto~El nombre idéntico de la inversión|Una necesidad fija limita la respuesta ante la pérdida.|Usa la fecha y flexibilidad de la meta.',
    'O que muda a consequência?|Duas aplicações iguais caem. Uma paga consulta com data fixa; outra, um passatempo adiável.|Poder adiar o gasto~O nome igual da aplicação|Uma necessidade fixa limita a resposta à perda.|Use o prazo e a flexibilidade da meta.',
  ]),
  q('practice-03', 'practice', [
    'Is this promise justified?|An offer says a distant goal cannot suffer investment losses.|No, time does not eliminate loss~Yes, distant means guaranteed|A longer horizon does not guarantee a positive result.|Separate time available from certainty.',
    '¿Se justifica la promesa?|Una oferta afirma que una meta lejana no puede sufrir pérdidas de inversión.|No, el tiempo no elimina pérdidas~Sí, lejana significa garantizada|Un plazo mayor no garantiza un resultado positivo.|Distingue tiempo disponible de certeza.',
    'A promessa se justifica?|Uma oferta diz que uma meta distante não pode sofrer perdas no investimento.|Não, tempo não elimina perdas~Sim, distante significa garantida|Um prazo maior não garante resultado positivo.|Separe tempo disponível de certeza.',
  ]),
  q('transfer-01', 'transfer', [
    'Recheck which assumption?|A house repair was planned for later. Storm damage makes it necessary this week.|The money’s time horizon~Only last year’s return~The expected investment return|The repair deadline has moved much closer.|A changed spending date changes the investment constraint.',
    '¿Qué supuesto revisas?|Una reparación estaba planeada para después. Una tormenta la vuelve necesaria esta semana.|El plazo del dinero~Solo el rendimiento anterior~El rendimiento esperado|La fecha de reparación ahora está mucho más cerca.|Cambiar la fecha del gasto cambia la restricción.',
    'Qual hipótese revisar?|Uma reforma estava prevista para depois. Uma tempestade a torna necessária nesta semana.|O prazo desse dinheiro~Só o rendimento passado~O retorno esperado|A data da reforma ficou muito mais próxima.|Mudar a data do gasto muda a restrição.',
  ]),
]),
teach(d,3,'Risk Capacity|Tranquilidad no es capacidad|Tranquilidade não é capacidade',
  'Feeling comfortable with a loss does not pay the bills that loss could leave uncovered.|Sentirte tranquilo ante una pérdida no paga las cuentas que podrían quedar descubiertas.|Sentir tranquilidade diante de uma perda não paga as contas que ela pode deixar descobertas.',
  'Emotional willingness to take risk proves financial ability to absorb a loss.', [
  ex('example-01', 'Check two things|Revisa dos cosas|Confira duas coisas', 'Jo accepts uncertainty emotionally, but losing the rent causes a shortfall. Willingness is high; financial capacity is low.|Jo acepta emocionalmente la incertidumbre, pero perder la renta provoca un faltante. Tiene disposición, pero poca capacidad financiera.|Jo aceita a incerteza emocionalmente, mas perder o aluguel causa uma falta. Há disposição, mas pouca capacidade financeira.'),
  q('guided-01', 'guided', [
    'Which limit remains?|Lea enjoys risk. A loss would leave her essential payment unpaid.|Financial capacity~Only emotional comfort~No limit remains|Enjoying risk does not cover the essential payment.|Check the consequence of losing, not just feelings.',
    '¿Qué límite queda?|A Lea le gusta el riesgo. Una pérdida dejaría pendiente su pago indispensable.|La capacidad financiera~Solo su tranquilidad~No queda ningún límite|Disfrutar el riesgo no cubre el pago indispensable.|Revisa las consecuencias, además de los sentimientos.',
    'Qual limite permanece?|Lea gosta de risco. Uma perda deixaria sua conta essencial sem pagamento.|A capacidade financeira~Só sua tranquilidade~Não resta limite|Gostar de risco não cobre a conta essencial.|Confira as consequências, além dos sentimentos.',
  ]),
  q('guided-02', 'guided', [
    'What is being described?|Milo can cover essentials after a loss but feels unable to tolerate uncertainty.|Low willingness~No financial capacity~A guaranteed investment|The stated difficulty is emotional tolerance.|Separate ability to pay from comfort with uncertainty.',
    '¿Qué se describe?|Milo puede cubrir lo indispensable tras perder, pero no tolera la incertidumbre.|Poca disposición~Nula capacidad financiera~Una inversión garantizada|La dificultad indicada es tolerar emocionalmente la incertidumbre.|Distingue poder pagar de sentirse tranquilo.',
    'O que está descrito?|Milo cobre o essencial após uma perda, mas não tolera a incerteza.|Pouca disposição~Nenhuma capacidade financeira~Um investimento garantido|A dificuldade indicada é tolerar emocionalmente a incerteza.|Separe poder pagar de sentir tranquilidade.',
  ]),
  q('practice-01', 'practice', [
    'Does confidence resolve it?|A confident investor has no backup for money supporting a dependent.|No, the obligation still limits capacity~Yes, confidence replaces a reserve|The dependent’s needs remain a financial constraint.|Confidence cannot replace money needed by someone else.',
    '¿La confianza lo resuelve?|Una persona confiada no tiene respaldo para el dinero que sostiene a un dependiente.|No, la obligación limita su capacidad~Sí, la confianza sustituye una reserva|Las necesidades del dependiente siguen siendo una restricción financiera.|La confianza no sustituye dinero necesario para otra persona.',
    'A confiança resolve?|Uma pessoa confiante não tem reserva para o dinheiro que sustenta um dependente.|Não, a obrigação limita a capacidade~Sim, confiança substitui reserva|As necessidades do dependente continuam sendo uma restrição financeira.|Confiança não substitui dinheiro necessário para outra pessoa.',
  ]),
  q('practice-02', 'practice', [
    'Which fact tests capacity?|Before investing, someone wants to know whether a loss would be absorbable.|Essential costs still covered afterward~Whether friends enjoy risk~How exciting the offer looks|Capacity concerns the financial consequences of the loss.|Focus on obligations after a possible loss.',
    '¿Qué prueba la capacidad?|Antes de invertir, alguien quiere saber si podría absorber una pérdida.|Cubrir lo esencial después~Si sus amistades disfrutan riesgos~Lo emocionante de la oferta|La capacidad trata de consecuencias financieras de perder.|Revisa las obligaciones después de una posible pérdida.',
    'O que testa a capacidade?|Antes de investir, alguém quer saber se poderia absorver uma perda.|Cobrir o essencial depois~Se amigos gostam de risco~Quanto a oferta empolga|A capacidade trata das consequências financeiras da perda.|Confira as obrigações após uma possível perda.',
  ]),
  q('practice-03', 'practice', [
    'What changed?|Income falls while required bills stay unchanged. Risk preference stays the same.|Capacity may have fallen~Willingness must have risen~Risk has disappeared|Less income can reduce the room to absorb losses.|Review resources and obligations separately from preferences.',
    '¿Qué cambió?|Baja el ingreso y las cuentas obligatorias siguen iguales. La preferencia por riesgo no cambia.|Puede bajar la capacidad~Debe subir la disposición~Desapareció el riesgo|Menos ingreso puede reducir el margen para absorber pérdidas.|Revisa recursos y obligaciones aparte de preferencias.',
    'O que mudou?|A renda cai e as contas obrigatórias continuam iguais. A preferência por risco não muda.|A capacidade pode cair~A disposição deve subir~O risco desapareceu|Menos renda pode reduzir o espaço para absorver perdas.|Confira recursos e obrigações separados das preferências.',
  ]),
  q('transfer-01', 'transfer', [
    'Reassess which limit?|A new caregiving duty uses money previously available for losses. The investor still feels adventurous.|Financial capacity~Only personality~Neither, preferences are unchanged|The new duty changes what losses are affordable.|A new responsibility can change capacity without changing preferences.',
    '¿Qué límite reevalúas?|Cuidar a un familiar usa dinero antes disponible para pérdidas. La persona sigue sintiéndose aventurera.|La capacidad financiera~Solo la personalidad~Ninguno, sus gustos siguen iguales|La nueva responsabilidad cambia qué pérdidas puede absorber.|Una obligación cambia capacidad sin cambiar preferencias.',
    'Qual limite reavaliar?|Cuidar de um familiar usa dinheiro antes disponível para perdas. A pessoa continua aventureira.|A capacidade financeira~Só a personalidade~Nenhum, os gostos não mudaram|A nova responsabilidade muda quais perdas são suportáveis.|Uma obrigação muda a capacidade sem mudar preferências.',
  ]),
]),
teach(d,4,'Investment Returns|Pagos y cambios de precio|Pagamentos e mudanças de preço',
  'An investment can pay income while its sale value falls. Check both parts of the result.|Una inversión puede pagar ingresos mientras baja su valor de venta. Revisa ambas partes del resultado.|Um investimento pode pagar rendimentos enquanto seu valor de venda cai. Confira ambas as partes do resultado.',
  'Receiving an income payment proves the investment gained overall.', [
  ex('example-01', 'Two separate changes|Dos cambios distintos|Duas mudanças diferentes', 'A holding pays cash but sells for less than before. The payment and the price loss are different result components.|Una inversión paga efectivo, pero se vende por menos que antes. El pago y la pérdida de precio son componentes distintos.|Uma aplicação paga dinheiro, mas vale menos na venda. O pagamento e a perda no preço são componentes diferentes.'),
  q('guided-01', 'guided', [
    'Which part is income?|A bond sends an interest payment. Its market price also changes.|The interest payment~Only its market price|The payment is income received from holding the bond.|Separate cash paid out from a possible sale.',
    '¿Qué parte es ingreso?|Un bono paga intereses. Su precio de mercado también cambia.|El pago de intereses~Solo su precio de mercado|El pago es ingreso recibido por mantener el bono.|Distingue el efectivo recibido de una posible venta.',
    'Qual parte é rendimento?|Um título paga juros. Seu preço de mercado também muda.|O pagamento de juros~Só seu preço de mercado|O pagamento é rendimento recebido por manter o título.|Separe o dinheiro recebido de uma possível venda.',
  ]),
  q('guided-02', 'guided', [
    'Which part changed?|A share paid no dividend. A buyer now offers more for it.|Its sale value~Cash income already received|A higher offer changes value without creating a dividend.|An offer is not an income payment.',
    '¿Qué parte cambió?|Una acción no pagó dividendos. Ahora alguien ofrece más por ella.|Su valor de venta~El ingreso ya recibido|Una oferta mayor cambia el valor sin crear un dividendo.|Una oferta no es un pago de ingresos.',
    'Qual parte mudou?|Uma ação não pagou dividendos. Agora alguém oferece mais por ela.|Seu valor de venda~O rendimento já recebido|Uma oferta maior muda o valor sem criar um dividendo.|Uma oferta não é um pagamento de rendimento.',
  ]),
  q('practice-01', 'practice', [
    'Is the result known?|A statement shows a cash distribution but omits the holding’s change in value.|No, the value change is missing~Yes, any distribution proves profit|A distribution alone cannot establish the overall result.|Check both payments and changes in value.',
    '¿Conoces el resultado?|Un estado muestra un pago en efectivo, pero omite el cambio de valor de la inversión.|No, falta el cambio de valor~Sí, todo pago prueba ganancia|Un pago aislado no establece el resultado total.|Revisa pagos y cambios de valor.',
    'O resultado é conhecido?|Um extrato mostra uma distribuição em dinheiro, mas omite a mudança de valor da aplicação.|Não, falta a mudança de valor~Sim, qualquer pagamento comprova lucro|Um pagamento isolado não estabelece o resultado total.|Confira pagamentos e mudanças de valor.',
  ]),
  q('practice-02', 'practice', [
    'What has become cash?|A holding’s displayed value rises. It pays nothing and remains unsold.|No sale proceeds or income yet~The whole displayed gain|An unsold value increase is not cash already received.|Check whether a payment or sale occurred.',
    '¿Qué se volvió efectivo?|Sube el valor mostrado de una inversión. No paga nada y sigue sin venderse.|Aún no hay cobro ni venta~Toda la ganancia mostrada|Una subida sin vender no es efectivo ya recibido.|Revisa si hubo pago o venta.',
    'O que virou dinheiro?|O valor exibido de uma aplicação sobe. Ela não paga nada e não foi vendida.|Ainda não houve recebimento ou venda~Todo o ganho exibido|Uma alta sem venda não é dinheiro já recebido.|Confira se houve pagamento ou venda.',
  ]),
  q('practice-03', 'practice', [
    'Can both happen?|A fund pays income this month while buyers offer less for its units.|Yes, payments and price can differ~No, a payment fixes the price|An income payment does not fix the resale price.|Treat the payment and sale value separately.',
    '¿Pueden ocurrir ambos?|Un fondo paga ingresos este mes y los compradores ofrecen menos por sus participaciones.|Sí, pago y precio pueden diferir~No, pagar fija el precio|Un pago de ingresos no fija el precio de reventa.|Trata por separado el pago y el valor de venta.',
    'Ambos podem ocorrer?|Um fundo paga rendimentos neste mês e compradores oferecem menos por suas cotas.|Sim, pagamento e preço podem diferir~Não, pagar fixa o preço|Um pagamento de rendimento não fixa o preço de revenda.|Separe o pagamento do valor de venda.',
  ]),
  q('transfer-01', 'transfer', [
    'Which records are needed?|A rental investment produces rent. The owner wants its overall result before costs.|Rent received and property value change~Rent received alone~Property value change alone|Both income and value change contribute to the result.|Do not substitute one component for the whole result.',
    '¿Qué registros necesitas?|Una propiedad de inversión genera renta. Buscan su resultado total antes de costos.|Rentas recibidas y cambio de valor~Solo las rentas recibidas~Solo cambio de valor del inmueble|Ingresos y cambio de valor contribuyen al resultado.|No sustituyas el resultado completo por una parte.',
    'Quais registros são necessários?|Um imóvel de investimento gera aluguel. Buscam seu resultado total antes dos custos.|Aluguéis recebidos e mudança de valor~Só os aluguéis recebidos~Só mudança do valor do imóvel|Rendimentos e mudança de valor contribuem para o resultado.|Não substitua o resultado completo por uma parte.',
  ]),
]),
teach(d,5,'Investment Roles|¿Propietario o prestamista?|Proprietário ou credor?',
  'Buying ownership and lending money create different claims on a business.|Comprar propiedad y prestar dinero crean derechos distintos frente a una empresa.|Comprar participação e emprestar dinheiro criam direitos diferentes perante uma empresa.',
  'A share and a bond are interchangeable promises to repay the buyer.', [
  ex('example-01', 'Read the relationship|Lee la relación|Leia a relação', 'A share represents ownership. A bond represents a loan with repayment terms; neither label alone removes the risk of loss.|Una acción representa propiedad. Un bono representa un préstamo con condiciones de pago; ninguna etiqueta elimina el riesgo de perder.|Uma ação representa participação. Um título de dívida representa empréstimo com condições de pagamento; nenhum nome elimina o risco de perda.'),
  q('guided-01', 'guided', [
    'Which relationship?|A company sells a small ownership stake rather than promising to repay a loan.|Share ownership~Bond lending|An ownership stake is a share, not a repayment promise.|Look for ownership versus a loan agreement.',
    '¿Qué relación existe?|Una empresa vende una pequeña participación de propiedad, sin prometer devolver un préstamo.|Propiedad mediante acción~Préstamo mediante bono|La participación es una acción, no una promesa de devolución.|Busca propiedad o un acuerdo de préstamo.',
    'Que vínculo existe?|Uma empresa vende uma parte dela, sem tomar um empréstimo.|Ser sócio por ação~Ser credor por título|A ação dá uma parte da empresa, não promete reembolso.|Veja se há parte da empresa ou dívida.',
  ]),
  q('guided-02', 'guided', [
    'Which relationship?|An issuer borrows through a security promising interest and repayment on stated dates.|Bond lending~Share ownership|The borrower’s payment terms describe debt.|A repayment schedule is not an ownership percentage.',
    '¿Qué relación existe?|Un emisor obtiene un préstamo mediante un título que promete intereses y devolución en fechas indicadas.|Préstamo mediante bono~Propiedad mediante acción|Las condiciones de pago del prestatario describen deuda.|Un calendario de devolución no es participación de propiedad.',
    'Que vínculo existe?|Uma empresa toma dinheiro por um título e promete pagar juros e devolver nas datas dadas.|Ser credor por título~Ser sócio por ação|Quem deve pagar o empréstimo tem uma dívida.|Datas para pagar não são partes da empresa.',
  ]),
  q('practice-01', 'practice', [
    'Does a share promise repayment?|Someone buys ownership in a bakery. No loan contract exists.|No, ownership is not a loan~Yes, every investment is a loan|The buyer owns a stake rather than lending principal.|Identify the contract, not just money changing hands.',
    '¿La acción promete devolución?|Alguien compra propiedad en una panadería. No existe contrato de préstamo.|No, propiedad no es préstamo~Sí, toda inversión es préstamo|La persona tiene participación en lugar de prestar capital.|Identifica el contrato, no solo el movimiento de dinero.',
    'A ação promete reembolso?|Alguém compra uma parte de uma padaria. Não há empréstimo.|Não, ser sócio não é emprestar~Sim, toda compra é empréstimo|A pessoa é sócia, não quem emprestou dinheiro.|Veja o acordo, não só a troca de dinheiro.',
  ]),
  q('practice-02', 'practice', [
    'Which fact identifies debt?|Two securities belong to the same company. One has contractual repayment dates.|The repayment obligation~The shared company name~The company’s profit forecast|A repayment obligation identifies the lending relationship.|The same company can issue different kinds of claims.',
    '¿Qué identifica deuda?|Dos títulos pertenecen a la misma empresa. Uno tiene fechas contractuales de devolución.|La obligación de devolver~El nombre de la empresa~La ganancia prevista de la empresa|La obligación de devolver identifica la relación de préstamo.|Una empresa puede emitir derechos de distintos tipos.',
    'O que mostra dívida?|Dois papéis são da mesma empresa. Um exige devolver dinheiro nas datas do acordo.|O dever de devolver~O nome da empresa~O lucro previsto da empresa|O dever de devolver mostra que houve um empréstimo.|Uma empresa pode emitir ação e dívida.',
  ]),
  q('practice-03', 'practice', [
    'Does the label settle safety?|A seller calls a security a bond and says this eliminates all risk.|No, the borrower could fail to pay~Yes, bonds cannot lose money|A debt promise can still go unpaid.|Separate an obligation from certainty it will be met.',
    '¿La etiqueta asegura todo?|Un vendedor llama bono a un título y afirma que eso elimina todo riesgo.|No, el deudor podría no pagar~Sí, los bonos no pueden perder|Una promesa de deuda puede quedar sin pagar.|Distingue obligación de certeza de cumplimiento.',
    'O nome garante tudo?|Um vendedor chama um papel de título de dívida e diz que não há risco.|Não, o devedor pode não pagar~Sim, títulos não podem perder|Uma promessa de dívida pode não ser paga.|Dever pagar não é certeza de pagar.',
  ]),
  q('transfer-01', 'transfer', [
    'Classify the new offer|A city raises money with a promise to repay lenders. It sells no ownership stake.|Debt investment~Ownership investment|The offer promises repayment to lenders, not ownership.|Classify the agreement even when the issuer changes.',
    'Clasifica la oferta nueva|Una ciudad obtiene dinero prometiendo devolverlo a prestamistas. No vende participación de propiedad.|Inversión de deuda~Inversión de propiedad|La oferta promete devolver un préstamo, no entregar propiedad.|Clasifica el acuerdo aunque cambie el emisor.',
    'Que tipo de oferta?|Uma cidade toma dinheiro e promete devolver a quem empresta. Não vende partes dela.|Aplicar em dívida~Comprar parte da cidade|A oferta promete pagar um empréstimo, não dar uma parte.|Veja o acordo mesmo quando muda quem pede dinheiro.',
  ]),
]),
teach(d,6,'Default Risk|Una promesa puede incumplirse|Uma promessa pode não ser cumprida',
  'An interest promise is useful only if the borrower can actually make the payment.|Una promesa de intereses sirve solo si el deudor puede realmente pagar.|Uma promessa de juros depende de o devedor conseguir realmente pagar.',
  'A printed fixed payment eliminates borrower default risk.', [
  ex('example-01', 'The borrower matters|El deudor importa|O devedor importa', 'A bond promises payment, but the issuer runs out of money. The promise remains; the investor may receive less.|Un bono promete pagar, pero al emisor se le acaba el dinero. La promesa sigue; el inversionista podría recibir menos.|Um título promete pagar, mas o emissor fica sem dinheiro. A promessa continua; o investidor pode receber menos.'),
  q('guided-01', 'guided', [
    'Which risk appeared?|A bond issuer cannot make the promised interest payment because it lacks funds.|Credit risk~Only a changing resale price|The borrower cannot meet its payment obligation.|Ask whether the borrower can pay.',
    '¿Qué riesgo apareció?|El emisor de un bono no puede pagar los intereses prometidos porque no tiene fondos.|Riesgo de crédito~Solo cambio del precio de reventa|El deudor no puede cumplir su obligación de pago.|Revisa si el deudor puede pagar.',
    'Qual risco apareceu?|O emissor de um título não consegue pagar os juros prometidos por falta de recursos.|Risco de crédito~Só mudança do preço de revenda|O devedor não consegue cumprir sua obrigação de pagamento.|Confira se o devedor consegue pagar.',
  ]),
  q('guided-02', 'guided', [
    'Does fixed mean certain?|A fixed-interest bond’s issuer has stopped paying its debts.|No, fixed describes the terms~Yes, fixed guarantees payment|Fixed terms do not ensure the issuer has money.|Separate the promised amount from the ability to pay.',
    '¿Fijo significa seguro?|El emisor de un bono con interés fijo dejó de pagar sus deudas.|No, fijo describe condiciones~Sí, fijo garantiza el pago|Condiciones fijas no aseguran que el emisor tenga dinero.|Distingue monto prometido de capacidad para pagar.',
    'Fixo significa certo?|O emissor de um título com juros fixos parou de pagar suas dívidas.|Não, fixo descreve condições~Sim, fixo garante pagamento|Condições fixas não garantem recursos ao emissor.|Separe o valor prometido da capacidade de pagar.',
  ]),
  q('practice-01', 'practice', [
    'What deserves investigation?|An issuer offers unusually high interest but has repeated missed payments.|Its ability to meet debt payments~Only the advertised interest~The advertisement’s popularity|Missed payments directly concern the borrower’s reliability.|A larger promise is not proof of stronger repayment.',
    '¿Qué debes investigar?|Un emisor ofrece intereses muy altos, pero acumula pagos incumplidos.|Su capacidad para pagar deudas~Solo el interés anunciado~La popularidad del anuncio|Los incumplimientos afectan directamente la confiabilidad del deudor.|Prometer más no demuestra mayor capacidad de pago.',
    'O que investigar?|Um emissor oferece juros muito altos, mas acumula pagamentos atrasados.|Sua capacidade de pagar dívidas~Só os juros anunciados~A popularidade do anúncio|Atrasos afetam diretamente a confiabilidade do devedor.|Prometer mais não demonstra maior capacidade de pagamento.',
  ]),
  q('practice-02', 'practice', [
    'What can be concluded?|A borrower has paid every past instalment. Its future income is uncertain.|Past payments do not guarantee future ones~Future repayment is guaranteed|A good history does not eliminate future credit risk.|Future resources can differ from past resources.',
    '¿Qué puedes concluir?|Un deudor pagó todas las cuotas anteriores. Sus ingresos futuros son inciertos.|Pagos pasados no garantizan futuros~La devolución futura está garantizada|Un buen historial no elimina el riesgo futuro de crédito.|Los recursos futuros pueden cambiar.',
    'O que se pode concluir?|Um devedor pagou todas as parcelas anteriores. Sua renda futura é incerta.|Pagamentos passados não garantem futuros~A devolução futura está garantida|Um bom histórico não elimina o risco futuro de crédito.|Os recursos futuros podem mudar.',
  ]),
  q('practice-03', 'practice', [
    'Which event is default-related?|A company misses a promised bond payment. Another bond merely receives a lower sale offer.|The missed payment~Only the lower sale offer|Failure to pay concerns the borrower’s obligation.|A resale price movement need not mean missed payment.',
    '¿Qué evento implica incumplimiento?|Una empresa omite el pago prometido de un bono. Otro bono solo recibe una oferta de venta menor.|El pago omitido~Solo la oferta menor|No pagar afecta la obligación del deudor.|Un cambio de precio no implica necesariamente falta de pago.',
    'Qual evento envolve inadimplência?|Uma empresa deixa de pagar um título. Outro título apenas recebe uma oferta menor de compra.|O pagamento não feito~Só a oferta menor|Não pagar afeta a obrigação do devedor.|Uma mudança de preço não implica necessariamente falta de pagamento.',
  ]),
  q('transfer-01', 'transfer', [
    'What weakens repayment?|A project promises repayment from ticket sales. Sales collapse, leaving insufficient cash.|The borrower lacks funds~The promise removes the shortage~The promised repayment date|Lower receipts can prevent the promised debt payment.|Trace the money available to repay the loan.',
    '¿Qué vuelve frágil el plan?|Un proyecto promete devolver un préstamo con ventas de boletos. Las ventas caen y falta efectivo.|El deudor tiene menos capacidad de pago~La promesa elimina el faltante~La fecha prometida de pago|Menos ingresos pueden impedir el pago de deuda prometido.|Sigue el dinero disponible para devolver el préstamo.',
    'O que fragiliza isso?|Um projeto promete devolver um empréstimo com vendas de ingressos. As vendas caem e falta dinheiro.|O devedor tem menor capacidade de pagamento~A promessa elimina a falta~A data prometida de pagamento|Menos receitas podem impedir o pagamento prometido da dívida.|Acompanhe o dinheiro disponível para devolver o empréstimo.',
  ]),
]),
teach(d,7,'Bond Prices|Pago fijo, precio cambiante|Pagamento fixo, preço variável',
  'Selling a bond early exposes you to the price buyers offer at that moment.|Vender un bono antes de su vencimiento te expone al precio que ofrezcan en ese momento.|Vender um título antes do vencimento expõe você ao preço oferecido naquele momento.',
  'A fixed interest payment means the bond has a fixed resale price.', [
  ex('example-01', 'Compare the payments|Compara los pagos|Compare os pagamentos', 'New comparable bonds pay more interest. Buyers may offer less for an older bond whose payments stay unchanged.|Bonos nuevos comparables pagan más intereses. Los compradores pueden ofrecer menos por uno anterior cuyos pagos no cambian.|Títulos novos comparáveis pagam mais juros. Compradores podem oferecer menos por um antigo cujos pagamentos não mudam.'),
  q('guided-01', 'guided', [
    'What pressure?|New bonds offer higher interest with the same term and credit risk. An older bond’s payments stay fixed.|The older bond may sell for less~Its payment automatically increases|Its unchanged payments compete with higher new payments.|Compare equivalent terms and credit risk.',
    '¿Qué presión hay?|Bonos nuevos ofrecen más interés con igual plazo y riesgo de crédito. Los pagos del anterior siguen fijos.|El anterior puede venderse por menos~Su pago aumenta automáticamente|Sus pagos compiten con pagos nuevos más altos.|Compara iguales plazos y riesgo de crédito.',
    'Qual pressão existe?|Títulos novos oferecem mais juros com igual prazo e risco de crédito. Os pagamentos do antigo continuam fixos.|O antigo pode vender por menos~Seu pagamento aumenta automaticamente|Seus pagamentos competem com pagamentos novos mais altos.|Compare prazos e risco de crédito equivalentes.',
  ]),
  q('guided-02', 'guided', [
    'Which part stays fixed?|A fixed-rate bond receives a lower resale offer after market interest rates rise.|Its contractual interest payment~Its resale offer|The contract and the resale market are different.|Fixed interest does not mean fixed resale price.',
    '¿Qué sigue fijo?|Un bono de tasa fija recibe una oferta menor tras subir las tasas de mercado.|Su pago contractual de interés~Su oferta de reventa|El contrato y el mercado de reventa son distintos.|Interés fijo no significa precio de reventa fijo.',
    'O que continua fixo?|Um título de taxa fixa recebe oferta menor após subirem os juros de mercado.|Seu pagamento contratual de juros~Sua oferta de revenda|O contrato e o mercado de revenda são diferentes.|Juros fixos não significam preço de revenda fixo.',
  ]),
  q('practice-01', 'practice', [
    'Does this prove default?|A bond’s resale price falls, but its issuer continues every scheduled payment.|No, price and default differ~Yes, every price fall is default|Market repricing does not itself prove a missed payment.|Check the issuer’s payments separately.',
    '¿Demuestra incumplimiento?|Cae el precio de reventa de un bono, pero el emisor cumple todos los pagos.|No, precio e incumplimiento difieren~Sí, toda caída es incumplimiento|Cambiar de precio no demuestra un pago omitido.|Revisa por separado los pagos del emisor.',
    'Isso comprova inadimplência?|O preço de revenda cai, mas o emissor cumpre todos os pagamentos do título.|Não, preço e inadimplência diferem~Sim, toda queda é inadimplência|Mudar de preço não comprova falta de pagamento.|Confira separadamente os pagamentos do emissor.',
  ]),
  q('practice-02', 'practice', [
    'Which direction is plausible?|Comparable new bonds pay less interest. An older bond keeps its higher fixed payments.|Buyers may offer more for it~Its price must become zero|Higher unchanged payments can make the older bond more attractive.|Compare payments while holding other conditions equal.',
    '¿Qué dirección es posible?|Bonos nuevos comparables pagan menos interés. Uno anterior mantiene pagos fijos mayores.|Pueden ofrecer más por el anterior~Su precio debe volverse cero|Pagos mayores sin cambios pueden volverlo más atractivo.|Compara pagos manteniendo iguales las demás condiciones.',
    'Qual direção é possível?|Títulos novos comparáveis pagam menos juros. Um antigo mantém pagamentos fixos maiores.|Podem oferecer mais pelo antigo~Seu preço deve virar zero|Pagamentos maiores inalterados podem torná-lo mais atraente.|Compare pagamentos mantendo iguais as outras condições.',
  ]),
  q('practice-03', 'practice', [
    'What needs checking?|Someone may need to sell a bond before maturity to cover a planned expense.|Possible resale price~Only the maturity repayment promise|An early sale uses the market price then available.|Match the actual sale date with its price risk.',
    '¿Qué debes revisar?|Una persona podría necesitar vender un bono antes del vencimiento para un gasto planeado.|El posible precio de reventa~Solo la devolución al vencimiento|Una venta anticipada usa el precio disponible entonces.|Relaciona la fecha de venta con su riesgo de precio.',
    'O que conferir?|Alguém pode precisar vender um título antes do vencimento para uma despesa planejada.|O possível preço de revenda~Só a devolução no vencimento|Uma venda antecipada usa o preço disponível naquele momento.|Relacione a data da venda com seu risco de preço.',
  ]),
  q('transfer-01', 'transfer', [
    'Why a lower quote?|A fixed bond pays punctually, but comparable new bonds offer higher interest. Its owner sells early.|Buyers compare payments~The issuer necessarily defaulted~Fixed prevents price changes|Competing interest payments can change an early-sale quote.|Do not confuse payment reliability with market price stability.',
    '¿Por qué cambió la oferta?|Un bono fijo paga puntualmente. Nuevas emisiones comparables ofrecen mejor interés; su dueño necesita vender antes.|Los compradores comparan pagos alternativos~El emisor necesariamente incumplió~Fijo impide cambiar la oferta|Los intereses alternativos pueden cambiar la oferta de venta anticipada.|No confundas cumplimiento de pagos con estabilidad del precio.',
    'Por que mudou a oferta?|Um título fixo paga pontualmente. Emissões novas comparáveis oferecem mais juros; seu dono precisa vender antes.|Compradores comparam pagamentos alternativos~O emissor necessariamente deixou de pagar~Fixo impede mudar a oferta|Juros alternativos podem mudar a oferta de venda antecipada.|Não confunda pagamentos pontuais com estabilidade de preço.',
  ]),
]),
teach(d,8,'Shared Exposure|Nombres distintos, riesgo común|Nomes diferentes, risco comum',
  'Several investments can all depend on the same source of income.|Varias inversiones pueden depender de la misma fuente de ingresos.|Vários investimentos podem depender da mesma fonte de renda.',
  'Counting account names or securities proves diversification without examining their exposures.', [
  ex('example-01', 'Follow the dependence|Sigue la dependencia|Siga a dependência', 'Hotel shares and an airport business both depend on tourism. A travel collapse can hurt both despite different names.|Acciones de hoteles y un negocio aeroportuario dependen del turismo. Una caída de viajes puede afectar ambos pese a nombres distintos.|Ações de hotéis e um negócio aeroportuário dependem do turismo. Uma queda das viagens pode afetar ambos apesar dos nomes diferentes.'),
  q('guided-01', 'guided', [
    'Which common risk?|A portfolio owns a resort and a cruise operator. Both rely on holiday travel.|Fewer travelers~Their different company sizes|Both businesses depend on travel demand.|Look through the names to their customers.',
    '¿Qué riesgo comparten?|Una cartera tiene un hotel turístico y una operadora de cruceros. Ambos dependen de viajes vacacionales.|Menos viajeros~Sus distintos tamaños de empresa|Ambos negocios dependen de la demanda de viajes.|Mira sus clientes, no solo los nombres.',
    'Qual risco compartilham?|Uma carteira tem um resort e uma operadora de cruzeiros. Ambos dependem de viagens de férias.|Menos viajantes~Seus diferentes tamanhos de empresa|Ambos os negócios dependem da demanda por viagens.|Observe os clientes, não só os nomes.',
  ]),
  q('guided-02', 'guided', [
    'Did exposure change?|Someone buys the same company’s shares through two different apps.|No, the company exposure remains~Yes, two apps mean two businesses|Different apps can hold the identical underlying investment.|Inspect what is owned inside each account.',
    '¿Cambió la exposición?|Alguien compra acciones de la misma empresa mediante dos aplicaciones.|No, depende de la misma empresa~Sí, dos aplicaciones son dos negocios|Aplicaciones distintas pueden guardar la misma inversión.|Revisa qué posee cada cuenta.',
    'A exposição mudou?|Alguém compra ações da mesma empresa por dois aplicativos.|Não, depende da mesma empresa~Sim, dois aplicativos são dois negócios|Aplicativos diferentes podem guardar o mesmo investimento.|Confira o que cada conta possui.',
  ]),
  q('practice-01', 'practice', [
    'Which household is concentrated?|A worker’s income and almost all investments depend on the same employer.|That worker’s household~Neither, wages are not shares|One employer’s trouble could affect both income and investments.|Consider linked risks beyond the investment account.',
    '¿Qué hogar está concentrado?|El ingreso laboral y casi todas las inversiones dependen del mismo empleador.|El de esa persona~Ninguno, salario no es acción|Problemas del empleador podrían afectar ingresos e inversiones.|Considera riesgos conectados fuera de la cuenta de inversión.',
    'Qual família está concentrada?|A renda do trabalho e quase todos os investimentos dependem do mesmo empregador.|A dessa pessoa~Nenhuma, salário não é ação|Problemas do empregador podem afetar renda e investimentos.|Considere riscos ligados fora da conta de investimentos.',
  ]),
  q('practice-02', 'practice', [
    'What should be inspected?|Three differently named funds may hold many of the same companies.|Their underlying holdings~Only the fund count~Only past fund returns|Overlapping holdings can preserve concentration across several funds.|Count distinct exposures, not product labels.',
    '¿Qué debes inspeccionar?|Tres fondos con nombres distintos podrían tener muchas de las mismas empresas.|Sus inversiones subyacentes~Solo cuántos fondos hay~Solo rendimientos pasados|Coincidir en inversiones puede mantener la concentración entre fondos.|Cuenta exposiciones distintas, no etiquetas.',
    'O que inspecionar?|Três fundos com nomes diferentes podem ter muitas das mesmas empresas.|Seus investimentos subjacentes~Só quantos fundos existem~Só retornos passados|Investimentos coincidentes podem manter concentração entre fundos.|Conte exposições distintas, não rótulos.',
  ]),
  q('practice-03', 'practice', [
    'Which risk remains?|A portfolio holds several unrelated industries, but all revenue comes from one small town.|A shared local shock~No shared risk can remain|Different industries can still share one geographic dependence.|Look for more than one source of concentration.',
    '¿Qué riesgo queda?|Una cartera tiene industrias diferentes, pero todos sus ingresos vienen de una localidad pequeña.|Un problema local común~No puede quedar riesgo común|Industrias distintas pueden compartir dependencia geográfica.|Busca más de una fuente de concentración.',
    'Qual risco permanece?|Uma carteira tem setores diferentes, mas toda receita vem de uma cidade pequena.|Um problema local comum~Não pode restar risco comum|Setores diferentes podem compartilhar dependência geográfica.|Procure mais de uma fonte de concentração.',
  ]),
  q('transfer-01', 'transfer', [
    'Where is the link?|A delivery business and a packaging supplier earn nearly everything from the same retailer.|Their shared main customer~Their different products eliminate dependence~Their separate bank accounts|One customer’s failure could damage both businesses.|Follow the revenue source behind each business.',
    '¿Dónde está la conexión?|Una empresa de reparto y un proveedor de empaques reciben casi todos sus ingresos del mismo comercio.|Su cliente principal compartido~Sus productos distintos eliminan dependencia~Sus cuentas bancarias separadas|La caída de un cliente podría dañar ambos negocios.|Sigue la fuente de ingresos de cada negocio.',
    'Onde está a ligação?|Uma transportadora e um fornecedor de embalagens recebem quase toda receita da mesma loja.|Seu principal cliente comum~Produtos diferentes eliminam dependência~Suas contas bancárias separadas|A quebra de um cliente pode prejudicar ambos os negócios.|Siga a fonte de receita de cada negócio.',
  ]),
]),
teach(d,9,'Diversify Exposure|Distribuye el riesgo con perspectiva|Distribua o risco com perspectiva',
  'Spreading exposure can soften a specific shock without making every investment safe.|Distribuir la exposición puede suavizar un problema específico sin volver segura toda inversión.|Distribuir a exposição pode suavizar um problema específico sem tornar seguro todo investimento.',
  'Diversification prevents any portfolio loss or every holding must gain together.', [
  ex('example-01', 'Compare the same shock|Compara el mismo problema|Compare o mesmo problema', 'A crop disease hits farm shares. A portfolio containing unrelated businesses has less direct exposure than one holding only farms.|Una enfermedad afecta cultivos. Una cartera con otros negocios tiene menos exposición directa que otra compuesta solo por granjas.|Uma doença atinge plantações. Uma carteira com outros negócios tem menos exposição direta que outra composta só por fazendas.'),
  q('guided-01', 'guided', [
    'Which is more exposed?|A shock hits airlines only. A holds only airlines; B holds airlines and unrelated businesses.|Portfolio A~Both must be identical|Every holding in A directly faces the specified shock.|Apply the same stated shock to each portfolio.',
    '¿Cuál está más expuesta?|Un problema afecta solo aerolíneas. A tiene solo aerolíneas; B combina aerolíneas y negocios no relacionados.|La cartera A~Ambas deben ser iguales|Todas las inversiones de A enfrentan directamente ese problema.|Aplica el mismo problema indicado a cada cartera.',
    'Qual fica mais exposta?|Um problema atinge só aéreas. A tem só aéreas; B tem aéreas e outros negócios sem ligação.|A carteira A~Ambas devem ser iguais|Tudo em A sofre com esse mesmo problema.|Use o mesmo problema nas duas carteiras.',
  ]),
  q('guided-02', 'guided', [
    'What is not promised?|A portfolio spreads money across industries instead of relying on one.|That it can never lose~Less reliance on one industry|Spreading exposure does not eliminate all loss possibilities.|Reduced concentration is different from a guarantee.',
    '¿Qué no se promete?|Una cartera distribuye dinero entre industrias en lugar de depender de una.|Que nunca perderá~Menor dependencia de una industria|Distribuir exposición no elimina todas las posibles pérdidas.|Reducir concentración es distinto de garantizar.',
    'O que não é prometido?|Uma carteira divide dinheiro entre setores em vez de apostar só em um.|Que nunca perderá~Depender menos de um setor|Dividir o risco não impede toda perda possível.|Reduzir um risco não é dar uma garantia.',
  ]),
  q('practice-01', 'practice', [
    'What about a broad shock?|A downturn affects many industries at once, including a diversified portfolio.|Several holdings may fall together~Diversification forbids any loss|A broad shock can affect different holdings simultaneously.|Diversification reduces some risks, not every shared risk.',
    '¿Y un problema general?|Una caída económica afecta varias industrias, incluidas las de una cartera diversificada.|Varias inversiones pueden caer juntas~Diversificar prohíbe toda pérdida|Un problema amplio puede afectar inversiones distintas simultáneamente.|Diversificar reduce ciertos riesgos, no todo riesgo compartido.',
    'E uma crise geral?|Uma crise afeta vários setores. A carteira tem vários desses setores.|Vários ativos podem cair juntos~Dividir impede toda perda|Uma crise ampla pode atingir muitos ativos ao mesmo tempo.|Dividir reduz certos riscos, não todos.',
  ]),
  q('practice-02', 'practice', [
    'Which comparison is fair?|To test diversification, two portfolios are modeled under different unrelated shocks.|Use the same shock for both~Compare without changing anything|Different shocks obscure the effect of the portfolio mix.|Hold the shock constant when comparing exposure.',
    '¿Qué comparación es justa?|Para probar diversificación, modelan dos carteras bajo problemas distintos sin relación.|Usar el mismo problema para ambas~Comparar sin cambiar nada|Problemas distintos ocultan el efecto de la combinación.|Mantén igual el problema al comparar exposición.',
    'Qual teste é justo?|Querem comparar duas carteiras, mas usam crises bem diferentes em cada teste.|Usar a mesma crise nas duas~Comparar sem mudar nada|Crises diferentes escondem o efeito da escolha de ativos.|Use a mesma crise ao comparar o risco.',
  ]),
  q('practice-03', 'practice', [
    'What actually changed?|Someone adds another tourism company to a portfolio already entirely dependent on tourism.|The name count, not the common dependence~The tourism dependence vanished|Another name need not reduce the shared industry exposure.|Inspect the new holding’s actual source of risk.',
    '¿Qué cambió realmente?|Agregan otra empresa turística a una cartera que ya depende por completo del turismo.|La cantidad de nombres, no la dependencia~Desapareció la dependencia turística|Otro nombre no necesariamente reduce la exposición al mismo sector.|Inspecciona la fuente real de riesgo de lo agregado.',
    'O que mudou?|Uma carteira só tem turismo. Acrescentam mais uma empresa de turismo.|Mais nomes, o mesmo setor~O risco de turismo sumiu|Outro nome não reduz por si só o risco comum.|Confira de onde vem o risco do novo ativo.',
  ]),
  q('transfer-01', 'transfer', [
    'Which limits exposure?|A factory closes. Portfolio A depends entirely on it; B includes unrelated outside businesses.|B reduces direct dependence~B guarantees gains~Both depend equally|Outside businesses reduce direct dependence on the closing factory.|Choose reduced exposure without inventing a guarantee.',
    '¿Qué plan limita este problema?|Cierra una fábrica local. A depende solo de ella; B incluye negocios externos sin relación.|B limita la exposición directa~B garantiza rendimiento positivo~A y B dependen igual|Otros negocios reducen la dependencia directa de la fábrica.|Elige menor exposición sin inventar una garantía.',
    'Qual plano reduz esse risco?|Uma fábrica fecha. A depende só dela; B tem outros negócios de fora, sem ligação.|B depende menos da fábrica~B garante lucro~A e B dependem igual|Outros negócios reduzem o risco ligado à fábrica.|Escolha menos risco sem inventar uma garantia.',
  ]),
]),
teach(d,10,'Fund Holdings|Mira dentro del fondo|Olhe dentro do fundo',
  'A fund is a way to hold investments together; its contents determine much of its risk.|Un fondo reúne inversiones; lo que contiene determina gran parte de su riesgo.|Um fundo reúne investimentos; seu conteúdo determina grande parte do risco.',
  'The word fund identifies the underlying assets or guarantees broad diversification.', [
  ex('example-01', 'Container and contents|Recipiente y contenido|Recipiente e conteúdo', 'A fund pools investors’ money to hold assets. A bond fund and a share fund can contain very different risks.|Un fondo reúne dinero de inversionistas para tener activos. Un fondo de bonos y otro de acciones pueden tener riesgos distintos.|Um fundo reúne dinheiro de investidores para manter ativos. Um fundo de títulos e outro de ações podem ter riscos diferentes.'),
  q('guided-01', 'guided', [
    'What does the fund hold?|A fictional fund owns shares in food companies. Investors buy units in that fund.|Company shares underneath~Only cash because it is a fund|The fund’s units represent pooled exposure to its holdings.|Read the contents, not just the container’s name.',
    '¿Qué tiene el fondo?|Un fondo ficticio posee acciones de empresas de alimentos. Compran participaciones del fondo.|Acciones de empresas dentro~Solo efectivo por ser fondo|Las participaciones dan exposición conjunta a lo que contiene.|Lee el contenido, no solo el nombre del recipiente.',
    'O que o fundo possui?|Um fundo fictício possui ações de empresas de alimentos. Investidores compram cotas do fundo.|Ações de empresas dentro~Só dinheiro porque é fundo|As cotas dão exposição conjunta ao que ele possui.|Leia o conteúdo, não só o nome do recipiente.',
  ]),
  q('guided-02', 'guided', [
    'Which information matters?|Two products are called funds. One owns short-term debt; another owns shares in one industry.|Their underlying assets~Only the shared word fund|The contents create different exposures despite the shared label.|Inspect what each fund actually holds.',
    '¿Qué información importa?|Dos productos se llaman fondos. Uno tiene deuda de corto plazo; otro, acciones de una sola industria.|Sus activos subyacentes~Solo la palabra fondo|El contenido genera exposiciones distintas pese a compartir etiqueta.|Inspecciona qué tiene realmente cada fondo.',
    'Qual informação importa?|Dois produtos são chamados fundos. Um tem dívida de curto prazo; outro, ações de um setor.|Seus ativos subjacentes~Só a palavra fundo|O conteúdo gera exposições diferentes apesar do nome comum.|Inspecione o que cada fundo realmente possui.',
  ]),
  q('practice-01', 'practice', [
    'Is it broadly spread?|A fund holds many companies, all producing the same commodity.|Not necessarily, one exposure dominates~Yes, every fund is diversified|Many holdings can still share one concentrated risk.|Check shared dependencies among the holdings.',
    '¿Está ampliamente distribuido?|Un fondo tiene muchas empresas que producen la misma materia prima.|No necesariamente, domina una exposición~Sí, todo fondo está diversificado|Muchas inversiones pueden compartir un riesgo concentrado.|Revisa dependencias comunes entre sus inversiones.',
    'Está amplamente distribuído?|Um fundo tem muitas empresas que produzem a mesma matéria-prima.|Não necessariamente, uma exposição domina~Sim, todo fundo é diversificado|Muitos investimentos podem compartilhar um risco concentrado.|Confira dependências comuns entre os investimentos.',
  ]),
  q('practice-02', 'practice', [
    'Where could losses originate?|A pooled fund owns borrowers’ bonds. Some borrowers cannot repay.|From the underlying bonds~Funds cannot reflect borrower losses|Underlying asset losses can affect the fund’s investors.|Pooling does not remove the assets’ risks.',
    '¿De dónde vendrían pérdidas?|Un fondo posee bonos de deudores. Algunos no pueden devolver el dinero.|De los bonos subyacentes~Un fondo no refleja pérdidas de deudores|Pérdidas subyacentes pueden afectar a quienes invierten en el fondo.|Reunir activos no elimina sus riesgos.',
    'De onde viriam perdas?|Um fundo possui títulos de devedores. Alguns não conseguem devolver o dinheiro.|Dos títulos subjacentes~Fundos não refletem perdas de devedores|Perdas subjacentes podem afetar quem investe no fundo.|Reunir ativos não elimina seus riscos.',
  ]),
  q('practice-03', 'practice', [
    'What does a unit mean?|A learner buys a unit of a fund containing many holdings.|A participation in the pool~Direct ownership of every company entirely|A fund unit is participation in the pooled investment.|One unit does not mean owning whole underlying companies.',
    '¿Qué representa la participación?|Una persona compra una participación de un fondo con varias inversiones.|Participación en el conjunto~Propiedad completa de cada empresa|La participación corresponde a la inversión conjunta del fondo.|Una participación no equivale a poseer empresas completas.',
    'O que representa a cota?|Uma pessoa compra uma cota de um fundo com vários investimentos.|Participação no conjunto~Propriedade completa de cada empresa|A cota corresponde à participação no investimento conjunto.|Uma cota não equivale a possuir empresas inteiras.',
  ]),
  q('transfer-01', 'transfer', [
    'What should be checked?|A product’s name suggests global variety. Its document shows nearly all holdings in one sector.|Actual holdings~The reassuring name~The latest annual return|The documented holdings contradict the impression of broad exposure.|Use the contents to evaluate the product’s label.',
    '¿Qué revisas primero?|El nombre sugiere variedad mundial. El documento dice que casi todas sus inversiones dependen de un sector.|Las inversiones reales y concentración~Solo el nombre tranquilizador~El último rendimiento anual|Las inversiones documentadas contradicen la impresión de exposición amplia.|Usa el contenido para evaluar la etiqueta.',
    'O que conferir primeiro?|O nome sugere variedade mundial. O documento diz que quase todos os investimentos dependem de um setor.|Os investimentos reais e a concentração~Só o nome tranquilizador~O último retorno anual|Os investimentos documentados contradizem a impressão de exposição ampla.|Use o conteúdo para avaliar o rótulo.',
  ]),
]),
teach(d,11,'Access Conditions|El acceso tiene condiciones|O acesso tem condições',
  'A balance shown on a screen is not always money you can withdraw when needed.|Un saldo mostrado en pantalla no siempre es dinero que puedas retirar cuando lo necesites.|Um saldo exibido na tela nem sempre é dinheiro que você pode sacar quando precisa.',
  'A displayed investment balance guarantees immediate withdrawal without penalty or a buyer.', [
  ex('example-01', 'Match the access date|Relaciona la fecha de acceso|Relacione a data de acesso', 'An account unlocks next month, but the repair bill is due tomorrow. Its balance cannot cover tomorrow’s payment through withdrawal.|Una cuenta se libera el próximo mes, pero la reparación vence mañana. Retirarla no puede cubrir el pago de mañana.|Uma conta libera saques no próximo mês, mas o conserto vence amanhã. Sacá-la não pode cobrir o pagamento de amanhã.'),
  q('guided-01', 'guided', [
    'Does the access date fit?|Money is needed Friday. The fictional investment permits withdrawal only next month.|No, withdrawal comes too late~Yes, the balance is large|A sufficient balance is useless before its permitted access date.|Compare the need date with the withdrawal date.',
    '¿Coincide la fecha de acceso?|El dinero se necesita el viernes. La inversión ficticia permite retirar hasta el próximo mes.|No, el retiro llega tarde~Sí, el saldo es grande|Un saldo suficiente no sirve antes de poder acceder.|Compara la fecha necesaria con la de retiro.',
    'A data de acesso serve?|O dinheiro é necessário sexta. O investimento fictício permite sacar só no próximo mês.|Não, o saque chega tarde~Sim, o saldo é grande|Um saldo suficiente não serve antes do acesso permitido.|Compare a data necessária com a do saque.',
  ]),
  q('guided-02', 'guided', [
    'What must be checked?|A product allows early withdrawal with a fee. Its full balance exactly equals the required bill.|The amount after the fee~Only the displayed balance|An early-withdrawal fee can leave a payment shortfall.|Available money means what actually reaches you.',
    '¿Qué debes revisar?|Un producto permite retirar antes con comisión. Su saldo completo coincide exactamente con la cuenta a pagar.|El monto después de la comisión~Solo el saldo mostrado|La comisión por retirar antes puede dejar un faltante.|Dinero disponible es lo que realmente recibes.',
    'O que conferir?|Um produto permite saque antecipado com tarifa. Seu saldo integral equivale exatamente à conta necessária.|O valor após a tarifa~Só o saldo exibido|A tarifa por saque antecipado pode deixar uma falta.|Dinheiro disponível é o que você realmente recebe.',
  ]),
  q('practice-01', 'practice', [
    'Which condition blocks access?|A private holding can be sold only if a buyer is found. No buyer is currently available.|The need for a buyer~Its attractive historical return|A sale cannot provide cash without a buyer.|Value estimates do not ensure a completed sale.',
    '¿Qué condición bloquea el acceso?|Una inversión privada solo se vende si hay comprador. Actualmente no hay ninguno.|Necesitar un comprador~Su atractivo rendimiento pasado|Una venta no entrega efectivo sin comprador.|Estimar valor no asegura completar una venta.',
    'Qual condição bloqueia acesso?|Uma participação privada só pode ser vendida se houver comprador. Atualmente não há nenhum.|Precisar de um comprador~Seu rendimento passado atraente|Uma venda não entrega dinheiro sem comprador.|Estimar valor não garante concluir uma venda.',
  ]),
  q('practice-02', 'practice', [
    'Is selling receiving?|An order sells today. The stated settlement rule delivers cash after the bill deadline.|No, settlement timing matters~Yes, selling pays the bill|Completed trading need not mean immediately withdrawable cash.|Use the stated date money becomes available.',
    '¿Vender equivale a tener efectivo?|Una orden vende hoy, pero la liquidación indicada entrega dinero después del vencimiento de la cuenta.|No, importa cuándo se liquida~Sí, el botón paga la cuenta|Vender no necesariamente deja efectivo retirable de inmediato.|Usa la fecha indicada de disponibilidad del dinero.',
    'Vender equivale a ter dinheiro?|Uma ordem vende hoje, mas a liquidação informada entrega dinheiro depois do vencimento da conta.|Não, importa quando liquida~Sim, o botão paga a conta|Vender não necessariamente libera saque imediato.|Use a data informada de disponibilidade do dinheiro.',
  ]),
  q('practice-03', 'practice', [
    'Which product fits this constraint?|Funds must be accessible tomorrow without penalty. A meets that condition; B unlocks later.|A meets the access constraint~B because waiting always pays more|A satisfies the stated timing and penalty conditions.|Judge the stated need, not an imagined return.',
    '¿Qué producto cumple?|El dinero debe estar accesible mañana sin penalización. A cumple; B se libera después.|A cumple la condición de acceso~B porque esperar siempre paga más|A cumple las condiciones indicadas de tiempo y penalización.|Evalúa la necesidad indicada, no ganancias imaginadas.',
    'Qual produto atende?|O dinheiro precisa estar acessível amanhã sem multa. A atende; B libera depois.|A atende à condição de acesso~B porque esperar sempre rende mais|A atende às condições informadas de prazo e multa.|Avalie a necessidade informada, não ganhos imaginados.',
  ]),
  q('transfer-01', 'transfer', [
    'Will money arrive?|A deposit is due tomorrow. The stated withdrawal delay is one week.|No, access comes late~Yes, requesting means receiving~Yes, the balance covers it|The request does not deliver money by tomorrow.|Check when the money arrives, not just when requested.',
    '¿Puede cubrir el plazo?|Un depósito escolar vence mañana. Según las reglas, solicitar hoy un retiro requiere una semana completa.|No, la demora contradice el plazo~Sí, solicitar equivale a recibir~Sí, el saldo alcanza|La solicitud no entrega el dinero para mañana.|Revisa cuándo llega el dinero, no solo cuándo lo pides.',
    'Pode atender ao prazo?|Um depósito escolar vence amanhã. Pelas regras, solicitar hoje um saque exige uma semana completa.|Não, a demora conflita com o prazo~Sim, solicitar equivale a receber~Sim, o saldo basta|A solicitação não entrega dinheiro até amanhã.|Confira quando chega o dinheiro, não só quando solicita.',
  ]),
]),
teach(d,12,'Custody Protection|Custodia no garantiza rendimiento|Custódia não garante rendimento',
  'Who holds an investment and whether its market value can fall are different questions.|Quién guarda una inversión y si puede bajar de valor son preguntas distintas.|Quem guarda um investimento e se ele pode perder valor são perguntas diferentes.',
  'A regulated custodian guarantees that market investments cannot lose value.', [
  ex('example-01', 'Separate the protections|Distingue las protecciones|Separe as proteções', 'A verified custodian holds shares correctly. Their market price can still fall; custody and market returns are separate questions.|Un custodio verificado guarda correctamente acciones. Su precio puede bajar; custodia y rendimiento de mercado son preguntas distintas.|Um custodiante verificado guarda ações corretamente. Seu preço pode cair; custódia e rendimento de mercado são questões diferentes.'),
  q('guided-01', 'guided', [
    'What does custody describe?|An institution records and holds the learner’s securities. Their market prices fluctuate.|Who safeguards the holdings~A guaranteed investment gain|Custody concerns holding assets, not guaranteeing their market performance.|Separate asset handling from price movements.',
    '¿Qué describe custodia?|Una institución registra y guarda los títulos. Sus precios de mercado fluctúan.|Quién resguarda las inversiones~Una promesa de utilidad|La custodia trata del resguardo, no de garantizar rendimiento.|Distingue el manejo de activos de sus precios.',
    'O que descreve custódia?|Uma instituição registra e guarda os títulos. Seus preços de mercado oscilam.|Quem guarda os investimentos~Um ganho garantido|Custódia trata de guardar ativos, não garantir rendimento.|Separe o manejo dos ativos de seus preços.',
  ]),
  q('guided-02', 'guided', [
    'Does registration prove this?|A seller cites a provider’s registration as proof shares cannot fall.|No, registration does not fix prices~Yes, registration guarantees gains|A verified provider can hold investments with market risk.|Check what the registration actually covers.',
    '¿El registro demuestra esto?|Un vendedor cita el registro de un proveedor como prueba de que las acciones no pueden bajar.|No, registrarse no fija precios~Sí, el registro garantiza ganancias|Un proveedor verificado puede guardar inversiones con riesgo de mercado.|Revisa qué cubre realmente el registro.',
    'O registro comprova isso?|Um vendedor cita o registro do prestador como prova de que ações não podem cair.|Não, registro não fixa preços~Sim, registro garante ganhos|Um prestador verificado pode guardar investimentos com risco de mercado.|Confira o que o registro realmente cobre.',
  ]),
  q('practice-01', 'practice', [
    'Which question remains?|The custodian’s identity has been independently verified. An offer promises unusually high guaranteed returns.|What supports the return claim~Nothing, identity settles returns|Verified identity does not validate every performance claim.|Evaluate the specific promise separately.',
    '¿Qué pregunta queda?|Verificaron independientemente al custodio. Una oferta promete rendimientos garantizados muy altos.|Qué respalda la promesa de rendimiento~Nada, la identidad resuelve todo|Verificar identidad no valida todas las promesas de rendimiento.|Evalúa por separado la promesa específica.',
    'Qual pergunta permanece?|Verificaram independentemente o custodiante. Uma oferta promete rendimentos garantidos muito altos.|O que sustenta a promessa de rendimento~Nada, a identidade resolve tudo|Verificar identidade não valida todas as promessas de rendimento.|Avalie separadamente a promessa específica.',
  ]),
  q('practice-02', 'practice', [
    'Which event is market risk?|Securities remain correctly recorded, but buyers now offer less for them.|The lower market price~An automatically missing asset|Correct custody can coexist with a fall in market value.|Do not infer missing assets from lower prices alone.',
    '¿Qué evento es riesgo de mercado?|Los títulos siguen registrados correctamente, pero ahora ofrecen menos por ellos.|El precio de mercado menor~Un activo automáticamente desaparecido|Una custodia correcta puede coexistir con menor valor de mercado.|Un precio menor no demuestra por sí solo activos desaparecidos.',
    'Qual evento é risco de mercado?|Os títulos continuam registrados corretamente, mas agora oferecem menos por eles.|O preço de mercado menor~Um ativo automaticamente desaparecido|Custódia correta pode coexistir com menor valor de mercado.|Preço menor sozinho não comprova ativos desaparecidos.',
  ]),
  q('practice-03', 'practice', [
    'Which protection needs checking?|An advertisement claims “protected.” It does not specify assets, events or limits.|The exact protection’s scope~Assume all losses are covered|An unspecified protection claim cannot establish coverage.|Ask what is covered, under which conditions.',
    '¿Qué protección verificas?|Un anuncio dice «protegido», sin especificar activos, eventos ni límites.|El alcance exacto de la protección~Suponer cubiertas todas las pérdidas|Una protección sin especificar no establece cobertura.|Pregunta qué cubre y bajo qué condiciones.',
    'Qual proteção conferir?|Um anúncio diz “protegido”, sem especificar ativos, eventos ou limites.|O alcance exato da proteção~Supor cobertas todas as perdas|Uma proteção não especificada não estabelece cobertura.|Pergunte o que cobre e sob quais condições.',
  ]),
  q('transfer-01', 'transfer', [
    'Which conclusion fits?|A recognized institution safely holds a fund concentrated in a volatile industry.|The fund can still lose market value~Recognition guarantees the fund’s return~Custody removes industry risk|Reliable custody does not remove the fund’s industry exposure.|Evaluate both the institution and the assets held.',
    '¿Qué conclusión es válida?|Una institución reconocida custodia un fondo concentrado en una industria volátil.|El fondo aún puede perder valor~El reconocimiento garantiza rendimiento~La custodia elimina riesgo sectorial|Una custodia confiable no elimina la exposición del fondo.|Evalúa la institución y los activos que guarda.',
    'Qual conclusão é válida?|Uma instituição reconhecida guarda um fundo concentrado num setor volátil.|O fundo ainda pode perder valor~O reconhecimento garante rendimento~A custódia elimina risco setorial|Custódia confiável não elimina a exposição do fundo.|Avalie a instituição e os ativos que guarda.',
  ]),
]),
teach(d,13,'Borrowed Exposure|Pedir prestado amplía la exposición|Pegar emprestado amplia a exposição',
  'A falling investment can leave both a smaller asset and a loan still owed.|Una inversión que cae puede dejar un activo menor y un préstamo todavía pendiente.|Um investimento em queda pode deixar um ativo menor e um empréstimo ainda devido.',
  'Borrowing to invest increases only possible gains, while losses remain limited to cash contributed.', [
  ex('example-01', 'The loan remains|El préstamo sigue|O empréstimo continua', 'Borrowing increases the investment bought with your cash. A price fall reduces the asset but does not cancel the loan.|Pedir prestado aumenta lo invertido con tu efectivo. Una caída reduce el activo, pero no cancela el préstamo.|Pegar emprestado aumenta o investimento comprado com seu dinheiro. Uma queda reduz o ativo, mas não cancela o empréstimo.'),
  q('guided-01', 'guided', [
    'What survives the loss?|Someone borrows to buy shares. The shares fall in value; the loan contract is unchanged.|The debt still requires repayment~The share loss cancels the loan|The asset price and the repayment obligation are separate.|A lender does not automatically share the investment loss.',
    '¿Qué sigue tras perder?|Alguien pide prestado para comprar acciones. Las acciones bajan; el contrato del préstamo no cambia.|La deuda sigue exigiendo devolución~La caída cancela el préstamo|El precio del activo y la obligación de devolver son distintos.|El prestamista no comparte automáticamente la pérdida de inversión.',
    'O que permanece após perder?|Alguém pega empréstimo para comprar ações. Elas caem; o contrato do empréstimo não muda.|A dívida ainda exige devolução~A queda cancela o empréstimo|O preço do ativo e a obrigação de devolver são diferentes.|O credor não compartilha automaticamente a perda do investimento.',
  ]),
  q('guided-02', 'guided', [
    'Why amplify loss?|Two people contribute equal cash. One borrows extra for more of the same falling asset.|More exposure against equal own cash~Debt stabilizes prices|Borrowing increases exposure relative to the investor’s own money.|Compare exposure with the cash the investor contributed.',
    '¿Por qué amplifica la pérdida?|Dos personas aportan igual efectivo. Una pide prestado para comprar más del mismo activo que cae.|Cae más exposición contra igual dinero propio~La deuda estabiliza el precio|Pedir prestado aumenta exposición respecto al dinero propio.|Compara exposición con el efectivo que aportó la persona.',
    'Por que amplia a perda?|Duas pessoas aportam igual dinheiro. Uma toma empréstimo para comprar mais do mesmo ativo em queda.|Cai maior exposição contra igual dinheiro próprio~A dívida estabiliza o preço|Pegar emprestado aumenta exposição em relação ao dinheiro próprio.|Compare exposição com o dinheiro aportado pela pessoa.',
  ]),
  q('practice-01', 'practice', [
    'If proceeds fall short?|A borrowed investment is sold for less than the outstanding loan, under an ordinary full-repayment contract.|A debt remains after selling~Selling automatically clears every debt|The sale does not cover the full repayment obligation.|Compare the sale proceeds with the debt owed.',
    '¿Y si la venta no alcanza?|Venden una inversión por menos que el préstamo pendiente, cuyo contrato exige devolverlo completo.|Queda deuda después de vender~Vender elimina automáticamente toda deuda|La venta no cubre toda la obligación de devolución.|Compara lo recibido por vender con la deuda.',
    'E se a venda não bastar?|Vendem uma aplicação por menos que o empréstimo pendente, cujo contrato exige devolução integral.|Resta dívida após vender~Vender elimina automaticamente toda dívida|A venda não cobre toda a obrigação de devolução.|Compare o valor da venda com a dívida.',
  ]),
  q('practice-02', 'practice', [
    'What additional cost matters?|A loan used for investing charges interest while the investment pays nothing.|Loan interest still accrues as contracted~Interest pauses automatically|Investment income is not required for loan interest to accrue.|Read the borrowing terms independently of investment results.',
    '¿Qué costo adicional importa?|El préstamo para invertir cobra intereses mientras la inversión no paga nada.|Siguen intereses según el contrato~Los intereses se pausan automáticamente|El interés del préstamo no depende de recibir ingresos de inversión.|Lee las condiciones del préstamo aparte del resultado.',
    'Qual custo adicional importa?|O empréstimo para investir cobra juros enquanto a aplicação não paga nada.|Continuam juros conforme o contrato~Os juros pausam automaticamente|Juros do empréstimo não dependem de receber rendimento da aplicação.|Leia as condições do empréstimo separadas do resultado.',
  ]),
  q('practice-03', 'practice', [
    'Which promise is false?|A seller says borrowed investing magnifies gains but cannot magnify losses.|The claim about losses~The existence of borrowing|Borrowing can magnify losses as well as gains.|Examine what happens when the asset price falls.',
    '¿Qué promesa es falsa?|Un vendedor dice que invertir con deuda amplía ganancias, pero no puede ampliar pérdidas.|La afirmación sobre pérdidas~La existencia del préstamo|Pedir prestado puede ampliar pérdidas además de ganancias.|Examina qué pasa cuando baja el precio del activo.',
    'Qual promessa é falsa?|Um vendedor diz que investir com dívida amplia ganhos, mas não pode ampliar perdas.|A afirmação sobre perdas~A existência do empréstimo|Pegar emprestado pode ampliar perdas além de ganhos.|Examine o que ocorre quando o preço do ativo cai.',
  ]),
  q('transfer-01', 'transfer', [
    'What risk remains?|A collectible bought with a loan loses most resale value. Repayment remains due.|Debt can exceed remaining value~Falling collectibles cancel debt~Only original price matters|Borrowing risk remains even outside shares and bonds.|Follow the repayment obligation after the asset loses value.',
    '¿Qué considerar?|Compran un objeto de colección con un préstamo. Pierde casi todo su valor de reventa; la devolución sigue pendiente.|La deuda puede superar el valor restante~Las caídas de objetos cancelan deuda~Solo importa el precio original|El riesgo de deuda existe fuera de acciones y bonos.|Sigue la obligación de devolución tras perder valor.',
    'O que considerar?|Compram um item de coleção com empréstimo. Ele perde quase todo valor de revenda; a devolução continua pendente.|A dívida pode superar o valor restante~Quedas de objetos cancelam dívidas~Só importa o preço original|O risco da dívida existe fora de ações e títulos.|Acompanhe a obrigação de devolver após a perda de valor.',
  ]),
]),
teach(d,14,'Past Performance|Ganancias pasadas no protegen|Ganhos passados não protegem',
  'A recent price jump tells you what happened, not what your money is guaranteed to do next.|Una subida reciente dice qué ocurrió, no qué hará tu dinero con certeza después.|Uma alta recente conta o que aconteceu, não o que seu dinheiro fará com certeza depois.',
  'Recent gains, popularity or excitement demonstrate safety of a speculative asset.', [
  ex('example-01', 'Price hopes are uncertain|Esperar subidas es incierto|Esperar altas é incerto', 'A token rose yesterday. Buying solely because someone else may pay more tomorrow is speculation, not evidence of safety.|Un token subió ayer. Comprar solo esperando que alguien pague más mañana es especulación, no prueba de seguridad.|Um token subiu ontem. Comprar só esperando que alguém pague mais amanhã é especulação, não prova de segurança.'),
  q('guided-01', 'guided', [
    'What does yesterday prove?|An asset doubled yesterday. No reliable evidence establishes tomorrow’s price.|Only what happened yesterday~That tomorrow must rise|A past price change does not guarantee the next one.|Separate an observation from a prediction.',
    '¿Qué demuestra ayer?|Un activo duplicó su precio ayer. No hay evidencia confiable del precio de mañana.|Solo lo ocurrido ayer~Que mañana debe subir|Un cambio pasado no garantiza el siguiente.|Distingue una observación de una predicción.',
    'O que ontem comprova?|Um ativo dobrou de preço ontem. Não há evidência confiável do preço de amanhã.|Só o que ocorreu ontem~Que amanhã deve subir|Uma mudança passada não garante a próxima.|Separe uma observação de uma previsão.',
  ]),
  q('guided-02', 'guided', [
    'What drives this purchase?|A buyer knows no income or use for an asset, only hopes to resell it higher.|A speculative resale expectation~A guaranteed future payment|The purchase relies on an uncertain future buyer’s price.|Look for the source of the expected gain.',
    '¿Qué impulsa esta compra?|No conocen ingresos ni uso del activo; solo esperan revenderlo más caro.|Una expectativa especulativa de reventa~Un pago futuro garantizado|La compra depende del precio incierto de un comprador futuro.|Busca de dónde saldría la ganancia esperada.',
    'O que motiva essa compra?|Não conhecem rendimento nem uso do ativo; só esperam revendê-lo mais caro.|Uma expectativa especulativa de revenda~Um pagamento futuro garantido|A compra depende do preço incerto de um comprador futuro.|Procure de onde viria o ganho esperado.',
  ]),
  q('practice-01', 'practice', [
    'Does popularity establish safety?|Many online posts celebrate gains in a volatile collectible.|No, popularity does not bound losses~Yes, many posts guarantee demand|Attention does not establish a limit on future losses.|Evaluate possible losses independently of social excitement.',
    '¿La popularidad demuestra seguridad?|Muchas publicaciones celebran ganancias en un objeto de colección volátil.|No, ser popular no limita pérdidas~Sí, muchas publicaciones garantizan demanda|La atención no establece un límite a pérdidas futuras.|Evalúa posibles pérdidas aparte del entusiasmo social.',
    'Popularidade comprova segurança?|Muitas publicações celebram ganhos num item de coleção volátil.|Não, popularidade não limita perdas~Sim, muitas publicações garantem demanda|A atenção não estabelece limite para perdas futuras.|Avalie possíveis perdas separadas do entusiasmo social.',
  ]),
  q('practice-02', 'practice', [
    'What does starting small change?|A speculative offer accepts little money but provides no protection against loss.|Amount exposed, not certainty~It becomes guaranteed~Price cannot fall|A small purchase can still lose its invested amount.|Distinguish loss size from whether loss is possible.',
    '¿Qué cambia entrar con poco?|Una oferta especulativa acepta un monto pequeño, sin protección contra perderlo.|El monto expuesto, no la certeza~Se vuelve garantizada~El precio ya no puede caer|Una compra pequeña puede perder el monto invertido.|Distingue tamaño de pérdida de posibilidad de perder.',
    'O que muda entrar com pouco?|Uma oferta especulativa aceita quantia pequena, sem proteção contra perdê-la.|O valor exposto, não a certeza~Ela fica garantida~O preço não pode mais cair|Uma compra pequena pode perder o valor investido.|Separe tamanho da perda da possibilidade de perder.',
  ]),
  q('practice-03', 'practice', [
    'Which evidence is missing?|A promoter shows only winning buyers and hides losses or unsold holdings.|The range of actual outcomes~More winner celebrations|Selected winners do not describe everyone’s risk.|Look for omitted outcomes as well as displayed gains.',
    '¿Qué evidencia falta?|Un promotor muestra solo compradores ganadores y oculta pérdidas o activos sin vender.|La variedad real de resultados~Más celebraciones de ganadores|Ganadores seleccionados no describen el riesgo de todos.|Busca resultados omitidos además de ganancias mostradas.',
    'Qual evidência falta?|Um promotor mostra só compradores vencedores e esconde perdas ou ativos sem vender.|A variedade real de resultados~Mais celebrações de vencedores|Vencedores selecionados não descrevem o risco de todos.|Procure resultados omitidos além dos ganhos exibidos.',
  ]),
  q('transfer-01', 'transfer', [
    'What supports this?|A rare-item seller promises easy resale profit because last year’s buyers earned money.|Past buyers do not guarantee future resale~Their gains guarantee yours~Rarity removes all risk|Future buyers and prices can differ from last year’s.|Past success is not a buyer or a guaranteed price.',
    '¿Qué respalda la promesa?|Un vendedor promete ganar revendiendo una pieza rara porque compradores anteriores ganaron el año pasado.|Los anteriores no garantizan reventa futura~Sus ganancias garantizan las tuyas~Ser rara elimina todo riesgo|Compradores y precios futuros pueden diferir de los anteriores.|El éxito pasado no es comprador ni precio garantizado.',
    'O que sustenta a promessa?|Um vendedor promete lucro revendendo uma peça rara porque compradores anteriores ganharam no ano passado.|Os anteriores não garantem revenda futura~Os ganhos deles garantem os seus~Ser rara elimina qualquer risco|Compradores e preços futuros podem diferir dos anteriores.|Sucesso passado não é comprador nem preço garantido.',
  ]),
]),
];
