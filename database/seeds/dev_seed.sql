-- dev_seed.sql — LOCAL DEVELOPMENT ONLY. Never run against production.
-- Creates one user per role + one family with 2 parents and 1 kid.
-- Requires the local Supabase stack (auth schema present).

-- Local-only auth users (password for all: "password123" is NOT set here —
-- create sessions via GoTrue admin API or Studio; these rows satisfy FKs).
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'universal@example.com'),
    ('00000000-0000-0000-0000-000000000002', 'parent1@example.com'),
    ('00000000-0000-0000-0000-000000000003', 'parent2@example.com'),
    ('00000000-0000-0000-0000-000000000004', 'kid@example.com'),
    ('00000000-0000-0000-0000-000000000005', 'bigfounder@example.com'),
    ('00000000-0000-0000-0000-000000000006', 'admin@example.com'),
    ('00000000-0000-0000-0000-000000000007', 'super@littlefounders.ai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, display_name, locale)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Uni Versal', 'en-US'),
    ('00000000-0000-0000-0000-000000000002', 'Parent One', 'es-MX'),
    ('00000000-0000-0000-0000-000000000003', 'Parent Two', 'es-MX'),
    ('00000000-0000-0000-0000-000000000004', 'Kiddo', 'es-MX'),
    ('00000000-0000-0000-0000-000000000005', 'Big Founder', 'pt-BR'),
    ('00000000-0000-0000-0000-000000000006', 'Admin', 'en-US'),
    ('00000000-0000-0000-0000-000000000007', 'Super Admin', 'en-US')
-- 0003's signup trigger already created these profiles (empty display_name),
-- so the seed must UPSERT to win:
ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name, locale = EXCLUDED.locale;

INSERT INTO public.user_roles (user_id, role)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'universal'),
    ('00000000-0000-0000-0000-000000000002', 'parent'),
    ('00000000-0000-0000-0000-000000000003', 'parent'),
    ('00000000-0000-0000-0000-000000000004', 'kid'),
    ('00000000-0000-0000-0000-000000000005', 'bigfounder'),
    ('00000000-0000-0000-0000-000000000006', 'admin'),
    ('00000000-0000-0000-0000-000000000007', 'superadmin')
ON CONFLICT DO NOTHING;

-- One family: two parents + one kid (multiple parents by construction)
INSERT INTO public.families (id, name, created_by)
VALUES ('10000000-0000-0000-0000-000000000001', 'The Examples', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_members (family_id, user_id, member_role)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'parent'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'parent'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'kid')
ON CONFLICT DO NOTHING;

-- Verified guardian links (the kid invariant: ≥1 verified guardian)
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
VALUES
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'verified', now()),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'verified', now())
ON CONFLICT ON CONSTRAINT guardian_link_unique DO NOTHING;

-- Demo published courses for the learn/ dashboard (0002 content skeleton is
-- PROVISIONAL — these are placeholders for UI work, not real curriculum).
INSERT INTO public.courses (id, slug, title, status)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'money-basics',
     '{"en-US": "Money Basics", "es-MX": "Fundamentos del dinero", "pt-BR": "Fundamentos do dinheiro"}'::jsonb,
     'published'),
    ('30000000-0000-0000-0000-000000000002', 'saving-superpowers',
     '{"en-US": "Saving Superpowers", "es-MX": "Superpoderes del ahorro", "pt-BR": "Superpoderes da poupança"}'::jsonb,
     'published'),
    ('30000000-0000-0000-0000-000000000003', 'first-business',
     '{"en-US": "My First Business", "es-MX": "Mi primer negocio", "pt-BR": "Meu primeiro negócio"}'::jsonb,
     'published'),
    ('30000000-0000-0000-0000-000000000004', 'draft-course',
     '{"en-US": "Draft (must never render)", "es-MX": "Borrador (no debe verse)", "pt-BR": "Rascunho (não deve aparecer)"}'::jsonb,
     'draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, course_id, position)
VALUES
    ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1),
    ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2),
    ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 3),
    ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 1),
    ('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 2),
    ('31000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 1)
ON CONFLICT (id) DO NOTHING;
