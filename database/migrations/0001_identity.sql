-- 0001_identity.sql
-- Identity for the restart: the profile, the user types, the age record and the audit trail.
--
-- Accounts are rows of auth.users, written only by the authentication service (GoTrue). Every
-- table here keys on auth.users.id. The browser never reaches these tables: row-level security is
-- on with no policy, the API roles hold no privilege on them, and the backend (Core) works only
-- through the functions at the end of this file, which are executable by service_role alone.
--
-- User types (docs/process/DECISIONS.md, D-030): every account that has declared its age is either
-- `child` (under 18) or `universal` (18 or over), never both. `parent`, `admin` and `superadmin`
-- are held on top of `universal`. The type always agrees with the age record; the database refuses
-- a row that does not.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.profiles (
    user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    -- A public handle and a sign-in identifier. Lower case only, so uniqueness needs no case folding.
    username     text UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
    display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 80),
    locale       text NOT NULL DEFAULT 'en-US' CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
    user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('universal', 'child', 'parent', 'admin', 'superadmin')),
    granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

-- An account is a child or a universal user, never both.
CREATE UNIQUE INDEX user_roles_one_base_type ON public.user_roles (user_id) WHERE role IN ('universal', 'child');

-- What the person declared at sign-up (D-025, D-027). Written once; a correction is a staff
-- decision, so a child cannot turn into an adult by declaring again. The age is a whole number, not
-- a birth date: the product does not need more than that.
CREATE TABLE public.age_declarations (
    user_id             uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    declared_age        smallint NOT NULL CHECK (declared_age BETWEEN 6 AND 100),
    -- The self-declared checkbox: "I have my parent's or guardian's permission". Required under 13.
    guardian_permission boolean NOT NULL DEFAULT false,
    declared_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT age_declarations_permission_under_13 CHECK (declared_age >= 13 OR guardian_permission)
);

-- Append-only trail of identity changes. It holds ids and codes, never names, addresses or ages.
CREATE TABLE public.audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_id    uuid,
    action      text NOT NULL,
    target_id   uuid,
    detail      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_log_target ON public.audit_log (target_id, occurred_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Default deny: no policy, no privilege for any API role
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles, public.user_roles, public.age_declarations, public.audit_log
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Age
-- ---------------------------------------------------------------------------------------------

-- The age today: the declared age plus the whole years since it was declared. The real birthday
-- falls somewhere in the year after the declaration, so this never runs ahead of the truth: a
-- child stays a child a little longer, never the other way round.
CREATE FUNCTION public.effective_age(p_user uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT d.declared_age + EXTRACT(year FROM age(now(), d.declared_at))::integer
    FROM public.age_declarations AS d
    WHERE d.user_id = p_user;
$$;

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- Every new account gets a profile. It gets no type until it declares its age.
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_locale text := NEW.raw_user_meta_data ->> 'locale';
BEGIN
    INSERT INTO public.profiles (user_id, locale)
    VALUES (NEW.id, CASE WHEN v_locale IN ('en-US', 'es-MX', 'pt-BR') THEN v_locale ELSE 'en-US' END)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_touch
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- The rules a role row must meet, whoever writes it (the backend, a migration, a person in psql).
CREATE FUNCTION public.guard_user_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_age   integer;
    v_email text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'a role is granted or revoked, never edited' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.role IN ('child', 'universal') THEN
        v_age := public.effective_age(NEW.user_id);

        IF v_age IS NULL THEN
            RAISE EXCEPTION 'a base type needs an age declaration' USING ERRCODE = 'check_violation';
        END IF;

        IF (NEW.role = 'child') <> (v_age < 18) THEN
            RAISE EXCEPTION 'the base type does not agree with the age record' USING ERRCODE = 'check_violation';
        END IF;

        RETURN NEW;
    END IF;

    -- parent, admin and superadmin sit on top of an adult account.
    IF NOT EXISTS (SELECT 1 FROM public.user_roles AS r WHERE r.user_id = NEW.user_id AND r.role = 'universal') THEN
        RAISE EXCEPTION 'only a universal account can hold this role' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.role = 'superadmin' THEN
        SELECT u.email INTO v_email FROM auth.users AS u
        WHERE u.id = NEW.user_id AND u.email_confirmed_at IS NOT NULL;

        IF v_email IS NULL OR lower(v_email) NOT LIKE '%@littlefounders.ai' THEN
            RAISE EXCEPTION 'superadmin is only for a confirmed @littlefounders.ai address' USING ERRCODE = 'check_violation';
        END IF;

        RETURN NEW;
    END IF;

    -- admin and parent are granted by a superadmin. Parent verification (KYC) is a later feature and
    -- will add its own path here.
    IF NEW.granted_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles AS r WHERE r.user_id = NEW.granted_by AND r.role = 'superadmin'
    ) THEN
        RAISE EXCEPTION 'this role is granted by a superadmin' USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_user_roles
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

CREATE FUNCTION public.audit_user_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (actor_id, action, target_id, detail)
        VALUES (NEW.granted_by, 'role.granted', NEW.user_id, jsonb_build_object('role', NEW.role));

        RETURN NEW;
    END IF;

    INSERT INTO public.audit_log (actor_id, action, target_id, detail)
    VALUES (NULLIF(current_setting('lf.actor', true), '')::uuid, 'role.revoked', OLD.user_id, jsonb_build_object('role', OLD.role));

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();

-- The age record is written once and the trail is never rewritten.
CREATE FUNCTION public.refuse_change()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION '% on % is not allowed', TG_OP, TG_TABLE_NAME USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER trg_age_declarations_immutable
    BEFORE UPDATE ON public.age_declarations
    FOR EACH ROW EXECUTE FUNCTION public.refuse_change();

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.refuse_change();

-- ---------------------------------------------------------------------------------------------
-- The backend's interface (service_role only)
-- ---------------------------------------------------------------------------------------------

-- Everything Core needs to authorize one request, in one round trip: is the session still alive,
-- is the account usable, and what may it do. Roles are read here on every request, never from the
-- token, so a revoked role or a signed-out session stops working at once.
CREATE FUNCTION public.core_session_context(p_user uuid, p_session uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'active', u.deleted_at IS NULL
            AND (u.banned_until IS NULL OR u.banned_until <= now())
            AND EXISTS (
                SELECT 1 FROM auth.sessions AS s
                WHERE s.id = p_session AND s.user_id = u.id AND (s.not_after IS NULL OR s.not_after > now())
            ),
        'email', u.email,
        'username', p.username,
        'displayName', p.display_name,
        'locale', p.locale,
        'ageDeclared', EXISTS (SELECT 1 FROM public.age_declarations AS d WHERE d.user_id = u.id),
        'roles', COALESCE((SELECT jsonb_agg(r.role ORDER BY r.role) FROM public.user_roles AS r WHERE r.user_id = u.id), '[]'::jsonb)
    )
    FROM auth.users AS u
    JOIN public.profiles AS p ON p.user_id = u.id
    WHERE u.id = p_user;
$$;

-- Records the age and gives the account its base type, in one transaction. Idempotent: a second
-- call changes nothing and reports the type the account already has.
CREATE FUNCTION public.core_declare_age(p_user uuid, p_age integer, p_guardian_permission boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_inserted integer;
    v_role     text;
BEGIN
    IF p_age IS NULL OR p_age < 6 OR p_age > 100 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'AGE_OUT_OF_RANGE');
    END IF;

    IF p_age < 13 AND p_guardian_permission IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_REQUIRED');
    END IF;

    INSERT INTO public.age_declarations (user_id, declared_age, guardian_permission)
    VALUES (p_user, p_age, COALESCE(p_guardian_permission, false))
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 1 THEN
        v_role := CASE WHEN p_age < 18 THEN 'child' ELSE 'universal' END;
        INSERT INTO public.user_roles (user_id, role) VALUES (p_user, v_role);
        INSERT INTO public.audit_log (actor_id, action, target_id, detail)
        VALUES (p_user, 'age.declared', p_user, jsonb_build_object('type', v_role, 'guardianPermission', COALESCE(p_guardian_permission, false)));
    ELSE
        SELECT r.role INTO v_role FROM public.user_roles AS r WHERE r.user_id = p_user AND r.role IN ('child', 'universal');
    END IF;

    RETURN jsonb_build_object('ok', true, 'type', v_role, 'recorded', v_inserted = 1);
END;
$$;

-- A child who has turned 18 becomes a universal user. Called when a session starts or is renewed.
CREATE FUNCTION public.core_sync_base_type(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF public.effective_age(p_user) >= 18 AND EXISTS (
        SELECT 1 FROM public.user_roles AS r WHERE r.user_id = p_user AND r.role = 'child'
    ) THEN
        PERFORM set_config('lf.actor', '', true);
        DELETE FROM public.user_roles AS r WHERE r.user_id = p_user AND r.role = 'child';
        INSERT INTO public.user_roles (user_id, role) VALUES (p_user, 'universal');
    END IF;
END;
$$;

-- Sign-in by username: the address the code is sent to. Null when nobody has that username; the
-- caller must answer the same either way.
CREATE FUNCTION public.core_email_for_username(p_username text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT u.email
    FROM public.profiles AS p
    JOIN auth.users AS u ON u.id = p.user_id
    WHERE p.username = lower(p_username) AND u.deleted_at IS NULL AND u.email IS NOT NULL;
$$;

CREATE FUNCTION public.core_set_username(p_user uuid, p_username text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_username text := lower(p_username);
BEGIN
    IF v_username IS NULL OR v_username !~ '^[a-z0-9_]{3,20}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'USERNAME_INVALID');
    END IF;

    -- Names that could pass for the product or its staff.
    IF v_username ~ '^(admin|administrator|superadmin|root|support|help|staff|team|moderator|system|security|official|littlefounders|little_founders|lf_.*|.*_official)$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
    END IF;

    UPDATE public.profiles AS p SET username = v_username WHERE p.user_id = p_user;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
    END IF;

    RETURN jsonb_build_object('ok', true, 'username', v_username);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
END;
$$;

-- Staff grants. Only `admin` and `parent` go through here; `superadmin` is given by a person with
-- database access (docs/security/SECURITY-GUIDE.md), so the first one does not need a grantor.
CREATE FUNCTION public.core_grant_role(p_actor uuid, p_target uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF p_role NOT IN ('admin', 'parent') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ROLE_NOT_GRANTABLE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles AS r WHERE r.user_id = p_actor AND r.role = 'superadmin') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles AS r WHERE r.user_id = p_target AND r.role = 'universal') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'TARGET_NOT_ELIGIBLE');
    END IF;

    INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (p_target, p_role, p_actor)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.core_revoke_role(p_actor uuid, p_target uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF p_role NOT IN ('admin', 'parent') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ROLE_NOT_GRANTABLE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles AS r WHERE r.user_id = p_actor AND r.role = 'superadmin') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    PERFORM set_config('lf.actor', p_actor::text, true);
    DELETE FROM public.user_roles AS r WHERE r.user_id = p_target AND r.role = p_role;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Supabase's default privileges hand new functions to every API role. Take that back: these are
-- the backend's alone.
REVOKE ALL ON FUNCTION
    public.effective_age(uuid),
    public.handle_new_user(),
    public.touch_updated_at(),
    public.guard_user_roles(),
    public.audit_user_roles(),
    public.refuse_change(),
    public.core_session_context(uuid, uuid),
    public.core_declare_age(uuid, integer, boolean),
    public.core_sync_base_type(uuid),
    public.core_email_for_username(text),
    public.core_set_username(uuid, text),
    public.core_grant_role(uuid, uuid, text),
    public.core_revoke_role(uuid, uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.core_session_context(uuid, uuid),
    public.core_declare_age(uuid, integer, boolean),
    public.core_sync_base_type(uuid),
    public.core_email_for_username(text),
    public.core_set_username(uuid, text),
    public.core_grant_role(uuid, uuid, text),
    public.core_revoke_role(uuid, uuid, text)
TO service_role;
