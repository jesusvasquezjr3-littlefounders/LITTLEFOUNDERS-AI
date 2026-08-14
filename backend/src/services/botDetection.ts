/*
 * Non-human traffic detection for first-party telemetry.
 *
 * WHERE THE GAP WAS. Plausible CE drops known crawlers by user-agent before
 * storage (verified against production: twelve months of browser breakdown
 * contains Chrome, Safari, Mobile App, Firefox, Opera and Edge, and no bot
 * category at all), and GA4 filters known bots by default. Our OWN ingest
 * (`POST /api/v1/events`) filtered nothing, so the one dataset we fully
 * control was the least defended.
 *
 * WHAT THIS IS NOT. User-agent matching is a floor, not a wall: a crawler that
 * lies about its agent passes, and no honest measurement claims otherwise. It
 * catches the large, well-behaved majority — search engines, SEO and uptime
 * crawlers, preview bots, scripted clients — which is exactly the traffic that
 * quietly inflates a funnel. Anything cleverer than that is an arms race we
 * are not in.
 *
 * §1.9: the agent string is read from the request and used to make a
 * keep/drop decision. It is never stored, never attached to an event, and
 * never leaves the process.
 */

/*
 * Matched case-insensitively against the full agent string. Grouped by what
 * they are so the list stays reviewable rather than becoming folklore.
 */
const BOT_PATTERNS: RegExp = new RegExp(
  [
    // Generic self-identification — the overwhelming majority of honest bots.
    'bot\\b', 'bots\\b', 'crawler', 'crawling', 'spider', 'scraper', 'slurp',
    // Search engines and previewers.
    'googlebot', 'bingbot', 'yandex', 'duckduck', 'baiduspider', 'applebot',
    'facebookexternalhit', 'facebot', 'twitterbot', 'linkedinbot', 'slackbot',
    'whatsapp', 'telegrambot', 'discordbot', 'pinterest', 'redditbot',
    // AI and archival crawlers.
    'gptbot', 'chatgpt-user', 'ccbot', 'claudebot', 'anthropic-ai', 'perplexitybot',
    'ia_archiver', 'archive\\.org',
    // SEO, monitoring and security scanners.
    'ahrefs', 'semrush', 'mj12bot', 'dotbot', 'petalbot', 'dataforseo',
    'uptimerobot', 'pingdom', 'statuscake', 'site24x7', 'newrelicpinger',
    'censys', 'shodan', 'zgrab', 'masscan', 'nuclei',
    // Headless and automation stacks.
    'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
    'webdriver', 'cypress', 'electron/',
    // Scripted HTTP clients — never a real product session.
    'curl/', 'wget/', 'libwww', 'python-requests', 'python-urllib', 'aiohttp',
    'httpx', 'go-http-client', 'okhttp', 'java/', 'axios/', 'node-fetch',
    'guzzlehttp', 'postmanruntime', 'insomnia',
    // Feed readers and link checkers.
    'feedfetcher', 'feedly', 'rss', 'linkcheck', 'validator',
    // Deliberately blank or placeholder agents.
    '^-$',
  ].join('|'),
  'i',
);

export interface BotVerdict {
  isBot: boolean;
  /** Short, non-identifying reason, safe for logs and the console. */
  reason: 'user_agent' | 'missing_user_agent' | null;
}

/**
 * Classify a request's user agent.
 *
 * A MISSING agent counts as non-human: every browser sends one, and our beacon
 * only ever runs inside a browser, so its absence means something scripted is
 * posting to the endpoint directly.
 */
export function classifyUserAgent(userAgent: string | undefined | null): BotVerdict {
  const agent = (userAgent ?? '').trim();
  if (agent === '') return { isBot: true, reason: 'missing_user_agent' };
  if (BOT_PATTERNS.test(agent)) return { isBot: true, reason: 'user_agent' };
  return { isBot: false, reason: null };
}

/** Convenience predicate for call sites that only need the decision. */
export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  return classifyUserAgent(userAgent).isBot;
}
