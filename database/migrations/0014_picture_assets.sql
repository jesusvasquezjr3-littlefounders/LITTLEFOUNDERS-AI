-- 0014_picture_assets.sql — Prism (picturegen/) generation cache.
--
-- The whole point of the picturegen service is that an identical image request
-- NEVER hits the paid image API twice ("optimizar consumo" — owner directive
-- 2026-07-23). This table is the request-level index: prompt_hash =
-- sha256(model + size + final judged prompt) → the Depot file already
-- generated for it. The image BYTES live in filebase (Depot, content-addressed,
-- bucket lesson-images, public reads); this row only maps request → asset.
--
-- Service-role only, like lesson_documents: RLS enabled with NO client
-- policies — browsers never read this table (they get plain public Depot URLs
-- embedded in lesson documents), and only Prism writes it.

create table if not exists picture_assets (
  id          uuid primary key default gen_random_uuid(),
  prompt_hash text not null unique,
  model       text not null,
  prompt      text not null,
  url         text not null,
  file_id     text not null,
  bytes       integer,
  created_at  timestamptz not null default now()
);

alter table picture_assets enable row level security;

create index if not exists picture_assets_created_at_idx on picture_assets (created_at);
