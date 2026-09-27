/*
 * What the internet is allowed to know about LittleFounders, in one place.
 *
 * WHY THIS FILE EXISTS
 *
 * Until 2026-08-27 every consumer that does not run JavaScript saw the same
 * 1,080-byte shell for every URL on the site: `<title>LittleFounders</title>`,
 * no description, no Open Graph, no structured data, and an empty `<div
 * id="root">`. Measured against production, not assumed. That is not a
 * ranking problem, it is an EXISTENCE problem, and it is worst exactly where
 * a new brand can least afford it:
 *
 *   - Social unfurlers (WhatsApp, LinkedIn, Facebook, X, Slack, iMessage,
 *     Telegram, Discord) NEVER execute JavaScript. Every link anyone has ever
 *     shared appeared as a bare grey URL.
 *   - LLM and agent crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot,
 *     Google-Extended…) overwhelmingly do not execute JavaScript either. To an
 *     AI assistant asked "what should I use to teach my kid about money", this
 *     site had no content at all.
 *   - Bing, DuckDuckGo and Brave render JavaScript far less reliably than
 *     Google, and Google itself has nothing to rank a page on when the page
 *     ships no title and no description.
 *
 * So the metadata is built at BUILD TIME into real per-route HTML files
 * (build-seo.mjs), not attached by React at runtime. A tag that only exists
 * after hydration is invisible to every consumer above.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is not a description of how the platform is built. Nobody searching for
 * help teaching their child about money is looking for our architecture, our
 * models or our pipeline. Every string here is written for a parent, and the
 * product is described by what a child DOES in it.
 *
 * MARKETING COPY RULES, so a future edit does not undo the positioning:
 *   - Title carries findability (the words a parent would actually type);
 *     description carries positioning (why this and not the other one).
 *   - Never name a vendor, model, framework or internal service.
 *   - Never claim a number we cannot source. The one statistic used is
 *     attributed (S&P Global FinLit Survey) and lives in the product copy too.
 *   - No invented ratings, review counts or user counts in structured data.
 *     They are a Google manual-action risk and they are not true.
 */

export const SITE = {
  origin: 'https://littlefounders.ai',
  name: 'LittleFounders',
  /** The one language a crawler with no Accept-Language header resolves to (i18n fallbackLng). */
  canonicalLocale: 'en-US',
  locales: ['en-US', 'es-MX', 'pt-BR'],
  /** Open Graph locale identifiers, which use underscores rather than hyphens. */
  ogLocale: { 'en-US': 'en_US', 'es-MX': 'es_MX', 'pt-BR': 'pt_BR' },
  /*
   * How the languages are NAMED to a reader.
   *
   * `en-US, es-MX, pt-BR` is an engineering identifier, and llms.txt is read
   * by something that will paraphrase it to a parent. An assistant told the
   * product speaks "es-MX" may well decide that is not the same thing as
   * Spanish and never recommend it to the audience it was built for.
   */
  languageNames: { 'en-US': 'English', 'es-MX': 'Spanish (Mexico)', 'pt-BR': 'Portuguese (Brazil)' },
  twitter: null, // No verified account yet — an invented @handle is worse than none.
  themeColor: '#4f46e5',

  /*
   * Search-console ownership tokens.
   *
   * Both consoles are where a site stops guessing: which queries actually
   * surface it, which pages were rejected and why, and whether the sitemap was
   * read at all. Neither can be claimed from code — a human has to prove
   * ownership once, in the console, and paste the token here.
   *
   * NOT a secret. It is a public meta tag on every page; its only power is to
   * prove that whoever put it there controls the site. Leave a value `null`
   * and no tag is emitted, which is better than an empty one that verifies
   * nothing and looks like it should.
   *
   * BOTH ARE DELIBERATELY EMPTY, and this is not a pending task.
   *
   * Ownership was proved on 2026-08-27 with a Google-issued CNAME in Vercel
   * DNS, and Bing was imported from Search Console. DNS cannot be dropped by a
   * deploy or by a refactor of the `<head>`; a meta tag can be dropped by
   * both, silently. Filling these as a second method would add something to
   * keep in sync while protecting against nothing DNS does not already cover.
   *
   * Fill them only if the DNS record is ever given up. The trade then is the
   * one above, in the other direction.
   *
   * Google:  Search Console → Add property → HTML tag → copy the `content` value
   * Bing:    Bing Webmaster Tools → Add site → Meta tag → copy the `content` value
   */
  verification: {
    google: null,
    bing: null,
  },
};

/*
 * The brand in one paragraph per language, reused by structured data and
 * llms.txt. This is the answer an AI assistant should be able to give when
 * asked what LittleFounders is.
 */
export const ELEVATOR = {
  'en-US':
    'LittleFounders is a family learning platform where children and teenagers build real money skills (saving, spending, earning, entrepreneurship and investing) by making decisions inside guided stories rather than by watching lessons. Four Mentor characters guide the way and answer questions. Parents open a Tutor account and see every Mentor conversation. Available in English, Spanish and Portuguese, and free to start without an account.',
  'es-MX':
    'LittleFounders es una plataforma de aprendizaje familiar donde niñas, niños y adolescentes desarrollan habilidades reales con el dinero (ahorrar, gastar, ganar, emprender e invertir) tomando decisiones dentro de historias guiadas, no viendo lecciones. Cuatro personajes Mentor los acompañan y responden sus preguntas. Los padres abren una cuenta Tutor y ven cada conversación con el Mentor. Disponible en español, inglés y portugués, y gratis para empezar sin crear cuenta.',
  'pt-BR':
    'LittleFounders é uma plataforma de aprendizagem familiar onde crianças e adolescentes desenvolvem habilidades reais com dinheiro (poupar, gastar, ganhar, empreender e investir) tomando decisões dentro de histórias guiadas, em vez de assistir a aulas. Quatro personagens Mentor conduzem o caminho e respondem perguntas. Os responsáveis abrem uma conta Tutor e veem cada conversa com o Mentor. Disponível em português, espanhol e inglês, e grátis para começar sem criar conta.',
};

/** Short positioning line for the share card. Kept under ~70 characters so it sets large. */
export const CARD_LINE = {
  'en-US': 'Kids learn money by deciding, not by watching.',
  'es-MX': 'Aprenden de dinero decidiendo, no mirando.',
  'pt-BR': 'Aprendem sobre dinheiro decidindo, não assistindo.',
};

export const CARD_KICKER = {
  'en-US': 'Financial learning for families',
  'es-MX': 'Aprendizaje financiero para familias',
  'pt-BR': 'Aprendizado financeiro para famílias',
};

/*
 * ── The public surface ──────────────────────────────────────────────────────
 *
 * `index: false` is a deliberate marketing decision, not an oversight. A thin
 * placeholder page indexed alongside real ones drags the whole domain's
 * quality signal down and wastes the crawl budget of a site nobody has heard
 * of yet. `/families` and `/faq` are placeholders today; the day they carry
 * real content, flip the flag and they enter the sitemap automatically.
 *
 * `priority` and `changefreq` are hints, not instructions — search engines are
 * free to ignore them, and the ordering is what actually communicates intent.
 *
 * `lastmod` is WRITTEN BY HAND, and that is the point. It first derived itself
 * from the mtime of the files a page's copy lives in, which looked truthful and
 * was not: git stores no mtimes, so a fresh clone stamps every file with the
 * clone time — verified 2026-08-27, where a README untouched for months came
 * back dated to the minute of the checkout. Vercel clones on every build, so
 * the field was claiming that every page had changed today, on every unrelated
 * deploy. That is precisely how lastmod becomes worthless: a crawler that sees
 * it lie learns to ignore it, and then it cannot help on the day something
 * really does change.
 *
 * So: bump the date when the page's CONTENT changes for a reader. Not when the
 * build runs, not when a title is reworded. Six pages, changed rarely — a hand
 * date that is right beats an automatic one that is wrong. `seo:check` refuses
 * a malformed or future date.
 */
export const PAGES = [
  {
    path: '/',
    index: true,
    lastmod: '2026-09-26',
    priority: '1.0',
    changefreq: 'weekly',
    /** Included in llms.txt so an agent knows what the page is for. */
    agentSummary: 'What LittleFounders is, who it is for, and how to start.',
    meta: {
      'en-US': {
        title: 'Financial literacy for kids and teens | LittleFounders',
        description:
          "Kids don't watch lessons here: they make decisions and live the results. Four Mentors who answer back, and real money skills. Free to start.",
        h1: 'The money pattern in your family ends with you.',
      },
      'es-MX': {
        title: 'Educación financiera para niños y adolescentes | LittleFounders',
        description:
          'Aquí no ven lecciones: toman decisiones y viven el resultado. Cuatro Mentores que responden y habilidades reales con el dinero. Gratis para empezar.',
        h1: 'El patrón del dinero en tu familia termina contigo.',
      },
      'pt-BR': {
        title: 'Educação financeira para crianças e adolescentes | LittleFounders',
        description:
          'Aqui não se assiste a aulas: decide-se e vive-se o resultado. Quatro Mentores que respondem e habilidades reais com dinheiro. Grátis para começar.',
        h1: 'O padrão do dinheiro na sua família termina com você.',
      },
    },
  },
  {
    path: '/how-it-works',
    index: true,
    lastmod: '2026-09-26',
    priority: '0.9',
    changefreq: 'monthly',
    agentSummary:
      'How the learning works: decisions with consequences, four Mentors who answer questions, and no account required to try it.',
    meta: {
      'en-US': {
        title: 'How it works: decisions, not lectures | LittleFounders',
        description:
          'Every lesson puts your child inside a choice that has a consequence. Four Mentors guide it and answer back, and you can try it without an account.',
        h1: 'From curiosity to financial confidence',
      },
      'es-MX': {
        title: 'Cómo funciona: decisiones, no lecciones | LittleFounders',
        description:
          'Cada lección pone a tu hijo dentro de una decisión que tiene consecuencia. Cuatro Mentores la guían y responden, y puedes probarlo sin crear cuenta.',
        h1: 'De la curiosidad a la confianza financiera',
      },
      'pt-BR': {
        title: 'Como funciona: decisões, não aulas | LittleFounders',
        description:
          'Cada lição coloca seu filho dentro de uma escolha que tem consequência. Quatro Mentores conduzem e respondem, e dá para testar sem criar conta.',
        h1: 'Da curiosidade à confiança financeira',
      },
    },
  },
  {
    path: '/families',
    index: true, // Flag flipped 2026-09-14: the page now carries real content (see the note above PAGES).
    lastmod: '2026-09-27',
    priority: '0.8',
    changefreq: 'monthly',
    agentSummary:
      'What a Tutor (verified parent) account controls: every Mentor conversation in full, chores with real rewards, a practice Wallet in coins, and how to create a Tutor account and link a child to it.',
    meta: {
      'en-US': {
        title: 'For families: the Tutor account | LittleFounders',
        description:
          'Read every Mentor conversation, set chores with real rewards, keep usage analytics off by default. How to create your Tutor account and link your family.',
        h1: 'Here, you decide.',
      },
      'es-MX': {
        title: 'Para familias: la cuenta Tutor | LittleFounders',
        description:
          'Lee cada conversación con el Mentor, fija tareas con recompensa real y deja la analítica apagada. Cómo crear tu cuenta Tutor y vincular tu familia.',
        h1: 'Aquí decides tú.',
      },
      'pt-BR': {
        title: 'Para famílias: a conta Tutor | LittleFounders',
        description:
          'Leia cada conversa com o Mentor, defina tarefas com recompensa real e deixe a análise desligada. Como criar sua conta Tutor e vincular sua família.',
        h1: 'Aqui, você decide.',
      },
    },
  },
  {
    path: '/faq',
    index: true, // Flag flipped 2026-09-15: the page now carries real content (see the note above PAGES).
    lastmod: '2026-09-26',
    priority: '0.6',
    changefreq: 'monthly',
    agentSummary:
      'Answers to the specific objections people have right before signing up: is it free to start, is it private, does a child talk to an AI (the Mentor), what the coins are, and how Tutor accounts and data privacy work.',
    meta: {
      'en-US': {
        title: 'Frequently asked questions | LittleFounders',
        description:
          'Is it free to start? Is it private? Does my child talk to an AI? Real answers about Tutor accounts, coins and data privacy, without marketing spin.',
        h1: 'Frequently asked questions',
      },
      'es-MX': {
        title: 'Preguntas frecuentes | LittleFounders',
        description:
          '¿Es gratis para empezar? ¿Es privado? ¿Mi hijo habla con una IA? Respuestas reales sobre la cuenta Tutor, las monedas y la privacidad de tus datos.',
        h1: 'Preguntas frecuentes',
      },
      'pt-BR': {
        title: 'Perguntas frequentes | LittleFounders',
        description:
          'É grátis para começar? É privado? Meu filho conversa com uma IA? Respostas reais sobre a conta Tutor, as moedas e a privacidade dos seus dados.',
        h1: 'Perguntas frequentes',
      },
    },
  },
  {
    // /badge/:token — one row per share (0072/0073), never a fixed page, so
    // there is nothing here for build-seo.mjs to prerender per-badge. This
    // entry exists only to (a) satisfy assertRoutesAgree's app/site
    // agreement check against src/lib/analytics.tsx's MARKETING_PREFIXES,
    // and (b) provide a safe generic fallback if the bare, tokenless
    // /badge path is ever hit directly. The REAL per-share title/description
    // /image an unfurler sees comes from frontend/api/badge/[token].ts at
    // request time, not from this file.
    path: '/badge',
    index: false, // Personal share link — never sitemapped, never search-indexed.
    lastmod: '2026-09-07',
    priority: '0.1',
    changefreq: 'monthly',
    agentSummary: null,
    meta: {
      'en-US': { title: 'Achievement badge | LittleFounders', description: 'A LittleFounders learner just earned an achievement badge.', h1: 'Achievement badge' },
      'es-MX': { title: 'Insignia de logro | LittleFounders', description: 'Un alumno de LittleFounders acaba de ganar una insignia de logro.', h1: 'Insignia de logro' },
      'pt-BR': { title: 'Selo de conquista | LittleFounders', description: 'Um aluno da LittleFounders acabou de conquistar um selo.', h1: 'Selo de conquista' },
    },
  },
  {
    path: '/legal/terms',
    index: true,
    lastmod: '2026-08-11',
    priority: '0.3',
    changefreq: 'yearly',
    agentSummary: 'Terms and conditions of use.',
    meta: {
      'en-US': { title: 'Terms & Conditions | LittleFounders', description: 'The terms that govern the use of LittleFounders: who may open an account, how family and child accounts work, and the rules that apply to everyone using it.', h1: 'Terms & Conditions' },
      'es-MX': { title: 'Términos y Condiciones | LittleFounders', description: 'Los términos que rigen el uso de LittleFounders: quién puede abrir una cuenta, cómo funcionan las cuentas familiares e infantiles, y las reglas que aplican a todos.', h1: 'Términos y Condiciones' },
      'pt-BR': { title: 'Termos e Condições | LittleFounders', description: 'Os termos que regem o uso do LittleFounders: quem pode abrir uma conta, como funcionam as contas familiares e infantis, e as regras que valem para todos.', h1: 'Termos e Condições' },
    },
  },
  {
    path: '/legal/privacy',
    index: true,
    lastmod: '2026-08-11',
    priority: '0.3',
    changefreq: 'yearly',
    agentSummary: 'Privacy notice, including how children’s data is handled.',
    meta: {
      'en-US': { title: 'Privacy Notice | LittleFounders', description: 'What we collect, what we never collect, and how children’s data is protected.', h1: 'Privacy Notice' },
      'es-MX': { title: 'Aviso de Privacidad | LittleFounders', description: 'Qué recopilamos, qué nunca recopilamos y cómo se protegen los datos de menores.', h1: 'Aviso de Privacidad' },
      'pt-BR': { title: 'Aviso de Privacidade | LittleFounders', description: 'O que coletamos, o que nunca coletamos e como os dados de menores são protegidos.', h1: 'Aviso de Privacidade' },
    },
  },
];

/*
 * The four mentors, by name, because an AI assistant answering "who teaches on
 * LittleFounders" should be able to say. Names only — no character backstory,
 * no internal role vocabulary.
 */
export const MENTORS = ['Dina', 'Liruf', 'Dr. Rho', 'Zara'];

/*
 * What a learner can actually study. Described by outcome, never by how the
 * catalogue is produced.
 */
export const SUBJECTS = {
  'en-US': [
    { name: 'Financial Education', about: 'Saving, spending, earning, budgeting and avoiding fraud: the everyday habits money rests on.' },
    { name: 'Entrepreneurship', about: 'Turning an idea into an offer someone will pay for, and running it without losing money.' },
    { name: 'Investing', about: 'Risk, patience, compounding and the difference between investing and gambling.' },
  ],
  'es-MX': [
    { name: 'Educación Financiera', about: 'Ahorrar, gastar, ganar, presupuestar y evitar fraudes: los hábitos diarios sobre los que descansa el dinero.' },
    { name: 'Emprendimiento', about: 'Convertir una idea en una oferta por la que alguien pague, y sostenerla sin perder dinero.' },
    { name: 'Inversiones', about: 'Riesgo, paciencia, interés compuesto y la diferencia entre invertir y apostar.' },
  ],
  'pt-BR': [
    { name: 'Educação Financeira', about: 'Poupar, gastar, ganhar, fazer orçamento e evitar fraudes: os hábitos diários sobre os quais o dinheiro se apoia.' },
    { name: 'Empreendedorismo', about: 'Transformar uma ideia em uma oferta que alguém pague, e mantê-la sem perder dinheiro.' },
    { name: 'Investimentos', about: 'Risco, paciência, juros compostos e a diferença entre investir e apostar.' },
  ],
};

/*
 * ── Crawler policy ──────────────────────────────────────────────────────────
 *
 * AI crawlers are ALLOWED, deliberately and by owner decision (2026-08-27).
 * The usual reason to block them is to protect proprietary content from
 * training. That calculation does not apply here: the marketing site holds no
 * proprietary content, the lessons sit behind authentication where no crawler
 * reaches them, and being the answer when someone asks an assistant how to
 * teach their child about money is worth more to a company nobody has heard of
 * than the theoretical cost of the pages being read.
 *
 * Split into two lists because they are governed by different decisions:
 * search engines are a ranking question, AI agents are a distribution one. A
 * future decision to withdraw from AI training changes only the second list.
 */
export const SEARCH_CRAWLERS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Slurp', 'Baiduspider', 'YandexBot', 'Applebot'];

export const AI_CRAWLERS = [
  'GPTBot', // OpenAI — training
  'OAI-SearchBot', // OpenAI — ChatGPT search index
  'ChatGPT-User', // OpenAI — a user asked ChatGPT to open the page
  'ClaudeBot', // Anthropic — training
  'Claude-SearchBot', // Anthropic — search index
  'Claude-User', // Anthropic — a user asked Claude to open the page
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended', // Gemini / Vertex grounding
  'Applebot-Extended', // Apple Intelligence
  'meta-externalagent', // Meta AI
  'Amazonbot',
  'Bytespider',
  'CCBot', // Common Crawl — feeds most open training sets
  'cohere-ai',
  'Diffbot',
  'omgili',
];

/**
 * Paths no crawler should fetch at all.
 *
 * Deliberately short. `Disallow` stops a fetch but does NOT stop indexing of a
 * URL somebody links to — a disallowed page can still appear in results as a
 * bare title, and because the crawler may not fetch it, it can never see a
 * `noindex` telling it otherwise. So this list holds only what must never be
 * REQUESTED; everything that merely should not RANK is handled with a
 * `noindex` tag on a page crawlers are free to read (see NOINDEX_PREFIXES).
 */
export const DISALLOWED_PREFIXES = ['/admin', '/dev/', '/auth/'];

/**
 * Fetchable, but must never rank.
 *
 * These are served by the SPA fallback, which build-seo.mjs marks `noindex` by
 * default — so this list is documentation and a test fixture rather than a
 * second mechanism. Anything not deliberately given a page above stays out of
 * the index by construction, which is the safe direction to fail in.
 */
export const NOINDEX_PREFIXES = [
  '/signup',
  '/login',
  '/reset-password',
  '/verify-parent',
  '/onboarding',
  '/dashboard',
  '/learn',
  '/tutor',
  '/tasks',
  '/profile',
  '/@',
];

/** Absolute URL for a site-relative path, without a double slash or a trailing one. */
export function absolute(path) {
  return path === '/' ? `${SITE.origin}/` : `${SITE.origin}${path}`;
}

/** The pages that belong in the sitemap and may be indexed. */
export function indexablePages() {
  return PAGES.filter((page) => page.index);
}

/** Meta for a page in a locale, falling back to the canonical locale. */
export function metaFor(page, locale) {
  return page.meta[locale] ?? page.meta[SITE.canonicalLocale];
}
