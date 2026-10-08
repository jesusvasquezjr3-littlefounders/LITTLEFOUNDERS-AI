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
  /*
   * Browser chrome and the web app manifest, in the rebuilt tokens: every
   * value is a colour in frontend/src/rebuild/design/tokens.css.
   */
  themeColor: '#5c55fd', // --primary
  manifestBackground: '#0b0d1b', // --base (dark), the splash behind the icon
  /** The structured-data logo: the brand mark's 512 px raster (scripts/seo/render-icons.mjs, manifest `brand.mark`). */
  logoPath: '/icon-512.png',

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
    'LittleFounders helps children and teenagers learn about money. Available in English, Spanish and Portuguese, and free to start without an account.',
  'es-MX':
    'LittleFounders ayuda a niñas, niños y adolescentes a aprender sobre el dinero. Disponible en español, inglés y portugués, y gratis para empezar sin crear cuenta.',
  'pt-BR':
    'LittleFounders ajuda crianças e adolescentes a aprender sobre dinheiro. Disponível em português, espanhol e inglês, e grátis para começar sem criar conta.',
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
 * date that is right beats an automatic one that is wrong.
 */
export const PAGES = [
  {
    path: '/',
    index: true,
    lastmod: '2026-10-08',
    priority: '1.0',
    changefreq: 'weekly',
    /** Included in llms.txt so an agent knows what the page is for. */
    agentSummary: 'What LittleFounders is and how to start.',
    meta: {
      'en-US': {
        title: 'Financial literacy for kids and teens | LittleFounders',
        description:
          'Help your child save, solve problems and develop ideas through interactive challenges and an AI Mentor. Free to start.',
        h1: 'Help your child understand the value of money.',
      },
      'es-MX': {
        title: 'Educación financiera para niños y adolescentes | LittleFounders',
        description:
          'Ayúdalo a ahorrar, resolver problemas y crear ideas con retos interactivos y un Mentor de IA. Gratis para empezar.',
        h1: 'Que tu hijo entienda el valor del dinero.',
      },
      'pt-BR': {
        title: 'Educação financeira para crianças e adolescentes | LittleFounders',
        description:
          'Ajude a poupar, resolver problemas e criar ideias com desafios interativos e um Mentor de IA. Grátis para começar.',
        h1: 'Ajude seu filho a entender o valor do dinheiro.',
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
  '/learn',
  '/tutor',
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
