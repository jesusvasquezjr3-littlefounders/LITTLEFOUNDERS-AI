# email-templates — branded, trilingual GoTrue auth mail

> Source of the transactional **auth** emails LittleFounders sends. Rendered by
> **GoTrue** (Supabase self-hosted), delivered by **Courier** (`email-server/`,
> Haraka → Amazon SES). Delivery contract: `email-server/AGENTS.md`. Deploy wiring:
> `database/DEPLOYMENT.md` → "GoTrue → Courier email wiring".

## What these are

Five email-safe HTML templates, styled in the LittleFounders **Arcade** brand
(navy `#080f28`, papaya `#ff775c` CTA, blue `#456dff` links, Figtree, pill button,
rounded card on a soft `#eef1fb` field). They live in `frontend/public/` so Vercel
serves them as **static files** at `https://littlefounders.ai/email-templates/<name>.html`.

| File | GoTrue event | Wired via |
|---|---|---|
| `confirmation.html` | Sign-up email confirmation | `GOTRUE_MAILER_TEMPLATES_CONFIRMATION` |
| `recovery.html` | Password reset | `GOTRUE_MAILER_TEMPLATES_RECOVERY` |
| `magic_link.html` | Passwordless sign-in link | `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` |
| `invite.html` | Invite to the platform | `GOTRUE_MAILER_TEMPLATES_INVITE` |
| `email_change.html` | Confirm a new email address | `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE` |

Subjects are set alongside them via `GOTRUE_MAILER_SUBJECTS_*` (on the Railway
`auth` service). `lf-logo-email.png` is the header logo (embedded by absolute URL —
email clients can't read relative paths).

## How the language selector works (en-US / es-MX / pt-BR)

Emails are **English by default** and localize to the user's **registration locale**
with zero extra infrastructure — GoTrue renders each template through Go's
`text/template`, and every user-facing string is a three-way conditional keyed on
the locale GoTrue exposes as `{{ .Data.locale }}`:

```gotmpl
{{ $l := index .Data "locale" }}
...
{{ if eq $l "es-MX" }}Confirma tu correo{{ else if eq $l "pt-BR" }}Confirme seu e-mail{{ else }}Confirm your email{{ end }}
```

The `{{ else }}` branch is always **English** — any unknown/absent locale falls
back to en-US (the §1.8 key source of truth). The locale reaches GoTrue because
Core passes it into the user's `user_metadata` at signup (from the profile
language-of-record), and GoTrue surfaces `user_metadata` as `.Data` in templates.

GoTrue substitution tokens used: `{{ .ConfirmationURL }}` (the action link — same
token name across all five events), plus the preheader/body copy. No PII beyond the
action URL is placed in any template (§1.9).

## Editing rules

- **Email HTML, not web HTML.** Table layout, inline styles, one `<style>` block for
  progressive enhancement only; the papaya CTA is a bulletproof MSO VML button with a
  non-MSO `<a>` fallback — keep both branches in sync when you change button copy.
- **Every user-facing string stays trilingual** — a new sentence needs all three
  branches in the same edit (English is the `{{ else }}`). There is no i18n JSON here;
  the conditional *is* the mechanism.
- **Keep the `{{`/`}}` balanced.** GoTrue fails the render (and the email never sends)
  on a malformed template — sanity-check that each `{{ if }}` has its `{{ end }}`.
- **These are public static files.** They must contain no secrets and no minor PII —
  only brand chrome and the GoTrue action token. Redeploys ship with the frontend.
- After editing, GoTrue re-fetches by URL on the next send (it doesn't cache
  aggressively); no `auth`-service restart is normally needed.
