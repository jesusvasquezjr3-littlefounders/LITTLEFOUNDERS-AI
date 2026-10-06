import { q } from './helpers.mjs';
import { numeric,input,subtract } from '../factory.mjs';
const id=n=>`fe-production-financial-landscape-${String(n).padStart(2,'0')}`;
const channel='fe-production-payments-digital-07';
const mul=(a,b)=>({op:'multiply',args:[a,b]});
export const landscapeReviews=[{
 id:'fe-production-financial-landscape-review-1',primary:id(1),
 title:'Provider Checks|Verifica proveedores y resuelve disputas|Confira provedores e resolva disputas',
 relevance:'Retrieve identity, coverage and complaint checks before trusting a financial claim.|Recupera revisión de identidad, cobertura y quejas antes de confiar en una afirmación financiera.|Retome conferência de identidade, cobertura e queixas antes de confiar numa alegação financeira.',
 outcome:'Verify the genuine provider and permitted activity while distinguishing coverage and preparing an appropriate complaint route.',
 misconception:'A familiar logo guarantees all losses and every authority can resolve any financial complaint.',
 skills:[id(1),id(2),id(3),id(4),id(5),channel,id(1)],segments:[
 q('practice-01','practice',[
 'What remains unverified?|The register’s legal name matches, but its permitted activity differs from the offer.|Permission for this activity~Only the quoted return~Nothing because names match|Identity matching does not establish permission for another activity.|Match both legal identity and activity scope.',
 '¿Qué sigue sin verificar?|Nombre legal del registro coincide, pero actividad permitida difiere de oferta.|Permiso para esta actividad~Solo el rendimiento ofrecido~Nada porque nombres coinciden|Un mismo nombre no da permiso para otra actividad.|Compara identidad legal y alcance de actividad.',
 'O que segue sem verificar?|Nome legal da lista coincide, mas serviço permitido difere da oferta.|Permissão para este serviço~Só o retorno oferecido~Nada pois nomes coincidem|Identidade igual não define permissão para outro serviço.|Compare identidade legal e alcance do serviço.']),
 q('practice-02','practice',[
 'What does authorization fail to guarantee?|A regulated firm offers an investment exposed to price falls.|No market losses~Permission for its stated activity~A listed legal identity|Authorization does not remove the investment’s stated market exposure.|Separate provider status from product risk.',
 '¿Qué no garantiza permiso?|Empresa regulada ofrece inversión expuesta a caídas de precio.|Ausencia de pérdidas de mercado~Permiso para actividad indicada~Identidad legal registrada|Permiso no elimina riesgo de mercado dado.|Separa estatus del proveedor de riesgo del producto.',
 'O que autorização não garante?|Empresa regulada oferece aplicação exposta a quedas de preço.|Ausência de perdas de mercado~Permissão para serviço dado~Identidade legal registrada|Autorização não elimina exposição dada ao mercado.|Separe situação do provedor de risco do produto.']),
 q('practice-03','practice',[
 'Does this scheme cover this?|Fictional protection covers deposits after bank failure; the loss is a fund’s market decline.|No, wrong product and event~Yes, all financial losses~Yes, same seller|Both the product and loss event fall outside this scheme.|Apply the stated eligibility and event conditions.',
 '¿El esquema indicado cubre esto?|Protección ficticia cubre depósitos tras quiebra; pérdida es caída de mercado de fondo.|No, producto y evento distintos~Sí, toda pérdida financiera~Sí, mismo vendedor|Producto y evento quedan fuera de este esquema.|Aplica condiciones indicadas de producto y evento.',
 'O sistema dado cobre isto?|Proteção fictícia cobre depósitos após quebra; perda é queda de mercado de fundo.|Não, produto e evento distintos~Sim, toda perda financeira~Sim, mesmo vendedor|Produto e evento ficam fora deste sistema.|Aplique condições dadas de produto e evento.']),
 q('practice-04','practice',[
 'Which complaint supports assessment?|An unexplained duplicate charge appears on a statement.|Identify charge, attach evidence, request correction~Only express anger~Hide the transaction reference|A specific issue, proof and remedy make the complaint assessable.|Connect the disputed transaction to the requested correction.',
 '¿Qué queja permite evaluar?|Cargo duplicado sin explicación aparece en estado.|Identificar cargo, adjuntar prueba, pedir corrección~Solo expresar enojo~Ocultar referencia de pago|Problema, prueba y solución concretos permiten evaluar queja.|Conecta pago disputada con corrección solicitada.',
 'Que queixa permite avaliar?|Cobrança duplicada sem explicação aparece no extrato.|Identificar cobrança, anexar prova, pedir correção~Só expressar raiva~Ocultar referência da transação|Problema, prova e solução concretos permitem avaliar queixa.|Ligue transação contestada à correção pedida.']),
 q('practice-05','practice',[
 'Which next route fits an unresolved reply?|Official guidance assigns this product’s dispute to a named complaints body.|That verified body with records~Any authority regardless of scope~A guaranteed-recovery stranger|The next route must match the stated official responsibilities.|Use the official route and retain the complaint history.',
 '¿Qué vía sigue a respuesta pendiente?|Guía oficial asigna disputa de este producto a organismo de quejas nombrado.|Ese organismo verificado con registros~Cualquier autoridad sin revisar alcance~Extraño que promete recuperación segura|La vía siguiente debe coincidir con funciones oficiales indicadas.|Usa vía oficial y conserva historial de queja.',
 'Que via segue resposta pendente?|Guia oficial atribui disputa deste produto a órgão de queixas nomeado.|Esse órgão conferido com registros~Qualquer autoridade sem ver alcance~Estranho que promete recuperar sempre|A próxima via deve coincidir com funções oficiais dadas.|Use via oficial e guarde histórico da queixa.']),
 q('practice-06','practice',[
 'How should this alert be checked?|A suspicious text asks for account details through its link.|Contact provider through independently verified channel~Use the text’s link~Reply with the password|Independent contact avoids trusting the suspicious message’s route.|Use a genuine provider channel obtained separately.',
 '¿Cómo revisar esta alerta?|Mensaje sospechoso pide datos de cuenta mediante su enlace.|Contactar proveedor por canal verificado aparte~Usar enlace del mensaje~Responder con contraseña|Contacto independiente evita confiar en ruta sospechosa del mensaje.|Usa canal auténtico del proveedor obtenido aparte.',
 'Como conferir este alerta?|Mensagem suspeita pede dados da conta pelo seu link.|Contatar provedor por canal conferido à parte~Usar link da mensagem~Responder com senha|Contato independente evita confiar na rota suspeita da mensagem.|Use canal real do provedor obtido à parte.']),
 q('transfer-01','transfer',[
 'What must be verified?|A caller copies a licensed firm’s name but uses different contact details.|Exact identity, activity and official contact~Only the copied name~Only the caller’s confidence|A genuine firm’s name does not authenticate the caller.|Cross-check the actual offer with independent official records.',
 '¿Qué verificar en esta oferta?|Persona que llama copia nombre de empresa autorizada pero usa contacto distinto.|Nombre legal, actividad y contacto oficial~Solo nombre copiado~Solo seguridad de quien llama|Nombre de empresa real no autentica a quien llama.|Contrasta oferta real con registros oficiales consultados aparte.',
 'O que verificar nesta oferta?|Pessoa que liga copia nome de empresa autorizada mas usa contato distinto.|Identidade exata, serviço e contato oficial~Só nome copiado~Só confiança de quem liga|Nome de empresa real não autentica quem liga.|Compare oferta real com listas oficiais de fonte segura.']),
 ]
},{
 id:'fe-production-financial-landscape-review-2',primary:id(6),
 title:'Financial Safeguards|Revisa envíos, afirmaciones y consentimiento|Confira envios, alegações e consentimento',
 relevance:'Retrieve conversion calculations and evidence checks for cross-border transfers and financial services.|Recupera cálculos de conversión y revisión de pruebas para envíos internacionales y servicios financieros.|Retome contas de conversão e conferência de provas para envios internacionais e serviços financeiros.',
 outcome:'Calculate recipient amounts, compare usable transfer offers and assess environmental and data-sharing claims.',
 misconception:'Zero fees, green labels or a quick consent button establish complete cost, verified impact or controlled sharing.',
 skills:[id(6),id(7),id(8),id(9),id(10),channel,id(6)],segments:[
 numeric(q('practice-01','practice',[
 'How many recipient units arrive?|Budget: 80; Sending fee deducted first: 5; Recipient units per sending unit: 4; No other fees.|300~320~75|Convert the sending budget after its fee deduction.|Subtract the fee before multiplying by the stated rate.',
 '¿Cuántas unidades llegan?|Presupuesto: 80; Comisión descontada antes: 5; Unidades recibidas por enviada: 4; Sin otros cargos.|300~320~75|Convierte presupuesto tras descuento de comisión.|Resta comisión antes de multiplicar por tipo indicado.',
 'Quantas unidades chegam?|Orçamento: 80; Taxa descontada antes: 5; Unidades recebidas por enviada: 4; Sem outras taxas.|300~320~75|Converta orçamento após desconto da taxa.|Subtraia taxa antes de multiplicar pelo câmbio dado.']),[80,5,4],mul(subtract(input(0),input(1)),input(2))),
 q('practice-02','practice',[
 'Which offer is usable by the deadline?|A arrives late; B arrives on time with accessible collection; C requires unavailable identification.|B~A~C|B satisfies both arrival timing and collection access.|Compare final value among offers that meet practical requirements.',
 '¿Qué oferta es utilizable a tiempo?|A llega tarde; B puntual con cobro accesible; C exige identificación no disponible.|B~A~C|B cumple plazo y acceso al cobro.|Compara valor final entre ofertas que cumplan requisitos prácticos.',
 'Qual oferta é utilizável no prazo?|A chega tarde; B pontual com saque acessível; C exige documento indisponível.|B~A~C|B atende prazo e acesso ao saque.|Compare valor final entre ofertas que atendem requisitos práticos.']),
 numeric(q('practice-03','practice',[
 'How many recipient units are lost versus reference?|Send: 50; Reference rate: 4; Offered rate: 3; Recipient units per sending unit; no fees.|50~150~200|The rate difference reduces the amount received versus this reference.|Multiply the rate gap by the same sending amount.',
 '¿Cuántas unidades menos que referencia?|Envía: 50; Referencia: 4; Oferta: 3; Unidades recibidas por enviada; sin comisiones.|50~150~200|Diferencia de tipo reduce recibido frente a esta referencia.|Multiplica diferencia de tipos por mismo monto enviado.',
 'Quantas unidades a menos que referência?|Envie: 50; Referência: 4; Oferta: 3; Unidades recebidas por enviada; sem taxas.|50~150~200|Diferença de câmbio reduz recebido frente a esta referência.|Multiplique diferença de câmbios pelo mesmo valor enviado.']),[50,4,3],mul(input(0),subtract(input(1),input(2)))),
 q('practice-04','practice',[
 'Which environmental claim can be checked?|One product gives a dated measure and method; another only a green label.|The defined measured claim~The color alone~Both prove low financial risk|A defined measure and method allow evidence checking.|Do not infer environmental results or financial safety from color.',
 '¿Qué frase ambiental puede revisarse?|Producto da medida fechada y método; otro solo etiqueta verde.|La frase medida definida~Solo el color~Ambas prueban bajo riesgo financiero|Una medida definida y método permiten revisar pruebas.|No deduzcas resultados ambientales ni seguridad financiera del color.',
 'Que alegação ambiental pode ser conferida?|Produto dá medida datada e método; outro só rótulo verde.|A alegação medida definida~Só a cor~Ambas provam baixo risco financeiro|Uma medida definida e método permitem conferir provas.|Não deduza resultados ambientais nem segurança financeira da cor.']),
 q('practice-05','practice',[
 'What must consent explain?|A service wants financial records but hides who receives them and how sharing stops.|Recipient and withdrawal process~Only the download count~Only promotional benefits|Consent needs the recipient and a clear control process.|Check data scope, purpose and withdrawal before sharing.',
 '¿Qué debe explicar consentimiento?|Servicio quiere registros financieros pero oculta receptor y cómo detener envío.|Destinatario y proceso de retiro~Solo número de descargas~Solo ventajas promocionales|Consentimiento necesita destinatario y proceso claro de control.|Revisa alcance, propósito y retiro antes de compartir.',
 'O que consentimento deve explicar?|Serviço quer registros financeiros mas oculta receptor e como parar envio.|Destinatário e processo de retirada~Só número de downloads~Só vantagens promocionais|Consentimento precisa de destinatário e processo claro de controle.|Confira alcance, finalidade e retirada antes de compartilhar.']),
 q('practice-06','practice',[
 'What is the safer verification route?|A suspicious “transfer failure” email supplies a replacement payment link.|Provider channel independently obtained~The email’s replacement link~Reply with account secrets|An independently obtained channel avoids the suspicious link.|Verify with the genuine provider before following the message.',
 '¿Qué vía verifica con más seguridad?|Correo sospechoso de «envío fallido» da enlace de pago alterno.|Canal del proveedor obtenido aparte~Enlace alterno del correo~Responder con secretos de cuenta|Canal obtenido aparte evita enlace sospechoso.|Verifica con proveedor auténtico antes de seguir el mensaje.',
 'Que via verifica com mais segurança?|Email suspeito de “envio falhou” dá link alternativo de pagamento.|Canal do provedor obtido à parte~Link alternativo do email~Responder com segredos da conta|Canal obtido à parte evita link suspeito.|Verifique com provedor real antes de seguir a mensagem.']),
 numeric(q('transfer-01','transfer',[
 'What finally reaches the recipient?|Budget: 150; Sending fee first: 10; Recipient units per sending unit: 2; Recipient fee afterward: 5.|275~280~300|Both fees reduce value at their stated stages.|Deduct sending fee, convert, then deduct recipient fee.',
 '¿Qué llega finalmente al destinatario?|Presupuesto: 150; Comisión inicial: 10; Unidades recibidas por enviada: 2; Comisión al recibir después: 5.|275~280~300|Ambas comisiones reducen valor en sus etapas indicadas.|Descuenta comisión inicial, convierte y descuenta comisión al recibir.',
 'O que chega enfim ao destinatário?|Orçamento: 150; Taxa inicial: 10; Unidades recebidas por enviada: 2; Taxa ao receber depois: 5.|275~280~300|Ambas as taxas reduzem valor nas etapas dadas.|Desconte taxa inicial, converta e desconte taxa ao receber.']),[150,10,2,5],subtract(mul(subtract(input(0),input(1)),input(2)),input(3))),
 ]
}];
