import { BlockList, isIPv4, isIPv6 } from 'node:net';
import { serviceRest } from './supabaseRest.js';

/*
 * Internal-traffic exclusion registry (Vault 0045).
 *
 * The problem it solves: staff browsing the public site is not acquisition.
 * It inflates visitors, flattens bounce rate and re-weights every geography
 * and source breakdown the team decides from.
 *
 * WHERE ENFORCEMENT ACTUALLY HAPPENS — Plausible CE v3.2.1 has no ingestion
 * IP blocklist, so an "excluded IP" list that only lived in a dashboard would
 * be decoration (that exact fiction was removed in 02758833). This registry is
 * read at the two points we control:
 *   1. GET /api/v1/analytics/tracking-decision — the SPA asks before mounting
 *      Plausible/Umami/GA4 at all, so an excluded machine never sends a hit.
 *   2. POST /api/v1/events — first-party ingest drops excluded batches.
 * Exclusion is therefore FORWARD-ONLY: it stops future pollution and cannot
 * remove history. The console states that on screen.
 *
 * FAILURE IS NOT EMPTINESS (§1.14): every read returns `null` when Vault
 * cannot answer — never an empty list, which would read as "nothing is
 * excluded" and silently re-admit staff traffic. Callers decide:
 *   - tracking-decision → answers `degraded: true`, and the browser keeps any
 *     exclusion it already persisted locally;
 *   - events ingest → accepts the batch (real telemetry beats a clean one);
 *   - the admin panel → 502, so an operator never sees an empty list that
 *     looks authoritative.
 */

export interface ExclusionRow {
  id: string;
  network: string;
  label: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface StaffSighting {
  address: string;
  userId: string;
  /** Staff display name, resolved for the console. '—' when the profile is gone. */
  displayName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hits: number;
}

/*
 * A fat-fingered /0 (or /1) would silently stop ALL analytics ingestion
 * platform-wide, and the symptom — "traffic went to zero" — looks like an
 * outage, not like a typo. An office never needs more than a /16, so the
 * blast radius is capped at validation time.
 */
const MIN_PREFIX_V4 = 16;
const MIN_PREFIX_V6 = 32;

/**
 * Canonical client address, or null when there is nothing usable.
 * Express (`trust proxy` 1) hands us either a plain address or the
 * IPv4-mapped IPv6 form Node uses on dual-stack sockets; both must reduce to
 * the same string, otherwise "exclude my IP" would store a form that never
 * matches the form seen on the next request.
 */
export function normalizeIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  const zone = value.indexOf('%'); // link-local scope id (fe80::1%en0)
  if (zone > 0) value = value.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped && isIPv4(mapped[1] as string)) return mapped[1] as string;
  if (isIPv4(value) || isIPv6(value)) return value;
  return null;
}

function ipv4ToBytes(address: string): number[] {
  return address.split('.').map((part) => Number(part));
}

function bytesToIpv4(bytes: number[]): string {
  return bytes.join('.');
}

/** Expand any valid IPv6 text form (including `::` and a trailing dotted quad) to 16 bytes. */
function ipv6ToBytes(address: string): number[] | null {
  let head = address;
  let tailBytes: number[] = [];
  const lastColon = address.lastIndexOf(':');
  const trailing = address.slice(lastColon + 1);
  if (trailing.includes('.')) {
    if (!isIPv4(trailing)) return null;
    tailBytes = ipv4ToBytes(trailing);
    head = address.slice(0, lastColon + 1) + '0:0';
  }

  const halves = head.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const chunk of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(chunk)) return null;
      groups.push(Number.parseInt(chunk, 16));
    }
    return groups;
  };
  const left = toGroups(halves[0] ?? '');
  const right = halves.length === 2 ? toGroups(halves[1] ?? '') : [];
  if (left === null || right === null) return null;

  const groupCount = 8 - tailBytes.length / 2;
  const missing = groupCount - left.length - right.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;
  const groups = [...left, ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => 0), ...right];

  const bytes: number[] = [];
  for (const group of groups) bytes.push((group >> 8) & 0xff, group & 0xff);
  return [...bytes, ...tailBytes];
}

function bytesToIpv6(bytes: number[]): string {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) groups.push((((bytes[i] as number) << 8) | (bytes[i + 1] as number)).toString(16));
  return groups.join(':');
}

/** Zero every bit to the right of the prefix — Postgres `cidr` REJECTS host bits (`203.0.113.7/24` is an error, not a coercion). */
function maskBytes(bytes: number[], prefix: number): number[] {
  return bytes.map((byte, index) => {
    const bitsBefore = index * 8;
    if (prefix >= bitsBefore + 8) return byte;
    if (prefix <= bitsBefore) return 0;
    return byte & (0xff << (8 - (prefix - bitsBefore))) & 0xff;
  });
}

export type NetworkParseError = 'INVALID' | 'PREFIX_TOO_BROAD';

export interface ParsedNetwork {
  /** Masked `address/prefix`, safe to hand to Postgres `cidr`. */
  network: string;
  address: string;
  prefix: number;
  version: 4 | 6;
}

/**
 * Parse admin input (`203.0.113.7`, `203.0.113.0/24`, `2001:db8::/48`) into a
 * masked, storable network. Strict by §1.14: no coercion, no silent widening.
 */
export function parseNetwork(input: string): ParsedNetwork | NetworkParseError {
  const value = input.trim();
  if (!value || value.length > 60) return 'INVALID';
  const slash = value.indexOf('/');
  const rawAddress = slash === -1 ? value : value.slice(0, slash);
  const rawPrefix = slash === -1 ? null : value.slice(slash + 1);

  const address = normalizeIp(rawAddress);
  if (!address) return 'INVALID';
  const version: 4 | 6 = isIPv4(address) ? 4 : 6;
  const maxPrefix = version === 4 ? 32 : 128;

  let prefix = maxPrefix;
  if (rawPrefix !== null) {
    if (!/^\d{1,3}$/.test(rawPrefix)) return 'INVALID';
    prefix = Number(rawPrefix);
    if (prefix > maxPrefix) return 'INVALID';
  }
  if (prefix < (version === 4 ? MIN_PREFIX_V4 : MIN_PREFIX_V6)) return 'PREFIX_TOO_BROAD';

  const bytes = version === 4 ? ipv4ToBytes(address) : ipv6ToBytes(address);
  if (!bytes) return 'INVALID';
  const masked = maskBytes(bytes, prefix);
  const maskedAddress = version === 4 ? bytesToIpv4(masked) : bytesToIpv6(masked);
  return { network: `${maskedAddress}/${prefix}`, address: maskedAddress, prefix, version };
}

// ── Active-exclusion snapshot ───────────────────────────────────────────────
// tracking-decision runs on the first page load of every marketing visitor, so
// it must never become a per-request database read. A 60s TTL snapshot (same
// budget as the Pulse cache) keeps the hot path in memory.

const SNAPSHOT_TTL_MS = 60_000;

interface Snapshot {
  at: number;
  blocks: BlockList;
  rows: ExclusionRow[];
}

let snapshot: Snapshot | null = null;

/** Test-only: drop caches so each test can vary the fetch stub. */
export function resetExclusionsForTests(): void {
  snapshot = null;
  sightingSeen.clear();
  lastPruneAt = 0;
}

function buildBlocks(rows: ExclusionRow[]): BlockList {
  const blocks = new BlockList();
  for (const row of rows) {
    const parsed = parseNetwork(row.network);
    if (typeof parsed === 'string') continue; // unparseable row must not poison the whole list
    if (parsed.prefix === (parsed.version === 4 ? 32 : 128)) {
      blocks.addAddress(parsed.address, parsed.version === 4 ? 'ipv4' : 'ipv6');
    } else {
      blocks.addSubnet(parsed.address, parsed.prefix, parsed.version === 4 ? 'ipv4' : 'ipv6');
    }
  }
  return blocks;
}

/** Active exclusions, newest first. `null` = Vault did not answer (never an empty list). */
export async function listActiveExclusions(): Promise<ExclusionRow[] | null> {
  const fresh = snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS;
  if (fresh && snapshot) return snapshot.rows;
  const rows = await serviceRest<ExclusionRow[]>(
    '/analytics_ip_exclusions?revoked_at=is.null&select=id,network,label,reason,created_by,created_at,revoked_at,revoked_by&order=created_at.desc',
  );
  if (!rows) return null;
  snapshot = { at: Date.now(), blocks: buildBlocks(rows), rows };
  return rows;
}

function invalidateSnapshot(): void {
  snapshot = null;
}

/**
 * Is this address excluded from analytics?
 * `null` means UNKNOWN (Vault unreachable) — never conflate it with `false`.
 */
export async function isIpExcluded(rawIp: string | undefined | null): Promise<boolean | null> {
  const ip = normalizeIp(rawIp);
  if (!ip) return false;
  const rows = await listActiveExclusions();
  if (rows === null) return null;
  // listActiveExclusions just populated it; the guard is for the impossible case.
  if (!snapshot) return null;
  return snapshot.blocks.check(ip, isIPv4(ip) ? 'ipv4' : 'ipv6');
}

// ── Mutations (admin console) ───────────────────────────────────────────────

export type CreateExclusionResult =
  | { ok: true; row: ExclusionRow }
  | { ok: false; reason: 'DUPLICATE' | 'FAILED' };

export async function createExclusion(input: {
  network: string;
  label: string;
  reason: string | null;
  createdBy: string;
}): Promise<CreateExclusionResult> {
  const parsed = parseNetwork(input.network);
  if (typeof parsed === 'string') return { ok: false, reason: 'FAILED' };
  const existing = await listActiveExclusions();
  if (existing === null || !snapshot) return { ok: false, reason: 'FAILED' };
  /*
   * Coverage, not string equality. Postgres stores the canonical form
   * (`2001:db8::/48`) while we hand it the expanded one, so comparing text
   * would miss a duplicate and surface the unique-index violation as a generic
   * failure. Containment also catches the more common redundancy — adding a
   * single address that an already-excluded office range covers.
   */
  if (snapshot.blocks.check(parsed.address, parsed.version === 4 ? 'ipv4' : 'ipv6')) {
    return { ok: false, reason: 'DUPLICATE' };
  }

  const created = await serviceRest<ExclusionRow[]>('/analytics_ip_exclusions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      network: input.network,
      label: input.label,
      reason: input.reason,
      created_by: input.createdBy,
    }),
  });
  const row = created?.[0];
  if (!row) return { ok: false, reason: 'FAILED' };
  invalidateSnapshot();
  return { ok: true, row };
}

/** Revoke (never delete — the audit trail must survive). `null` = upstream failure, `false` = no active row with that id. */
export async function revokeExclusion(id: string, actorId: string): Promise<ExclusionRow | null | false> {
  const updated = await serviceRest<ExclusionRow[]>(
    `/analytics_ip_exclusions?id=eq.${encodeURIComponent(id)}&revoked_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ revoked_at: new Date().toISOString(), revoked_by: actorId }),
    },
  );
  if (!updated) return null;
  const row = updated[0];
  if (!row) return false;
  invalidateSnapshot();
  return row;
}

// ── Automatic detection ─────────────────────────────────────────────────────

const SIGHTING_DEDUPE_MS = 5 * 60_000;
const SIGHTING_DEDUPE_MAX = 5_000;
const SIGHTING_RETENTION_DAYS = 90;
const PRUNE_INTERVAL_MS = 60 * 60_000;

const sightingSeen = new Map<string, number>();
let lastPruneAt = 0;

function prunable(): boolean {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return false;
  lastPruneAt = now;
  return true;
}

/**
 * Record that a STAFF session was seen at this address (§1.9: admin and
 * superadmin only — Core never writes a visitor's, parent's or kid's address).
 * Fire-and-forget and deduped in-process: this sits on every admin request and
 * must never add latency or a failure mode to the console.
 */
export function recordStaffSighting(userId: string, rawIp: string | undefined | null): void {
  const ip = normalizeIp(rawIp);
  if (!ip) return;
  const key = `${userId}|${ip}`;
  const now = Date.now();
  const seenAt = sightingSeen.get(key);
  if (seenAt !== undefined && now - seenAt < SIGHTING_DEDUPE_MS) return;
  if (sightingSeen.size >= SIGHTING_DEDUPE_MAX) sightingSeen.clear();
  sightingSeen.set(key, now);

  void serviceRest('/rpc/record_staff_ip_sighting', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ p_address: ip, p_user_id: userId }),
  });

  if (prunable()) {
    const cutoff = new Date(now - SIGHTING_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
    void serviceRest(`/analytics_staff_ip_sightings?last_seen_at=lt.${encodeURIComponent(cutoff)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }
}

interface SightingRow {
  address: string;
  user_id: string;
  first_seen_at: string;
  last_seen_at: string;
  hits: number;
}

/** Staff addresses seen recently, most-recent first. `null` = Vault did not answer. */
export async function listStaffSightings(days: number, limit: number): Promise<StaffSighting[] | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  const rows = await serviceRest<SightingRow[]>(
    `/analytics_staff_ip_sightings?last_seen_at=gte.${encodeURIComponent(since)}` +
      `&select=address,user_id,first_seen_at,last_seen_at,hits&order=last_seen_at.desc&limit=${limit}`,
  );
  if (!rows) return null;
  if (rows.length === 0) return [];

  // Names come from a second read: both tables reference auth.users, so there
  // is no FK between them for PostgREST to embed through.
  const ids = [...new Set(rows.map((row) => row.user_id))].join(',');
  const profiles = await serviceRest<{ user_id: string; display_name: string }[]>(
    `/profiles?user_id=in.(${ids})&select=user_id,display_name`,
  );
  if (!profiles) return null;
  const nameByUser = new Map(profiles.map((profile) => [profile.user_id, profile.display_name]));

  return rows.map((row) => ({
    address: row.address,
    userId: row.user_id,
    displayName: nameByUser.get(row.user_id) ?? '—',
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    hits: row.hits,
  }));
}

/**
 * Sightings NOT already covered by an active exclusion — i.e. the addresses an
 * operator can still act on. Returns `null` if either read fails, so the panel
 * never renders "nothing to suggest" out of an outage.
 */
export async function listExclusionSuggestions(
  days: number,
  limit: number,
): Promise<{ sightings: StaffSighting[]; excludedAddresses: string[] } | null> {
  const [sightings, active] = await Promise.all([listStaffSightings(days, limit), listActiveExclusions()]);
  if (!sightings || !active || !snapshot) return null;
  const blocks = snapshot.blocks;
  const covered: string[] = [];
  const open: StaffSighting[] = [];
  for (const sighting of sightings) {
    const ip = normalizeIp(sighting.address);
    if (ip && blocks.check(ip, isIPv4(ip) ? 'ipv4' : 'ipv6')) covered.push(sighting.address);
    else open.push(sighting);
  }
  return { sightings: open, excludedAddresses: covered };
}
