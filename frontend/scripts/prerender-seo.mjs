// Build-time static content-shell prerendering for crawlers.
//
// Vite's output ships an empty <div id="root"></div> for every route — real
// content only appears after React mounts client-side. Non-JS crawlers (most
// AI/LLM bots included) never see it. This script runs after `vite build` and
// writes one real, crawlable HTML file per public route/language, sourced
// directly from the same i18n JSON the live React pages already read from.
//
// Deliberately plain string templating — no React/JSX, no headless browser.
// Keeps this step fast and unable to crash on browser-only APIs (Howler,
// Lottie, R3F, Framer Motion) that the real app relies on.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const DIST = path.join(FRONTEND_ROOT, "dist");

function fail(msg) {
  console.error(`[prerender-seo] ${msg}`);
  process.exit(1);
}

function readJson(relPath) {
  const full = path.join(FRONTEND_ROOT, relPath);
  if (!fs.existsSync(full)) fail(`missing file: ${relPath}`);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, "");
}

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) fail(`template anchor not found (${label}) — index.html drifted, update this script`);
  return html.replace(pattern, replacement);
}

function canonicalUrl(routePath, lang) {
  return lang === "en"
    ? `https://littlefounders.ai${routePath}?lang=en`
    : `https://littlefounders.ai${routePath}`;
}

function applyMeta(html, meta, canonical) {
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`, "title");
  html = replaceOnce(
    html,
    /<meta name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escAttr(meta.description)}" />`,
    "meta description"
  );
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${escAttr(canonical)}" />`,
    "canonical"
  );
  html = replaceOnce(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escAttr(meta.title)}" />`,
    "og:title"
  );
  html = replaceOnce(
    html,
    /<meta property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escAttr(meta.ogDescription)}" />`,
    "og:description"
  );
  html = replaceOnce(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${escAttr(canonical)}" />`,
    "og:url"
  );
  html = replaceOnce(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${escAttr(meta.title)}" />`,
    "twitter:title"
  );
  html = replaceOnce(
    html,
    /<meta name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${escAttr(meta.ogDescription)}" />`,
    "twitter:description"
  );
  return html;
}

function injectFaqJsonLd(html, faq) {
  const mainEntity = [1, 2, 3, 4].map((i) => ({
    "@type": "Question",
    name: stripTags(faq[`q${i}`]),
    acceptedAnswer: { "@type": "Answer", text: stripTags(faq[`a${i}`]) },
  }));
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
  const script = `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
  if (!html.includes("</head>")) fail("</head> not found while injecting FAQPage JSON-LD");
  return html.replace("</head>", `${script}</head>`);
}

// ---- Route content builders -------------------------------------------

function buildHomeShell(locale) {
  const c = locale.landing.corp;
  const { pillars, features, final_cta: finalCta } = c;
  return `
    <main>
      <h1>${esc(c.hero.title_1)} ${esc(c.hero.title_grad)} ${esc(c.hero.title_2)}</h1>
      <p>${esc(c.hero.subtitle)}</p>
      <h2>${esc(pillars.title)}</h2>
      <p>${esc(pillars.subtitle)}</p>
      <ul>
        <li><strong>${esc(pillars.p1_title)}</strong>: ${esc(pillars.p1_desc)}</li>
        <li><strong>${esc(pillars.p2_title)}</strong>: ${esc(pillars.p2_desc)}</li>
        <li><strong>${esc(pillars.p3_title)}</strong>: ${esc(pillars.p3_desc)}</li>
      </ul>
      <h2>${esc(features.title)}</h2>
      <p>${esc(features.subtitle)}</p>
      <ul>
        <li><strong>${esc(features.f1_title)}</strong>: ${esc(features.f1_desc)}</li>
        <li><strong>${esc(features.f2_title)}</strong>: ${esc(features.f2_desc)}</li>
        <li><strong>${esc(features.f3_title)}</strong>: ${esc(features.f3_desc)}</li>
        <li><strong>${esc(features.f4_title)}</strong>: ${esc(features.f4_desc)}</li>
        <li><strong>${esc(features.f5_title)}</strong>: ${esc(features.f5_desc)}</li>
        <li><strong>${esc(features.f6_title)}</strong>: ${esc(features.f6_desc)}</li>
      </ul>
      <p>${esc(finalCta.title)} ${esc(finalCta.subtitle)}</p>
    </main>`;
}

function buildFamiliesShell(locale) {
  const f = locale.landing.families;
  return `
    <main>
      <h1>${esc(f.hero.title_part1)} ${esc(f.hero.title_highlight)} ${esc(f.hero.title_part2)}</h1>
      <p>${esc(f.hero.subtitle)}</p>
      <h2>${esc(f.task_manager.title)}</h2>
      <p>${esc(f.task_manager.description)}</p>
      <h2>${esc(f.marketplace.title)}</h2>
      <p>${esc(f.marketplace.description)}</p>
      <h2>${esc(f.parent_tools.title)}</h2>
      <p>${esc(f.parent_tools.description)}</p>
    </main>`;
}

function buildPricingShell(locale) {
  const p = locale.landing.pricing;
  const features = [
    p.freemium_feature_1,
    p.freemium_feature_2,
    p.freemium_feature_3,
    p.freemium_feature_4,
    p.freemium_feature_5,
  ];
  return `
    <main>
      <h1>${esc(p.title)}</h1>
      <p>${esc(p.subtitle)}</p>
      <h2>${esc(p.freemium_title)} — ${esc(p.freemium_price)}${esc(p.freemium_period)}</h2>
      <p>${esc(p.freemium_desc)}</p>
      <ul>
        ${features.map((f) => `<li>${esc(f)}</li>`).join("\n        ")}
      </ul>
    </main>`;
}

function buildFaqShell(locale) {
  const faq = locale.landing.faq;
  const items = [1, 2, 3, 4]
    // faq.a1..a4 already contain trusted first-party <strong> markup — inject raw.
    .map((i) => `<h3>${esc(faq[`q${i}`])}</h3>\n      <p>${faq[`a${i}`]}</p>`)
    .join("\n      ");
  return `
    <main>
      <h1>${esc(faq.title)}</h1>
      ${items}
    </main>`;
}

function buildHowItWorksShell(locale) {
  const h = locale.landing.how_it_works;
  const steps = [1, 2, 3, 4].map((i) => ({ title: h[`s${i}_title`], desc: h[`s${i}_desc`] }));
  return `
    <main>
      <h1>${esc(h.hero_title_1)} ${esc(h.hero_title_grad)}</h1>
      <p>${esc(h.hero_subtitle)}</p>
      <ol>
        ${steps.map((s) => `<li><strong>${esc(s.title)}</strong>: ${esc(s.desc)}</li>`).join("\n        ")}
      </ol>
    </main>`;
}

function buildLegalShell(section) {
  return (locale) => {
    const l = locale.legal[section];
    return `
    <main>
      <h1>${esc(l.title)}</h1>
      <p>${esc(l.subtitle)}</p>
      <p>${esc(l.coming_soon)}: ${esc(l.coming_soon_desc)}</p>
    </main>`;
  };
}

// ---- Main ---------------------------------------------------------------

const routeMeta = readJson("src/seo/route-meta.json");

const LOCALES = {
  es: {
    landing: readJson("src/i18n/locales/es/landing.json"),
    legal: readJson("src/i18n/locales/es/legal.json"),
  },
  en: {
    landing: readJson("src/i18n/locales/en/landing.json"),
    legal: readJson("src/i18n/locales/en/legal.json"),
  },
};

const ROUTES = [
  { routePath: "/", outStem: "index", build: buildHomeShell },
  { routePath: "/families", outStem: "families", build: buildFamiliesShell },
  { routePath: "/pricing", outStem: "pricing", build: buildPricingShell },
  { routePath: "/faq", outStem: "faq", build: buildFaqShell, faqJsonLd: true },
  { routePath: "/how-it-works", outStem: "how-it-works", build: buildHowItWorksShell },
  { routePath: "/legal/terms", outStem: "legal-terms", build: buildLegalShell("terms") },
  { routePath: "/legal/privacy", outStem: "legal-privacy", build: buildLegalShell("privacy") },
];

for (const lang of ["es", "en"]) {
  const templateFile = lang === "es" ? "index.html" : "index-en.html";
  const templatePath = path.join(DIST, templateFile);
  if (!fs.existsSync(templatePath)) {
    fail(`${templateFile} missing in dist/ — run "vite build" before this script`);
  }
  const template = fs.readFileSync(templatePath, "utf8");

  for (const route of ROUTES) {
    const meta = routeMeta[route.routePath]?.[lang];
    if (!meta) fail(`route-meta.json missing "${route.routePath}".${lang}`);

    const bodyHtml = route.build(LOCALES[lang]);
    const canonical = canonicalUrl(route.routePath, lang);

    let html = applyMeta(template, meta, canonical);
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
    if (route.faqJsonLd) {
      html = injectFaqJsonLd(html, LOCALES[lang].landing.faq);
    }
    if (html.includes("undefined")) {
      fail(`rendered "${route.routePath}" (${lang}) contains literal "undefined" — check i18n keys`);
    }

    const outName = route.routePath === "/" ? templateFile : lang === "es" ? `${route.outStem}.html` : `${route.outStem}-en.html`;
    fs.writeFileSync(path.join(DIST, outName), html, "utf8");
    console.log(`[prerender-seo] wrote dist/${outName}`);
  }
}
