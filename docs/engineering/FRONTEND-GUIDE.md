---
title: Frontend guide
status: draft
updated: 2026-10-12
---

# Frontend guide

> How the web client is built: the stack, the structure, the five non-negotiable rules, the conventions, how a change is checked, and what is still open.

> **Status: draft.** The five rules and the library decisions are the owner's and in force ([[DECISIONS]] D-007, D-008, D-009). The stack, structure and conventions below record what is built and how it is done today; the open decisions at the end are marked as such and are not guessed.

## Role

Agents and humans follow this for every change under `frontend/`. Which skill or library to reach for, and the step-by-step procedures, are in [[FRONTEND-TOOLKIT]]. Visual rules live in [[DESIGN-SYSTEM]]; the library roles and wiring in [[UI-LIBRARIES]]; the evidence behind color, shape and children's ergonomics in [[RESEARCH-FOUNDATION]]; language-level rules in [[CODE-STYLE-GUIDE]].

## Read this when

- Any change under `frontend/`.
- Adding a page, a section, a component, a string, a token or a dependency.
- Adding a route, state, data call or form (the open decisions at the end apply first).

## The five non-negotiable rules

The owner set these on 2026-10-09 (D-009 in [[DECISIONS]]). They apply to every screen, every library component and every change under `frontend/`; nothing is exempt, and a change that breaks one is not done.

1. **i18n: no hardcoded text.** Every word a person can read or hear has a key in `src/i18n/en-US`, `es-MX` and `pt-BR`, and the three files carry the same keys. That includes accessible names (`aria-label`, `title`, `alt`), toasts, loading and error messages, the document title, the brand name, the contact address and the language names (each in its own language). A string literal in a component is a defect. When a library supplies a default string (a close label, a "Total", a loading name), pass ours through its prop, or do not use that part of the component; the known cases are in [[UI-LIBRARIES]]. Copy is written for the language it is read in, to the humanizer standard (rule 12 in [[CLAUDE]]); numbers and dates are formatted for the active locale.
2. **Desktop and mobile, each optimized, on clear grids.** Every page uses one grid inside the shell's container (1120 px, margins 16 px on phones and 24 px from 640 px, so the content is at most 1072 px): 4 columns below 768 px with a 16 px gutter, 8 columns from 768 px and 12 columns from 1024 px with a 24 px gutter. A section places its blocks with `col-span-*` on that grid and never invents its own columns or gutter, so column edges line up from one section to the next. Alignment: on phones (below 768 px) every block is centered on the page's axis, so the page is symmetric; from 768 px text blocks start on the container's left edge, shared by the header, the content and the footer, and no text block is inset (no padded pills or bands that move the text away from that line). A composition that is symmetric by design (the problem section: centered heading, text and scene as mirror halves) stays centered at every width. Between any two sections the space is the same: 96 px, then 128 px from 768 px. Breakpoints are Tailwind's `sm` 640, `md` 768, `lg` 1024 and `xl` 1280. Where an image and a text sit side by side they take the same number of columns and are centered on each other, measured on what is visible (a scene is cropped so the characters, not the empty frame, sit at the middle); below 1024 px they stack, text first. The constants live in `frontend/src/features/landing/type.ts` (`grid`, `section`) and move to a shared module when a second page needs them. The smallest supported width is 320 px. Layout is never done with absolute positioning. On a phone the primary action is full width and actions stack. Running text is medium weight in the soft ink color, not the muted gray, and 17 px on phones. A change is checked at 320, 360, 390, 768, 1024 and 1440 px, in light and dark, in all three languages.
3. **Text is never cut.** No ellipsis, no line clamp, no fixed-height box around text, no clipping by `overflow: hidden`, no horizontal page scroll. Labels wrap and their container grows (buttons included: the Cojeev button is made to wrap in `lf-theme.css`), long words and addresses break, and flex and grid children that hold text can shrink (`min-w-0`). Design for the longest language: es-MX and pt-BR run well past en-US.
4. **Iconography: every icon and symbol is our own, in color, and alive** (D-054, the owner's absolute rule; how one is drawn, how it moves and the steps to make a new one are in [[ICON-SYSTEM]]). An icon is a small 2D picture in full color: shapes filled with the brand's colors, no outline around anything, round. It is kept as a Lottie file and it moves: `idle` is a loop that shows the thing is on (a flame burns, a chimney smokes), `hover` answers a pointer or the keyboard's focus, `select` plays when what it stands for becomes the current thing. No icon comes from an icon library. **How:** an icon is described once in `tools/icons/definitions.mjs` (layers, colors, keyframes); `npm run icons` writes its Lottie file (`src/icons/lottie/<name>.json`) and its rest frame (`src/icons/rest.ts`) and checks it against the contract in `tools/icons/lottie.mjs` (48 grid, 60 frames a second, no images, no expressions, at most fourteen layers and 24 KB, round rectangles, every movement starting and ending in the rest pose). `AppIcon` (`components/AppIcon.tsx`) draws it: the rest frame is plain SVG in the page, so an icon is never late or blank; the player (`lottie-web`, its light build, which has no `eval`: [[SECURITY-GUIDE]]) and the animation are fetched when the icon first has to move; an icon off screen does not run; with reduced motion the rest frame is all there is and nothing is fetched. `/dev/icons` in the dev server shows them all. The few plain signs that cannot be a picture (a chevron, a cross) are drawn the same way in the text color. An icon never carries a meaning alone: it has an accessible name, and a meaning that matters (right or wrong, a status, a category) also has a word. **Not migrated yet:** the screens built before this rule (landing, sign-in, onboarding) had library icons until 2026-10-12, when all were replaced (T-012); the marks that belong to others (Google's, the social networks') stay as their owners draw them.
5. **Design from evidence.** Design claims about color, shape, gamification, rewards and children's motor ability are used only at the strength the literature gives them: grade A may become a rule, B a default, C a guideline with its caveat, D nothing. The evidence, the grades and what they mean for the current tokens are in [[RESEARCH-FOUNDATION]].

Also in force: **route paths are in English** whatever the interface language (D-011), and scenes with the characters follow [[CHARACTER-COMPOSITIONS]] (D-012).

## Stack and commands

Node 24. Everything below is run from `frontend/`.

| Piece | What is used |
|---|---|
| UI | React 19, TypeScript 5 in strict mode, React Router 7 |
| Build | Vite 6; `npm run build` type-checks, builds, then prerenders the SEO shell (`scripts/seo/`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), tokens in `src/styles/lf-theme.css` on top of Cojeev's token layer |
| Components | shadcn registries `@cojeev` and `@bklit`, plus Motion, Sileo and Thinking Orbs: [[UI-LIBRARIES]] |
| Copy | i18next only chooses and remembers the language; the copy itself is typed JSON per locale |
| Lint | ESLint (typescript-eslint) and the vendored anti-slop Oxlint rules |
| Data | `lib/api.ts` calls Core with the session cookies and parses every answer with Zod (`zod/mini`) |

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `http://localhost:5173`. Vite binds the IPv6 loopback: use `localhost`, not `127.0.0.1`. After changing `vite.config.ts` or installing a Tailwind or shadcn piece, stop and start it again. |
| `npm run type-check` | `tsc --noEmit`. `noUncheckedIndexedAccess` is off because the registries' copied code does not satisfy it |
| `npm run lint` | ESLint. Registry code is excluded |
| `npm run lint:slop` | Anti-slop rules on our own TypeScript: parse input at the boundary, no `unknown` parameters, no chained or unjustified type assertions. Registry code is excluded. Older files still have findings (T-001); new code should have none |
| `npm run build` | The production build, as CI runs it |
| `npm run render:signin` | Renders the sign-in window's scene to `public/landing/signin/`: a developer tool ([[CHARACTER-COMPOSITIONS]]) |
| `npm run render:loading` | Renders the loading window's four runners and builds their 8 sprite sheets into `public/loading/` (Chrome, and Python with Pillow 11.3 or later) |
| `npm run audit:*` | The audit tools in `tools/audit/`: developer tools, not a gate ([[FRONTEND-TOOLKIT]]) |

## Where things live

```
frontend/
  components.json        shadcn: aliases and the two registries
  index.html             theme boot script and the boot veil (inline on purpose; read its comments before touching it)
  public/                brand/ (logos, color and white), landing/ (hero and problem videos and posters),
                         fonts/ (Plus Jakarta Sans), og/, scenes/ (the 3D scenes, Git LFS: never delete or overwrite)
  scripts/seo/           the page table (titles, descriptions), prerender, sitemap, llms.txt
  tools/oxlint/          the vendored anti-slop rules
  tools/render/          the scene render tools (page, renderer, encoder); see CHARACTER-COMPOSITIONS
  tools/audit/           the audit tools (a11y, keyboard, layout, grid, scene, color, shot); output goes to audit-out/, not tracked
  src/
    main.tsx  App.tsx    entry, providers, routes
    components/          ours: AppShell, SiteFooter, TopbarControls, CookieConsentBanner, CircleFlag, icons/
    components/ui/       copied from the registries (Cojeev). Not edited, not linted; see the patch list in UI-LIBRARIES
    components/charts/   copied from the registries (Bklit). Same rule
    features/<name>/     one folder per page or feature; landing/ holds the sections and type.ts, notFound/ the 404 page,
                         auth/ the session, the sign-in window, the account controls and the page a Google sign-in returns to,
                         app/ the signed-in application: its layout, its home and its empty destinations ([[F-004-application]])
    icons/               the application's own icons, generated: lottie/<name>.json and rest.ts ([[ICON-SYSTEM]])
    i18n/                index.ts (language), copy.ts (typed bundles), useCopy.ts (hooks), <locale>/core.json, site.json, onboarding.json and app.json
    lib/                 api (the one way to call Core), analytics, consent and visitor, boot, footerLinks, motionPresets, utils;
                         cojeev/ and cojeev-motion/ are registry code
    styles/              app.css (the one entry), lf-fonts.css, lf-theme.css, cojeev/ (registry CSS)
    theme/               useTheme: light, dark or auto, sets both html.dark and html[data-mode], cross-fading the page via a View Transition (skipped for reduced motion)
```

- **Naming.** Components are PascalCase files with one main export; folders and non-component files are camelCase or lowercase. A component starts with a comment that says what it is for and which rule it applies.
- **Copy namespaces.** `core.json` holds the shell (skip link, theme and language controls, footer, brand, contact); `site.json` holds the landing and the cookie choice. A key lives in exactly one namespace; `useCoreCopy()` and `useSiteCopy()` read them, and a missing key is a type error. Add a namespace per feature when a feature needs one.
- **Styling.** Tailwind classes that read tokens (`text-[var(--v-ink-soft)]`, `bg-[var(--v-beige)]`); no raw hex values in components; `cn()` from `lib/utils` merges classes. Shared layout and type roles live next to the feature that owns them (`features/landing/type.ts`). The character avatars live in `features/avatars` ([[CHARACTER-AVATARS]]): `<Avatar character expression gaze />` and `<FloatingAvatar />`, with `speak()` and `react()` on a ref; an avatar is decorative unless given a translated `label`, it never carries words, and `/dev/avatars` (dev server only) shows them alive.
- **Theming.** Light and dark are both always designed. A color is added to `lf-theme.css` for both modes, with its label color chosen by measurement ([[RESEARCH-FOUNDATION]]), never inside a component.
- **Dependencies.** A new package needs a reason a library from [[UI-LIBRARIES]] cannot give; a new UI library needs the owner.

## Accessibility floor

Met on the landing and kept for every screen: the skip link is the first Tab stop; every interactive target is at least 48 px (76 px where a young child answers or plays, [[RESEARCH-FOUNDATION]]); focus is always visible; a dialog traps focus and returns it to what opened it; text contrast is at least 4.5:1 and component edges 3:1; color is never the only channel; reduced motion is honored once at the root (`MotionConfig reducedMotion="user"`) and per component where a library has its own switch; no axe violation in light and dark in en-US, es-MX and pt-BR.

## Interaction, motion and page furniture

The owner defined these eleven on 2026-10-10 ([[DECISIONS]] D-016). They belong to the shell and to shared code, so every page has them without asking; a new page only has to feed them (a title, a trail, its own blocks). Every motion honors reduced motion (opacity stays, movement goes), every string is a locale key, and every duration sits between 150 and 500 ms on the easing `ENTER` (`lib/motionPresets.ts`).

1. **Smooth animation on scroll.** A block rises 24 px and fades in once, the first time a quarter of it is on screen (`reveal`, spread on a `motion.*` element); siblings follow 80 ms apart (`STAGGER`). The hero animates on load. Nothing replays when the visitor scrolls back. Anchor jumps and the back-to-top scroll glide (`scroll-behavior: smooth`, in `app.css`).
2. **Button micro-interactions.** A button is always Cojeev's Button: its hover color per variant, the 1 px press, the busy state and its flow press come with it. An icon is always ours and answers its control by itself ([[ICON-SYSTEM]]). An interactive element that is not a Button uses Motion's `whileHover` and `whileTap` with the spring of the back-to-top button (stiffness 420, damping 32). No hand-written hover for a button.
3. **Hover states.** Written only inside `@media (hover: hover)` (`lf-theme.css`), so a tap never leaves one stuck on a phone. Links underline with a 4 px offset, a breadcrumb link goes to full ink, the logo link dims to 82 %. Focus is visible on everything, always, and does not depend on hover.
4. **Favicon.** The compact logo, the "LF" with the two children: `favicon.ico` (16, 32 and 48 px), `favicon-48.png`, `icon-192.png` and `icon-512.png` on a transparent ground, and `apple-touch-icon.png` (180 px) on white because iOS fills transparency with black. They were cut from the compact logo kept in the repository history (`frontend/public/favicon.png` at `4b509c74^`), without the wordmark under it, which is unreadable at 48 px.
5. **Back to top.** A round 48 px outline Button with an arrow (`BackToTop`, in the shell). It appears after one and a half screens, takes the visitor to the top and puts focus on `<main>` so it is not lost. On phones it sits above the sign-in bar; it steps aside while the cookie banner is open (`data-consent-banner` on `<html>`, `lf-theme.css`).
6. **Loading screen and skeletons.** First visit: the boot veil in `index.html`, a plain ground that dissolves once the app has painted. A page whose code is loading: `PageSkeleton` inside the shell (Cojeev Skeleton, the shape of a page on the page grid, so nothing jumps when it arrives). The Thinking Orb is for waits on work, not for page loads. The loading window for waits inside the platform is defined below (draft).
7. **Transitions.** A new page fades in with an 8 px rise over 300 ms and starts at its top (`AppShell`; an in-page `#anchor` keeps its own target). Changing the theme cross-fades the whole page over 450 ms (View Transition, `useTheme`). Dialogs, sheets and menus use Cojeev's own.
8. **Speed.** A page is its own lazy chunk (the landing, the 404 page; the avatars page is development only). Only the scene above the fold loads its video at once (`priority` on `LoopVideo`); a scene below it downloads its poster and nothing else until the visitor scrolls near it. Fonts are self-hosted and preloaded; icons are bundled path data, and a library's lazy icon data is not pulled in for one arrow (the breadcrumb uses our own chevron; the library's icon data was removed on 2026-10-12). Numbers: "Performance today".
9. **404 page.** `features/notFound/NotFound.tsx`, the `*` route inside the shell, so the header, the footer and the phone bar stay. Top to bottom: "Error 404" in red with a warning mark, at title size (21 px: the owner twice asked for it small) (`--lf-error`, a token measured for both color modes; the mark never stands alone), the scene with Rho and Liruf ([[CHARACTER-COMPOSITIONS]], scene `notfound`), the line "We can't find this page", a plain sentence and one Button to `/`. It asks crawlers not to index it. The server still answers 200 for an unknown path (`vercel.json` rewrites everything to the app shell), so this is the client's answer and not an HTTP status: a real 404 status needs the host to know the list of pages, which is a later decision.
10. **Breadcrumbs.** `components/Breadcrumbs.tsx` wraps Cojeev's Breadcrumb: Home, the sections between as links, the current page last as plain text with `aria-current`. Every page below the home page puts one at the top of its content, with labels from the locale files; the home page has none. The label of the nav and "Home" are keys in `core.json` (`siteShell.breadcrumb`, `siteShell.home`).
11. **Sign in, fixed on phones.** Below 768 px a full-width accent "Sign in" Button is pinned to the bottom edge (`MobileSignInBar`), above the page and under the cookie banner; the footer pads its bottom so nothing is covered. From 768 px the same Button sits in the topbar and the bar is gone. Both open the same window (`AuthDialog`; the buttons are `SignInButton`, `placement`). The bar is only for a visitor who is signed out: signed in, the topbar's round account button takes its place at every width.

### The loading window (built; the owner approved the designs on 2026-10-10)

Defined on 2026-10-10 for the waits that happen inside the platform. The first previews were glass, with a percentage and a title bar, and the owner rejected them: the window is the same kind of window as the sign-in one, in the product's own style ([[DECISIONS]] D-017).

- **Look.** The content of a Cojeev Dialog with the sign-in window's surface (tokens, ring, radius), `components/LoadingWindow.tsx`; no glass, no title bar, **no percentage**. The window does not take focus when it opens (`onOpenAutoFocus` is prevented, the content has no outline): it has nothing to press, and the dialog's brand focus ring drew a thick outline the owner found aggressive; what remains is the hairline edge of the surface. A bar with the runner above it and one word under it (`appShell.loading`, a locale key) in bold capitals: CSS `uppercase`, `font-extrabold`, 13 px, 10 % letter-spacing, full ink color. The runner casts no shadow (the owner removed it: it stands on a bar). `/dev/loading?runner=rho|zara|liruf|dina[&frame=N]` shows it open (dev server only).
- **Behavior.** Empty at the start, no character in view; the bar fills to 80 % in 2 seconds (ease out) and holds, so the wait feels short; the runner steps in as the bar starts and stands on its leading edge, running in place while it holds. When the work is done (`done`) the bar goes on to 100 % in 200 ms and `onFinished` fires. With reduced motion the bar jumps to 80 % and the runner stands on its first frame.
- **Assets.** One sprite sheet per character and per color mode, **4 x 2 = 8 files** in `public/loading/` (`<character>-<light|dark>.avif`), not 24 baked animations: the word is live text, so the three languages cost no file, and the bar and the window follow the theme. A visitor downloads one sheet. The dark sheet has an edge light and a soft halo so dark clothes and hair stay readable on the dark window. With no shadow the sheets are tighter: 26.0, 26.0, 26.1, 27.2, 28.7, 34.1, 38.4 and 51.6 KB. The halo is faint on purpose (the owner found a stronger one aggressive).
- **Format.** An AVIF sprite sheet, 12 frames side by side, alpha, quality 50, drawn at twice the size it is shown (a 2x screen), stepped by a CSS transform (`.lf-run` in `lf-theme.css`; the stride is 12 frames in 600 ms): a still image decoded once, it can be held on a frame, and it needs no animation decoder. Measured on the real frames: AVIF 26 to 48 KB per sheet (the 8 final sheets are 26 to 52 KB); a WebP sheet 62 to 106 KB, animated WebP 67 to 98 KB, animated AVIF 25 to 49 KB, lossless WebP 180 to 265 KB, GIF 59 to 90 KB with hard-edged transparency, PNG and APNG 250 to 360 KB. At 3x magnification AVIF q50 cannot be told from the source. A WebP sheet (q75) can ship as the fallback for browsers without AVIF; that is an open question. Animated formats were rejected because they cannot be held on a frame and keep an animation decoder running; GIF and APNG for weight and quality; a video because it has no alpha in every browser.
- **What the references say** (searched 2026-10-10; the sources are listed at the end of this bullet list). *Capitals:* short labels, buttons and acronyms are the accepted use of all caps; they read slower than mixed case because the letter shapes are uniform, and the remedy is letter-spacing of 5 to 12 % (0.05 to 0.12em), sufficient size and strong contrast, which is why the label is one word, tracked at 10 % and in full ink ([Hobday](https://anthonyhobday.com/sideprojects/visualtechniques/techniques/text/letter-spacing-on-all-capitals.html), [LogRocket](https://blog.logrocket.com/ux-design/casing-letters-enhances-visual-hierarchy), [Visa design system](https://design.visa.com/base-elements/typography/accessibility/)). *Waits:* Nielsen's limits are 0.1 s (instant), 1 s (the user keeps the thread) and 10 s (attention is lost, a progress indicator is needed); a looped indicator suits 2 to 9 s and a determinate bar 3 to 10 s, so a bar is right for the waits this window is for ([Workday Canvas](https://canvas.workday.com/v9/patterns/loading), [UX Collective](https://uxdesign.cc/loading-progress-indicators-ui-components-series-f4b1fc35339a)). *Perceived duration:* Harrison, Amento, Kuznetsov and Bell (UIST 2007) found that a pause at the beginning of a bar is more tolerable than one at the end, that a bar that speeds up toward the end feels faster, and that pulsing cues that quicken make the wait feel shorter ([Harrison](https://chrisharrison.net/index.php/Research/ProgressBars), [UX Movement](https://uxmovement.com/buttons/how-to-make-progress-bars-feel-faster-to-users/)). **The caveat:** the owner's design, a fast start and a hold at 80 %, is the opposite of that finding, so the hold is the weak point. It is kept as specified, with two mitigations built in (the runner never stops running, and the label is steady); an optional slow creep from 80 to about 92 % while the wait lasts is documented as an open decision, not built (T-024).
- **The runners.** Rendered from the artist originals (`glb/originals/`; the processed `glb/Rho.glb` and `glb/Liruf.glb` are torn, see [[CHARACTER-POSES]]). Rho, Zara and Liruf run a stride authored in code (legs half a cycle apart, arms against the legs, the knee folding while the leg swings through, forward lean, a bounce twice per cycle); Dina plays her own walk clip stepped into a trot. They face right, turned a little toward the viewer, on a transparent ground with a soft contact shadow. They are made by `npm run render:loading` (`tools/render/loading-scene.js` draws the 12 frames, `render-loading.mjs` drives it, `loading-sheets.py` builds the AVIF sheets with Pillow 11.3 or later); the sheets in `public/loading/` are its output and can be regenerated byte for byte in the same sizes. `/loading/*` is cached like the other images (`vercel.json`).
- **Decided by default, change them if the owner wants** (the owner approved the design and did not answer these): 12 frames (8 would save a third of the weight); AVIF only, with no WebP fallback (AVIF is supported since Chrome 85, Firefox 93 and Safari 16.4); the bar holds at 80 % with no creep; `LoadingWindow` is only the content, so whether the window is modal (Cojeev's Dialog dims the page, as the sign-in window does) or sits in a page block is the caller's choice; which character shows is a prop (`runner`), and nothing in the product waits on anything yet, so it is wired nowhere (T-024).

A page names itself with `usePageTitle(title)`, reveals its blocks with `reveal`, and is checked with the audit tools at the widths in rule 2.

## Sign-in, the session and calls to the backend

Built on 2026-10-10 ([[F-001-authentication]]); it settles three of the open decisions at the end of this page.

- **Calls to the backend.** One function, `api(path, schema, request)` in `lib/api.ts`. It sends the session cookies (`credentials: 'include'`), parses the answer with the schema it is given, and throws an `ApiFailure` with Core's error code for everything else. A component never calls `fetch` and never reads an answer that was not parsed. The backend's address is `VITE_BACKEND_URL`.
- **No token in the page.** The session is two `HttpOnly` cookies the page cannot read. Nothing in `src/` stores, reads or sends a token, and nothing may start to ([[SECURITY-GUIDE]]). The only thing kept in `localStorage` is the flag `lf.session` (the character `1`), so a visitor who never signed in makes no request to the backend at all.
- **The session** is `SessionProvider` and `useSession()` in `features/auth/session.tsx`: `status` (`loading`, `signedOut`, `signedIn`), `account`, and the actions (`requestCode`, `verifyCode`, `declareAge`, `signInWithGoogle`, `signOut`, `reload`). It is provided once, in `App.tsx`, above every page.
- **The window** is opened through `AuthDialogProvider` in `features/auth/AuthDialog.tsx`, also provided once; anything opens it with `useAuthDialog().open()` (or `open('signUp')`). The window itself, with its fields, is `features/auth/AuthWindow.tsx`: its own chunk (12.7 KB compressed), downloaded the first time it is opened and fetched early when the pointer or the focus reaches a Sign in button, so the landing does not carry a form most visitors never see. It is a Cojeev Dialog with the scene on top and one step at a time: choose, identifier, code, age. Fields are Cojeev's Field, Input, InputOTP and Checkbox. Each step has one primary button, disabled until there is an answer (D-020); a step change is a 200 ms fade on `ENTER`; a failure is a sentence in the window (`role="alert"`), and the focus goes back to the field. Closing the window returns the focus to what opened it. The window opens by itself at the age step for an account that has not said its age.
- **Asking for a code** does a small piece of work first (`lib/proofOfWork.ts`, called by `requestCode` in the session): Core hands out a challenge and sends a code only to a caller that solved it. It takes about a tenth of a second and the person sees nothing; the search pauses every few thousand tries so the page does not freeze. Core no longer says when an email could not be sent, so there is no sentence for it.
- **Errors are codes.** Core answers with a code; `useFailureText` in the window maps it to a sentence from `auth.errors` in the locale files. A new code needs its sentence in the three languages.
- **Forms.** A form is a `<form noValidate>` whose submit handler checks the value and shows our own sentence; the browser's validation bubbles are not used (they are not ours to translate or style). The same rule is checked again by Core, which is the one that counts.
- **Google** opens a small window on Core (`signInWithGoogle`); the page `/auth/callback` (`features/auth/AuthCallback.tsx`, outside the shell) tells the waiting page how it went over a `BroadcastChannel` and closes. When the browser refuses windows, the same trip happens in the tab.
- **Looking at it.** `npm run audit:signin` walks every step in a real browser against the local stack, runs axe-core on each step and saves the screenshots ([[FRONTEND-TOOLKIT]]).

## Performance today

Measured on 2026-10-09: about 289 KB of JavaScript, compressed, for the landing (React DOM 84, the app 131, Motion 49, i18n 17, router 7, the page 10) plus a lazy 77 KB chunk of icon data. React, Motion, the router and i18n are built into their own files so a deploy that changes only our code does not invalidate them in a returning visitor's cache. Re-measured on 2026-10-10 after the shared behaviors landed: the app chunk is 128 KB compressed (it was 131: the old page-loading orb is gone), the landing 10 KB, and the 404 page is its own 2 KB chunk loaded only on an unknown address; the lazy icon chunk is unchanged at 77 KB. Videos: the scene above the fold loads at once, the others download only their poster until the visitor scrolls near them (`LoopVideo`). Re-measured on 2026-10-10 after sign-in was built: the app chunk is 137 KB compressed (the session, the one function that calls the backend and Zod's small build add 9 KB), the sign-in window is its own 12.7 KB chunk loaded on demand, and the page a Google sign-in returns to is 0.7 KB. No budget is set yet (open decision below); cache headers are in `frontend/vercel.json`.

## Analytics, consent and the 3D scenes

Plausible, Umami and Google Analytics 4 load only after the visitor accepts the optional cookies (`lib/analytics.tsx`, `lib/visitor.ts`, [[OBSERVABILITY]]). A tracker is given a page's path and never its query string, and no tracker is loaded or told anything on a page whose address carries something private: `/unsubscribe` (the token of the link) and `/auth/callback`. A new page of that kind is added to `PRIVATE_PATHS`. The hero and problem scenes are looping videos with a poster that stays for reduced motion and less data (`features/landing/LoopVideo.tsx`); the interactive 3D character files are Git LFS and are not loaded by the landing.

## How a change is checked before it is called done

1. `npm run type-check`, `npm run lint` and `npm run build` pass; new code passes `npm run lint:slop`.
2. The page is looked at, not only built: light and dark, en-US, es-MX and pt-BR, at 320, 390, 768, 1024 and 1440 px, with the cookie banner and with it dismissed, the preferences sheet and the language menu opened.
3. Mechanical checks with the audit tools (`npm run audit:a11y`, `audit:keyboard`, `audit:layout`, `audit:grid`, `audit:color`; `audit:shot` to look at the page; see [[FRONTEND-TOOLKIT]]): axe-core with no violation; the keyboard pass; the layout pass (no horizontal scroll, no ellipsis, line clamp or clipped text); the grid pass when layout changed; the color pass when a token changed. Run a check with `--matrix` after a change that could affect it.
4. Copy is in all three locale files and passes the humanizer standard.
5. Documentation is part of the change (rule 11 in [[CLAUDE]]): the affected documents, their `updated` date and [[CHANGELOG]]. The commit stays local; the owner pushes.

## Open decisions

Not decided; do not guess them. Raise each with the owner when a feature needs it.

- Current state: two more routes exist outside the shell, `/onboarding` and `/onboarding/parent` ([[F-003-onboarding]]): one thing per screen, their own header (back, progress, close), and the step's name in the address. The answers given there are the second thing kept in `localStorage` (`lf.onboarding`, no token, erased after 30 days or on request).
- [ ] Routing beyond `/` and the 404 page, a real HTTP 404 status for unknown paths, and the rule for splitting code per route.
- [ ] State management and server-state rules beyond the session (which is a context, above).
- [ ] Caching of server data: nothing is cached today, and the first feature that lists data will need a rule.
- Settled on 2026-10-10: the site's content security policy and the other security headers are in `frontend/vercel.json`, and `scripts/security-headers.mjs` (the last step of `npm run build`) fails the build when the policy no longer matches it; `--fix` rewrites the hash of the inline boot script after `index.html` changes. A new host the page loads from or talks to is added to the policy in the same change. No inline script is added to a page, and nothing uses `eval`. Details: [[SECURITY-GUIDE]].
- [ ] Performance budgets and bundle limits ([[PERFORMANCE-AND-SCALING]]).
- [ ] The product's own icons: format, grid, review, registry (T-012).
- [ ] Which surfaces are young-child surfaces and the age bands (T-013).

## Related

- [[F-001-authentication]]
- [[FRONTEND-TOOLKIT]]
- [[DESIGN-SYSTEM]]
- [[UI-LIBRARIES]]
- [[RESEARCH-FOUNDATION]]
- [[LANDING-MESSAGING]]
- [[CODE-STYLE-GUIDE]]
- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[TESTING-GUIDE]]
- [[PERFORMANCE-AND-SCALING]]
- [[USER-FLOWS]]
- [[OBSERVABILITY]]

Back to [[INDEX]].

## Update this document when

- The owner changes a frontend rule or settles an open decision.
- The stack, the folder structure, a command or the checking procedure changes.
- A convention is added or retired.
