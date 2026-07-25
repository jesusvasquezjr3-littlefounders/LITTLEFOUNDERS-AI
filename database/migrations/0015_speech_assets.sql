-- 0015_speech_assets.sql — Echo (audiogen/) TTS generation cache.
--
-- Same contract as picture_assets (0014): an identical TTS request NEVER
-- hits the paid DashScope API twice. speech_hash =
-- sha256(JSON tuple [text, voice, model, language_type, mp3_bitrate_kbps])
-- → the Depot file already synthesized for it. The tuple is JSON-encoded
-- (not space-joined) so no two distinct requests can collide by
-- concatenation ambiguity. The audio BYTES live in filebase (Depot,
-- content-addressed, bucket lesson-audio, public reads); this row only maps
-- request → asset. mp3_bitrate_kbps joins the key because the cache stores
-- the ENCODED MP3 pointer — the source WAV is gone, so a different bitrate
-- is a different asset.
--
-- Before this table the only dedup was the per-(lesson, locale) manifest in
-- lesson_documents.audio: two lessons narrating the same sentence paid
-- twice, and a wiped manifest re-paid everything. This cache is
-- content-derived, so re-narrations, re-publishes with new segment ids,
-- reordered dialogue lines, and cross-lesson repeats all become free hits.
--
-- Service-role only, like lesson_documents and picture_assets: RLS enabled
-- with NO client policies — browsers never read this table (they get plain
-- public Depot URLs from the lesson audio manifest), and only Echo writes it.

create table if not exists speech_assets (
  id               uuid primary key default gen_random_uuid(),
  speech_hash      text not null unique,
  model            text not null,
  voice            text not null,
  language_type    text not null,
  text             text not null,
  url              text not null,
  file_id          text not null,
  bytes            integer,
  duration_ms      integer,
  mp3_bitrate_kbps integer not null,
  created_at       timestamptz not null default now()
);

alter table speech_assets enable row level security;

create index if not exists speech_assets_created_at_idx on speech_assets (created_at);
