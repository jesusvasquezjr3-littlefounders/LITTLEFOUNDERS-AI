-- 0016_topic_review_edges.sql — the spaced-review layer becomes queryable.
--
-- The catalog YAML has always carried the pedagogy (topics.kind +
-- review_of citations), but Vault never stored it — so the platform's
-- always-on retention metric had nothing to join against. These columns are
-- persisted by coursegen's publish step from the blueprint (single source of
-- truth stays the catalog; this is a projection).
--
-- review_of stores the RAW slug paths exactly as the catalog writes them
-- ("<adventure>/<saga>" = the whole saga, "<adventure>/<saga>/<topic>" = one
-- topic). Resolution to topic ids happens at query time inside the functions
-- below — storing resolved ids would go stale across republishes.
--
-- The two functions are the retention instrument (Learn Your Way analysis,
-- 2026-07-25): our spaced reviews ARE the delayed test, so first-EVER-attempt
-- scores on review lessons, bucketed by days since the learner last practiced
-- the source material, give per-concept forgetting curves with zero extra
-- assessments. Service-role only: EXECUTE is revoked from client roles, Core
-- brokers access (admin console, §1.5).

alter table public.topics add column if not exists kind text not null default 'teaching';
alter table public.topics add column if not exists review_of jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.topics add constraint topics_kind_check
    check (kind in ('teaching', 'review_spaced', 'review_interleaved', 'review_quest'));
exception when duplicate_object then null; end $$;

-- Retention curve: first-ever attempt score on review-lesson segments,
-- bucketed by days since the SAME user's last prior attempt on any lesson of
-- the topics that review cites.
create or replace function public.admin_retention_at_distance()
returns table (bucket text, n bigint, avg_first_attempt_score numeric)
language sql
stable
as $$
  with review_topics as (
    select t.id as topic_id, t.review_of
    from public.topics t
    where t.kind <> 'teaching' and jsonb_array_length(t.review_of) > 0
  ),
  resolved as (
    select rt.topic_id as review_topic_id, src.id as source_topic_id
    from review_topics rt
    cross join lateral jsonb_array_elements_text(rt.review_of) as p(path)
    cross join lateral (
      select split_part(p.path, '/', 1) as a_slug,
             split_part(p.path, '/', 2) as s_slug,
             nullif(split_part(p.path, '/', 3), '') as t_slug
    ) parts
    join public.adventures a on a.slug = parts.a_slug
    join public.sagas s on s.adventure_id = a.id and s.slug = parts.s_slug
    join public.topics src on src.saga_id = s.id and (parts.t_slug is null or src.slug = parts.t_slug)
  ),
  review_first as (
    select distinct on (a.user_id, a.lesson_id, a.segment_id)
      a.user_id, l.topic_id as review_topic_id, a.score, a.created_at
    from public.lesson_segment_attempts a
    join public.lessons l on l.id = a.lesson_id
    where l.topic_id in (select topic_id from review_topics)
    order by a.user_id, a.lesson_id, a.segment_id, a.created_at asc
  ),
  with_distance as (
    select rf.score,
           extract(epoch from rf.created_at - src_last.last_ts) / 86400.0 as days
    from review_first rf
    cross join lateral (
      select max(a2.created_at) as last_ts
      from public.lesson_segment_attempts a2
      join public.lessons l2 on l2.id = a2.lesson_id
      join resolved r on r.source_topic_id = l2.topic_id and r.review_topic_id = rf.review_topic_id
      where a2.user_id = rf.user_id and a2.created_at < rf.created_at
    ) src_last
    where src_last.last_ts is not null
  )
  select
    case
      when days < 2 then '0-1'
      when days < 7 then '2-6'
      when days < 14 then '7-13'
      when days < 30 then '14-29'
      else '30+'
    end as bucket,
    count(*) as n,
    round(avg(score)::numeric, 1) as avg_first_attempt_score
  from with_distance
  group by 1
  order by min(days);
$$;

-- Per-source-topic retention: which concepts stick and which decay.
create or replace function public.admin_retention_by_topic()
returns table (source_topic_slug text, source_topic_title jsonb, n bigint, avg_first_attempt_score numeric)
language sql
stable
as $$
  with review_topics as (
    select t.id as topic_id, t.review_of
    from public.topics t
    where t.kind <> 'teaching' and jsonb_array_length(t.review_of) > 0
  ),
  resolved as (
    select rt.topic_id as review_topic_id, src.id as source_topic_id, src.slug as source_slug, src.title as source_title
    from review_topics rt
    cross join lateral jsonb_array_elements_text(rt.review_of) as p(path)
    cross join lateral (
      select split_part(p.path, '/', 1) as a_slug,
             split_part(p.path, '/', 2) as s_slug,
             nullif(split_part(p.path, '/', 3), '') as t_slug
    ) parts
    join public.adventures a on a.slug = parts.a_slug
    join public.sagas s on s.adventure_id = a.id and s.slug = parts.s_slug
    join public.topics src on src.saga_id = s.id and (parts.t_slug is null or src.slug = parts.t_slug)
  ),
  review_first as (
    select distinct on (a.user_id, a.lesson_id, a.segment_id)
      a.user_id, l.topic_id as review_topic_id, a.score
    from public.lesson_segment_attempts a
    join public.lessons l on l.id = a.lesson_id
    where l.topic_id in (select topic_id from review_topics)
    order by a.user_id, a.lesson_id, a.segment_id, a.created_at asc
  )
  select r.source_slug, r.source_title, count(*) as n, round(avg(rf.score)::numeric, 1) as avg_first_attempt_score
  from review_first rf
  join resolved r on r.review_topic_id = rf.review_topic_id
  group by r.source_slug, r.source_title
  order by avg(rf.score) asc;
$$;

revoke execute on function public.admin_retention_at_distance() from public, anon, authenticated;
revoke execute on function public.admin_retention_by_topic() from public, anon, authenticated;
