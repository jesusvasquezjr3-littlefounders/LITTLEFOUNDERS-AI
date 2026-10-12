---
title: F-002 Emails
status: draft
updated: 2026-10-11
---

# F-002 Emails

> Every email LittleFounders sends: what it looks like, which ones exist, how one reaches a person in their language, and how the optional ones are stopped.

> **Status: draft.** Built on 2026-10-10 from the owner's decisions D-032 to D-035 in [[DECISIONS]], and run end to end on a local stack with a mail catcher. **The owner approved the design the same day**, after the picture was redone without its yellow panel. Not deployed, and not yet looked at in real mail programs (Gmail, Outlook, Apple Mail). The open points are at the end.

## Summary

There is one design, and every email is built in it. The authentication service no longer writes or sends mail: when it needs a code delivered it hands the code to Core, signed; Core picks the email and the account's language and asks the mail service (`email-server/`) for it; the mail service owns every word and the HTML, and relays through Amazon SES as before. The sign-in flow of [[F-001-authentication]] is unchanged for the person.

## The design

The owner's list, top to bottom (D-034). One frame, `email-server/src/mail/layout.ts`; a new email fills a `Message` and gets all of it.

| Part | What it is |
|---|---|
| Logo | The color logo, centered, on the page color |
| Title | One sentence, 30 px, weight 800 |
| Picture | The four characters seen from above, close together, only their heads turned up to the reader ([[CHARACTER-COMPOSITIONS]], scene `email`). Transparent, with no background and no border: it sits on the email's own color, light or dark, like the scenes in the product |
| Message | One or two short paragraphs |
| Action | A six-digit code in a soft box (one piece of text, so it is copied whole), or one button, or nothing |
| Closing | A closing line and the signature |
| Notes | A pale yellow box (`--v-yellow-soft`) with the advice that goes with this email |
| Footer | The logo in ink, the four social marks (no links yet, T-032), the rights line, why the email arrived, and "Unsubscribe" |

Everything is centered. Colors, the typeface (Plus Jakarta Sans) and the button (the primary pill, 56 px high) are the frontend's ([[DESIGN-SYSTEM]], `frontend/src/styles/lf-theme.css`). The email follows the reader's color mode where the mail program allows it (the dark tokens, and the footer logo in white).

What a mail program can and cannot do shapes the rest:

- Tables for structure and every style written on its element; the `<style>` block only adds the typeface, the narrow-screen sizes and the dark colors. Where it is ignored the email is still whole.
- The typeface loads in Apple Mail and a few others. Gmail and Outlook replace it with the system typeface; nothing can change that.
- PNG only for images (no WebP, no SVG). They are served by the site at `/email/v1/` (`frontend/public/email/v1/`, 138 KB in all, the picture 89 KB). Emails that were already sent point at these files forever: **never rename or delete one; add a `v2` folder.**
- The ink logo carries a thin outline in the page color, invisible on a light page, so it stays readable in programs that turn a light email dark by themselves.
- Text is never cut: it wraps. Checked at 320, 360, 390 and 700 px.
- The subject and the inbox preview never carry the code, so it does not show on a lock screen or in the delivery history.

## The emails

`email-server/src/mail/templates.ts`. Words: `email-server/src/mail/copy/` (`en-US.ts`, `es-MX.ts`, `pt-BR.ts`), typed against one shape so a missing sentence is a build error. Written to the humanizer rule ([[AI-WORKFLOW]]).

| Name | Kind | Sent when | Sent today |
|---|---|---|---|
| `sign-up-code` | account | A code is asked for an address that has no confirmed account | yes |
| `sign-in-code` | account | A code is asked for an account that exists | yes |
| `welcome` | product | Once, when a new account records its age (the account is complete). A button opens the site | yes |
| `email-change-code` | account | An account asks to move to this address | designed, nothing sends it (T-029) |
| `email-changed` | account | Tells the old address the account moved; shows the new one masked (`j•••@example.com`) | designed, nothing sends it (T-029) |
| `account-closed` | account | Confirms an account was closed | designed, nothing sends it (T-029) |

The last three are ready so the features that need them do not start from nothing; their words describe behavior that is not decided yet and are confirmed when each feature is designed.

`account` emails are part of using the account and always arrive. `product` emails are optional: they carry the one-click unsubscribe headers and are not sent to an account that unsubscribed.

`npm run preview` in `email-server/` writes every email in every language to `email-server/preview/` (not tracked) to open in a browser. Nothing is sent.

## The account's language

D-033. `profiles.locale` is the language the person uses the site in, and every email is written in it.

- A new account takes the language the site was showing when the code was asked for.
- Signed in, whenever the site's language differs from the account's (right after signing in, or when the person changes it in the topbar), the frontend saves it: `PUT /api/v1/account/locale`.
- A request made while signed out never changes an account's language. Otherwise anyone who typed somebody's address could change the language of that person's emails.

## How an email is sent

```
asks for a code        POST /auth/code            Core --> authentication service (/otp)
the code is made                                   authentication service
handed over, signed    POST /hooks/send-email      authentication service --> Core
email chosen           POST /api/v1/send           Core --> mail service
built and relayed                                  mail service --> Amazon SES
```

- **The hook** (`backend/src/routes/hooks.ts`). The authentication service's "send email" hook, signed the Standard Webhooks way: an HMAC-SHA256 of the id, the timestamp and the exact body, with a secret only the two services hold. Core refuses a call without a valid signature or older than five minutes, before reading the body as anything. `signup` becomes `sign-up-code` and `magiclink` becomes `sign-in-code`; any other kind is refused, so nothing unexpected is ever sent. The code passes through Core in memory and is never logged or stored.
- **The mail service** takes the name of an email, a language and the few values it needs, with the internal key. It cannot be asked to send words or HTML of the caller's choosing.
- **The welcome** is sent by Core when the age is recorded for the first time; the answer to the person does not wait for it.
- An alternative was tried and dropped: Core asking the authentication service's admin interface for a code and mailing it itself. For an address that had asked for a code and not entered it, that left two valid codes at once.

## Unsubscribe

D-035. `profiles.product_emails`, true by default.

- The link in the footer opens `/unsubscribe?token=…` on the site (`frontend/src/features/email/Unsubscribe.tsx`). Opening it changes nothing; the person presses the button, and can undo it there. A mail scanner that follows every link unsubscribes nobody.
- Optional emails also carry `List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058), which a mail program turns into its own button and posts to `POST /api/v1/email/unsubscribe/one-click?token=…`.
- The token names the account and proves Core wrote it (the account id and an HMAC of it, with a key derived from the session secret for this purpose only). It can switch that account's optional emails off or on and nothing else, and it works without signing in.

## Data model

`database/migrations/0002_email.sql`.

| Object | Holds | Personal data |
|---|---|---|
| `profiles.product_emails` | Whether the account takes optional emails | no |
| `email_logs` | One line per email: address, subject, which email, language, account, status (`queued`, then `relayed` once Amazon SES accepted it). Never the body, so never a code | the address; a line is kept 90 days, and an account that is deleted takes its lines with it (`0004_mail_least_privilege.sql`) |
| `core_mail_context`, `core_set_locale`, `core_set_product_emails` | Functions for Core, executable by `service_role` only | |

`email_logs` has row-level security with policies for one role, `mail_service`, which may read, add a line and update a line's status, and can do nothing else in the database: no other table, no function. It is the mail service's own role (`0004_mail_least_privilege.sql`); the service key has no privilege on the table any more and is not given to the mail service. The key is a token that names the role, minted with `database/scripts/mint-role-key.mjs`, and the gateway lets it through to the REST routes only (`MAIL_SERVICE_KEY` on the gateway and on the mail service). The first code of a brand-new account is sent while the account is still being created, so its line is written without the link to the account and leaves with the 90-day rule.

## API

Core, base path `/api/v1`, in addition to [[F-001-authentication]]:

| Method and path | Caller | Body | Answers |
|---|---|---|---|
| `PUT /account/locale` | signed in | `{ locale }` | `{ locale }` |
| `POST /email/unsubscribe` | the site's page | `{ token, subscribed? }` | `{ subscribed }`; `BAD_REQUEST` for a token Core did not write |
| `POST /email/unsubscribe/one-click?token=` | a mail program | ignored | `{ subscribed: false }` |
| `POST /hooks/send-email` | the authentication service | its hook payload, signed | `{}`; 401 without a valid signature, 422 for a kind that is not sent |

The last two are let in before the origin check, because their callers are not browsers; each proves itself its own way (the token, the signature).

Mail service: `POST /api/v1/send` with `{ to, template, locale, data, userId?, unsubscribe? }` and the `x-internal-api-key` header.

## Security review

- **A forged hook call** could make Core send a code-shaped email to any address. Refused without the signature; the signature covers the body, a captured call is useless after five minutes, and within them it does nothing either: a call is acted on once per `webhook-id`, and a copy gets the answer of a call that went well and sends no email.
- **The code** is in the email body only. Not in the subject, the preview, a log line or `email_logs`.
- **Injection into an email.** Every value is escaped before it enters the HTML; the code must be six digits and the addresses must parse, or the mail service refuses.
- **The mail service as an open relay.** It builds only its own emails, and only for a caller with the internal key. The SMTP relay behind it listens on `127.0.0.1` only and refuses every source that is not this machine. Until the security review of 2026-10-10 it also listened on the private network and trusted every private address, from the time when the authentication service submitted its mail over SMTP: any service on that network could have sent any words from our domain without the key. That listener is removed (`haraka/config/smtp.ini`, `haraka/plugins/relay_internal.js`).
- **The hop to Amazon SES.** The relay sends nothing over a connection that is not encrypted and verifies the smarthost's certificate; a message the smarthost does not take is deferred, never delivered straight to the recipient's mail server (`haraka/plugins/forward_secure.js`, `no_direct_delivery.js`).
- **An old link.** An unsubscribe token carries the day it was made and stops working 180 days later; a newer email carries a newer one.
- **Addresses in logs.** The relay logs at `warn` and the mail service logs the kind of a failure, so no address is written to a log.
- **The mail service's reach into the database.** It holds a key that can touch the delivery history and nothing else; the relay's child process receives only the variables it uses, not the service's whole environment.
- **Unsubscribe links.** The token cannot be forged without the key, grants one switch, and tells nothing about the account; a token for an account that no longer exists gets the same answer. The token is in the page's address, so no analytics script is loaded on `/unsubscribe` and no tracker is ever given an address's query string (`frontend/src/lib/analytics.tsx`); the site's referrer policy keeps it out of requests to other sites.
- **Language tampering.** Only the signed-in person changes their account's language.
- **Children's data.** The emails hold no name, age or account detail. `email_logs` holds addresses: a line is removed after 90 days (a nightly job in the database, `purge_email_logs`), and when an account is deleted its lines are deleted with it.
- **Images** load from the site when an email is opened, so the site's host sees that request like any other. No tracking pixel and no link tracking are used.

## Rollout

With the deployment of F-001 (T-025), in this order:

1. **Frontend first**: the images under `/email/v1/` and the typeface's cross-origin header (`frontend/vercel.json`) must be live before an email is sent.
2. **Database**: `0002_email.sql` and `0004_mail_least_privilege.sql`. Check that the nightly job exists (`SELECT jobname FROM cron.job`); where `pg_cron` is not installed the migration says so, and `SELECT public.purge_email_logs(90)` has to be scheduled another way.
3. **The mail service's key**: mint it once with `database/scripts/mint-role-key.mjs mail_service` (it reads the JWT secret from the environment and prints the key; it goes straight into the two services' variables and nowhere else). Set it as `MAIL_SERVICE_KEY` on the **gateway** (Railway `kong`) and on the **mail service**, and remove `SUPABASE_SERVICE_ROLE_KEY` from the mail service: it is not read any more, and the service says so at boot while it is still there.
4. **Mail service** (Railway `email-server`): deploy; optional `FRONTEND_URL` (default `https://littlefounders.ai`). The Amazon SES keys are not touched. `NODE_ENV` must be exactly `production`. **This version has no SMTP listener on the private network**, so it is deployed only once the authentication service hands its emails to Core (step 6): deployed earlier, the authentication service would have nowhere to submit its mail.
5. **Core** (Railway `littlefounders-backend`): `EMAIL_SERVER_URL` and `INTERNAL_API_KEY` are there already; add `SEND_EMAIL_HOOK_SECRET`.
6. **Authentication service** (Railway `auth`): add `GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`, `GOTRUE_HOOK_SEND_EMAIL_URI=https://api-b2c.littlefounders.ai/api/v1/hooks/send-email` (it must be https) and `GOTRUE_HOOK_SEND_EMAIL_SECRETS` with the same secret (`v1,whsec_` followed by a base64 key of 32 random bytes). From then on its `GOTRUE_MAILER_TEMPLATES_*` and `GOTRUE_MAILER_SUBJECTS_*` are not used and can be removed.

Rollback: the previous deployment of the mail service (which still has the network listener), then switch `GOTRUE_HOOK_SEND_EMAIL_ENABLED` off, and the authentication service sends its own mail over SMTP again. Switching the hook off alone is not enough any more.

## How it was checked

- 31 end-to-end cases on the local stack, all as expected: the sign-up code in the language the site was in, the account's language saved and used for the welcome and for a later sign-in code asked from a site in another language, one welcome only, both unsubscribe doors and the undo, changed tokens, the hook without a signature, with a wrong key and with an old timestamp, a kind of email that is not sent, the mail service without its key or with a free-form email, and the delivery history.
- `npm run audit:signin` (the whole sign-in window, reading the code from the new email) passes.
- Every email looked at in a browser: the three languages, light and dark, 320 to 700 px; and one as delivered to the mail catcher.
- `/unsubscribe` walked in the three languages, light and dark, 320, 390 and 1440 px; `audit:a11y` clean.
- `type-check`, `lint` and `build` in `backend/`, `email-server/` and `frontend/`.
- After the second round of the review: the real relay against three smarthosts. One that offers no TLS: nothing is sent, not the password and not the email. One whose certificate nobody vouches for: nothing arrives, and nothing is delivered another way. One with a trusted certificate: the email arrives. No address and no password in the relay's log in any of the three. A signed hook call sent twice sends one email. An unsubscribe token works at 179 days and is refused at 181.
- After the security review of 2026-10-10, on the local stack: with the mail service's own key the history is read, a line is added and its status changed, while changing who an email went to, deleting a line, reading profiles, running a backend function, purging the history and the auth and database-admin routes are all refused (403); the service key and the anon key are refused on the history. Deleting an account removes its lines; `purge_email_logs(90)` removes a line of 91 days and keeps one of 89; the nightly job is scheduled. The real relay (Haraka) was booted locally with the mail catcher as its smarthost: it listens on `127.0.0.1:2525` and nowhere else, port 587 is closed on every address, and an email sent through it with the updated mail library arrives. `npm audit --omit=dev` in `email-server/`: 0 vulnerabilities (it was 1 critical, 3 high, 1 moderate). The 31 cases above were run again.

Not checked: real mail programs (rendering differs in each), real delivery through Amazon SES, the hook over https between the production services.

## Open points

- [ ] Look at the emails in Gmail (web, Android, iOS), Outlook and Apple Mail before production, in both color modes.
- [ ] The social marks have no links (T-032). A postal address in the footer is required by anti-spam law for promotional email in several countries: needed before the first promotional email.
- [x] What "Unsubscribe" stops: the optional emails, never the ones about the account. Confirmed by the owner (D-035).
- [ ] How long `email_logs` lines are kept (T-031).
- [ ] The words of the three emails nothing sends yet, when their features are designed (T-029).
- [ ] A person who keeps receiving codes they did not ask for has no way to block them yet.

## Related

- [[F-001-authentication]]
- [[DECISIONS]]
- [[CHARACTER-COMPOSITIONS]]
- [[DESIGN-SYSTEM]]
- [[ENVIRONMENT-SETUP]]
- [[SECURITY-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[DATABASE-GUIDE]]
- [[API-GUIDE]]
- [[BUILD-TASKS]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- An email is added, removed or reworded, or the frame changes.
- How an email is sent, or what proves a call, changes.
- An open point is closed.
