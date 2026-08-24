/*
 * Is the platform RECORDING nothing, or SHOWING nothing?
 *
 * Those two look identical from the admin console and have completely
 * different fixes, and guessing between them costs a deploy cycle. Written
 * 2026-08-23 after "analytics has recorded nothing since 18 August".
 *
 * READ-ONLY. It prints counts and configuration: no learner data, no visitor
 * IP, no secret value. It runs INSIDE Core — Vault is on Railway private
 * networking and reachable from nowhere else — using Core's own service key
 * from the container's environment, so nothing travels.
 *
 * A REAL FILE, not a heredoc in the workflow. The first version inlined this
 * with `read -r -d '' SCRIPT <<'INNER'` and an INDENTED terminator; a heredoc
 * terminator must sit at column 0 (`<<-` strips tabs, never spaces), so bash
 * never found it, the parse failed, and the step died in under a second with
 * no output at all — diagnosing a silent failure with a silently failing tool.
 * A tracked file is also lintable, diffable and testable, which a string
 * inside YAML is not.
 */

const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const days = Number(process.env.LF_DAYS || 30);

if (!base || !key) {
  console.log('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not in this environment.');
  console.log('This script must run inside Core, not on a runner.');
  process.exit(1);
}

const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function rest(path) {
  try {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(20_000),
    });
    const total = (response.headers.get('content-range') || '').split('/')[1] ?? '?';
    let body = null;
    try {
      body = await response.json();
    } catch {
      /* not JSON — status still tells us something */
    }
    return { status: response.status, total, body };
  } catch (error) {
    return { status: 0, total: '?', body: null, error: String(error).slice(0, 120) };
  }
}

console.log('== THE EXCLUSION REGISTRY — what silences a visitor before any hit is sent ==');
const ex = await rest(
  'analytics_ip_exclusions?select=network,label,created_at,revoked_at&order=created_at.desc&limit=100',
);
if (ex.status !== 200) {
  console.log(`   COULD NOT READ: HTTP ${ex.status} ${ex.error ?? ''}`);
} else {
  const rows = ex.body || [];
  const active = rows.filter((r) => !r.revoked_at);
  console.log(`   ${rows.length} row(s) total, ${active.length} ACTIVE`);
  for (const r of active) {
    // A /32 or /128 is one machine. Anything wider deserves a hard look: a
    // consumer ISP or CGNAT range silences thousands of real visitors, and
    // RUNBOOK's 2026-08-14 entry records a VPN exit node nearly being approved.
    const network = String(r.network || '');
    const bits = Number(network.split('/')[1]);
    const wide = Number.isFinite(bits) && (network.includes(':') ? bits < 128 : bits < 32);
    console.log(
      `   ${wide ? '!! WIDE ' : '   single'}  ${network}  "${r.label}"  added ${String(r.created_at).slice(0, 10)}`,
    );
  }
  if (!active.length) console.log('   (none — no visitor is being excluded by IP)');
}

console.log('');
console.log(`== FIRST-PARTY EVENTS, per day, last ${days} days ==`);
const ev = await rest(`learning_events?select=created_at&created_at=gte.${since}&limit=20000`);
if (ev.status !== 200) {
  console.log(`   COULD NOT READ: HTTP ${ev.status} ${ev.error ?? ''}`);
} else {
  const byDay = {};
  for (const r of ev.body || []) {
    const day = String(r.created_at).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days_ = Object.keys(byDay).sort();
  console.log(`   total in window: ${ev.total}`);
  if (!days_.length) {
    console.log('   NOTHING in the window — the EMIT side is dead, not the read side.');
  }
  for (const d of days_) console.log(`   ${d}  ${String(byDay[d]).padStart(6)}`);
}

console.log('');
console.log('== INSIGHTS ROLLUPS — what the admin console actually reads ==');
const roll = await rest('insights_daily_activity?select=day&order=day.desc&limit=1');
console.log(`   status ${roll.status}, rows ${roll.total}`);
if (roll.body?.[0]) {
  const newest = String(roll.body[0].day).slice(0, 10);
  const ageDays = Math.round((Date.now() - Date.parse(newest)) / 86_400_000);
  console.log(`   newest rollup day: ${newest}  (${ageDays} day(s) old)`);
  if (ageDays > 2) {
    console.log('   STALE. The nightly refresh has not been landing — check insights-maintenance.yml.');
  }
} else {
  console.log('   EMPTY. Either nothing was ever rolled up, or the refresh has never succeeded.');
}

console.log('');
console.log('== TUTOR SESSIONS — is anyone using the product at all ==');
const ts = await rest('tutor_sessions?select=started_at&order=started_at.desc&limit=5');
console.log(`   status ${ts.status}, total ${ts.total}`);
for (const r of ts.body || []) console.log(`   ${String(r.started_at).slice(0, 19)}`);

console.log('');
console.log('== CAN CORE REACH PULSE ==');
for (const [name, url] of [
  ['plausible', `${process.env.PLAUSIBLE_URL || ''}/api/health`],
  ['umami', `${process.env.UMAMI_URL || ''}/api/heartbeat`],
]) {
  if (!url.startsWith('http')) {
    console.log(`   ${name}: NOT CONFIGURED in Core's environment`);
    continue;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    console.log(`   ${name}: HTTP ${r.status}`);
  } catch (error) {
    console.log(`   ${name}: UNREACHABLE (${String(error).slice(0, 80)})`);
  }
}
