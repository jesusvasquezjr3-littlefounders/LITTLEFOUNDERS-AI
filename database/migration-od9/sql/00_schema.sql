-- OD-9 migration toolkit: the working schema. Idempotent; safe on the legacy
-- schema and on the migrated one. The od9 schema is the operator's evidence
-- store (inventories, identifiers, findings, runs). It is not a product
-- schema: no browser role can reach it (PostgREST exposes public only, and
-- the grants below are revoked), and nothing in the product reads it.

-- The toolkit's SQL functions name rebuild tables that the legacy schema does
-- not have yet; they are resolved when called, not when installed.
SET check_function_bodies = off;

CREATE SCHEMA IF NOT EXISTS od9;
REVOKE ALL ON SCHEMA od9 FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA od9 FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA od9 FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA od9 FROM %I', r);
        END IF;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS od9.runs (
    id          bigserial PRIMARY KEY,
    step        text NOT NULL CHECK (step IN ('inventory', 'defects', 'kc_credit', 'consent')),
    mode        text NOT NULL CHECK (mode IN ('capture', 'dry_run', 'apply')),
    label       text,
    started_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
    summary     jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- One row per (label, account, category): the promised-record inventory.
CREATE TABLE IF NOT EXISTS od9.inventory (
    label       text NOT NULL CHECK (label ~ '^[a-z0-9_-]{1,40}$'),
    user_id     uuid NOT NULL,
    family_key  uuid NOT NULL,
    category    text NOT NULL,
    row_count   bigint NOT NULL,
    checksum    text NOT NULL,
    captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (label, user_id, category)
);

-- Categories that could not be read at capture time (table or column absent).
CREATE TABLE IF NOT EXISTS od9.inventory_gaps (
    label    text NOT NULL,
    category text NOT NULL,
    reason   text NOT NULL,
    PRIMARY KEY (label, category)
);

-- OD-9 section 4.4: usernames and guardian links, captured verbatim.
CREATE TABLE IF NOT EXISTS od9.identifiers (
    label text NOT NULL,
    kind  text NOT NULL CHECK (kind IN ('username', 'guardian_link')),
    key   text NOT NULL,
    value text NOT NULL,
    PRIMARY KEY (label, kind, key)
);

-- Every flagged legacy record and what was done about it. subject_ref is the
-- natural key of the finding (an account id, a share id, account:practice).
CREATE TABLE IF NOT EXISTS od9.findings (
    id              bigserial PRIMARY KEY,
    kind            text NOT NULL,
    subject_user_id uuid,
    subject_ref     text NOT NULL,
    status          text NOT NULL CHECK (status IN ('flagged', 'corrected', 'review_required', 'resolved')),
    detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
    correction      jsonb,
    found_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
    run_id          bigint REFERENCES od9.runs (id),
    UNIQUE (kind, subject_ref)
);

-- The stage a legacy chapter had: explicit pathway columns win (Rule P1),
-- otherwise the taxonomy tier.
CREATE OR REPLACE FUNCTION od9.chapter_stage(p_age_tier text, p_explicit text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(p_explicit, CASE p_age_tier
        WHEN 'tier1' THEN 'child' WHEN 'tier2' THEN 'child'
        WHEN 'tier3' THEN 'tween' WHEN 'tier4' THEN 'teen' END)
$$;

CREATE OR REPLACE FUNCTION od9.has_table(p_name text)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT to_regclass(p_name) IS NOT NULL $$;

CREATE OR REPLACE FUNCTION od9.has_column(p_schema text, p_table text, p_column text)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = p_schema AND table_name = p_table AND column_name = p_column)
$$;

-- The rebuild schema the correction steps write into. Inventory and
-- identifiers run on either schema; the three correction steps refuse the
-- legacy one rather than half-apply.
CREATE OR REPLACE FUNCTION od9.require_rebuild_schema()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE missing text[];
BEGIN
    SELECT array_agg(t) INTO missing FROM unnest(ARRAY[
        'public.account_safety_origins', 'public.account_age_declarations', 'public.legacy_kc_credits',
        'public.data_practices', 'public.data_practice_consents', 'public.topic_knowledge_components',
        'public.course_pathway_badges']) AS t
    WHERE to_regclass(t) IS NULL;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'OD9_REBUILD_SCHEMA_REQUIRED: apply the full migration chain first (missing %)', array_to_string(missing, ', ')
            USING ERRCODE = '55000';
    END IF;
END $$;

-- Record a finding once; a re-run refreshes its detail and status but keeps
-- the first found_at. Returns true when the finding is new.
CREATE OR REPLACE FUNCTION od9.record_finding(p_kind text, p_user uuid, p_ref text, p_status text,
                                              p_detail jsonb, p_correction jsonb, p_run bigint)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE inserted boolean;
BEGIN
    INSERT INTO od9.findings (kind, subject_user_id, subject_ref, status, detail, correction, run_id)
    VALUES (p_kind, p_user, p_ref, p_status, p_detail, p_correction, p_run)
    ON CONFLICT (kind, subject_ref) DO UPDATE
        SET status = EXCLUDED.status, detail = EXCLUDED.detail,
            correction = COALESCE(EXCLUDED.correction, od9.findings.correction),
            updated_at = clock_timestamp(), run_id = EXCLUDED.run_id
    RETURNING (xmax = 0) INTO inserted;
    RETURN inserted;
END $$;
