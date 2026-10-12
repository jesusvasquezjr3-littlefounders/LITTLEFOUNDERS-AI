---
title: F-004 The signed-in application
status: draft
updated: 2026-10-12
---

# F-004 The signed-in application

> The structure a signed-in person moves in: the menu, the home with the composition of the day and the pile of the day, and the empty destinations each feature will fill.

> **Status: draft.** The owner chose the structure from prototypes and approved the plan, the compositions and the icons (D-051 to D-054). What is written here is what was built from those decisions on 2026-10-11; the owner has not reviewed the built application yet, and it is not deployed.

## Summary

After signing in, a person is in the application: a layout of its own (not the site's), with a menu of destinations and a home. The home is the pile of the day, a deck of playing cards a person passes with gestures and whose cover is a board of the day, beside a stage that shows a different composition of the four mentors every day. The features themselves (lessons, the mentor, the wallet, tasks, family) are not part of this: each is designed with the owner in its own session and arrives with its destination's page and its card.

## Destinations and who has them

| Destination | Path | Who | Today |
|---|---|---|---|
| Home | `/home` | Everybody | Built: the pile, its cover and the stage |
| Learn | `/learn` | Everybody | Empty; the games will live inside it |
| Mentor | `/mentor` | Everybody | Empty; it will be the place to see and set up MentorIA, not the conversation |
| Wallet | `/wallet` | Everybody | Empty |
| Tasks | `/tasks` | Everybody | Empty |
| Family | `/family` | Grown-ups: an account of type `universal` (18 or over), a verified `parent`, or staff | Empty |

Core says which destinations an account has (`destinations` in the home read). That list decides only what the menu shows; what a destination returns will be checked again by that feature's own routes. A person who opens a path their account does not have is taken to `/home`. Administration is a later session and is not in this menu.

An empty destination shows its name, its icon alive and one line, "Nothing here yet". It describes and promises nothing.

## Getting in

- **A guest** comes in without an account (D-056): somebody who walked the onboarding to its end and chose "later". Their name and mentor are the onboarding's answers in their own browser (`features/app/guest.ts`); they have every place but Family; a slim notice at the top says what they chose is kept on this device, with the buttons to create the account and to erase it. Creating it from there gives the answers to the account and leaves the person where they are. Erasing takes them to the site.
- Anybody else needs a session. A visitor who never walked the onboarding and opens one of its paths is taken to the site's home page with the sign-in window open, and once they are in they are taken to the place they asked for, not to the home (`features/app/nextPlace.ts`). What is kept is the name of one of the application's own places, in that tab only; never an address, so a link cannot send a person anywhere else.
- An account with no name and no mentor (made with "Sign in", without the onboarding) chooses them before it comes in: the application takes it to the onboarding, which does not ask its age again, and from its last screen to the place it was going ([[F-003-onboarding]]).
- An account that has not said its age gets no home (`AGE_REQUIRED`); the sign-in window asks for it, as everywhere else ([[F-001-authentication]]).
- A person who signs in from the site's home page is taken to `/home` once the account is complete (`features/app/GoHome.tsx`), and the onboarding ends at `/home` when it leaves the person signed in ([[F-003-onboarding]]).
- Somebody already signed in who opens the site stays on it. Where the site offers to sign in or to start (the header, the call to action of the landing page, the bar at the bottom of a phone), they see one green button instead, the same in all of them (`features/app/KeepLearning.tsx`): "Keep learning", which goes to `/home`, or "Finish your account" for an account that still owes its age, which opens that one step and then goes to `/home` (the color is `--lf-positive`; kept apart from the orange of a first step and the indigo of the brand).
- An account that already has its name or its mentor does not walk the onboarding again: `/onboarding` takes it to `/home`.

## Layout

- **Desktop (from 1024 px):** a sidebar on the left, light in light mode and dark in dark mode, that can be collapsed to its icons (Cojeev Sidebar); the choice is remembered on the device (`lf.sidebar` in localStorage, a convenience, not data about the person). Collapsed, every entry keeps its name for a screen reader.
- **Phone and tablet:** a dock of icons at the bottom, with no words (Cojeev Dock, its colored tiles left blank because the icons carry the color); each icon keeps its name for a screen reader.
- **Top:** the theme and language controls and the account menu, the same ones the site uses.
- A skip link, one `<main>`, and the tab's title follows the destination.
- Every icon is the application's own ([[ICON-SYSTEM]]); the current destination's is alive.
- Shapes are round everywhere (the radius tokens in `lf-theme.css`, D-051).

## The home

The pile leads and the stage accompanies it. No text sits over or under the cards.

- **The pile of the day** (`features/app/Deck.tsx`). Playing cards, light paper in both color modes, each with its place's tint. The cover comes first; under it lies one card for each of the person's places, with the place's icon and name, and playing it goes there. The features' own cards join the pile as each feature is built.
- **Gestures.** The top card is dragged or flicked aside and slides under the pile, and the next one turns over; a tap or a click plays it; it leans under the pointer. With a keyboard the pile is one stop: the arrows pass the cards and Enter plays the top one, and each change is announced (`aria-live`). With reduced motion nothing flies or leans. The pips under the pile show where the person is.
- **The cover: the board of the day** (`features/app/HomeCover.tsx`). A picture of what today holds, made of flat colored tiles inside the card, with no character on it: the date; the scene on the stage today by name, with a ring that says how far the person is through the round of scenes; and one tile each for the lesson, the tasks of the day, the Seeds and the streak. A tile belongs to its feature: none of the four exists yet, so each tile says "Soon" and nothing invents a number. `/dev/home`, only in the dev server, shows the board full with made-up values (`?empty` shows it as it is today).
- **The greeting** (`features/app/greeting.ts`). Over the stage, a greeting for the hour by the name the person asked to be called, and a line under it. Both come from a collection in the locale files (23 greetings and 52 lines in each language, by part of the day); the choice is steady for a person and a day, so it does not change while they look.
- **The stage.** The composition of the day, 1200 by 800, shown through the same `Loop` element as every other scene (a video per color mode, its poster with reduced motion or less data). It is a decoration and says nothing a person needs.
- While the home loads, the greeting, the stage and the pile are skeletons of their own size, so nothing moves when they arrive. If the read fails, the page says so and offers to try again.

## The composition of the day

One composition a day for each person, another the next day (D-052). Core chooses it (`backend/src/services/home.ts`):

- **The same on every device,** because it depends only on the account and the day.
- **No repeats until all have been shown.** Days are counted in cycles as long as the catalog (thirty); inside a cycle a person goes through their own shuffle of it, and the first day of a cycle never shows what the last day of the one before did.
- **Nothing is stored.** The order is computed from the account's id with a key only Core holds (derived from the session secret for this one purpose). No table says which days a person came in or what they saw, so there is no history of a minor's visits to protect, keep or delete.
- **The person's own day.** The browser reports its calendar day and Core accepts it only when it is within a day of its own; all it can change is which picture is shown.
- **The catalog** is the list in that file; each name is two videos and two posters in `frontend/public/stage/loops/` (not `home/`, which is the page's own address). `frontend/scripts/home-catalog.mjs` runs in the frontend's build and fails it when a name has no files or files have no name. Seasons and special dates are not designed yet.

The compositions themselves are in [[CHARACTER-COMPOSITIONS]].

## Data model and API

No table and no migration: this feature stores nothing.

`GET /api/v1/home/guest?day=YYYY-MM-DD` is the same read for a guest. It needs no session and knows nobody: the name is empty, the mentor is null, the menu has no Family, and the composition is one order of the catalog shared by every guest. It takes `day` and nothing else, is counted by the visitor's network address like any public read, and is never cached.

`GET /api/v1/home?day=YYYY-MM-DD` (signed in, age said; `day` optional). It takes no user id and answers about the account of the session only; any other field in the address is a `BAD_REQUEST`. It is counted per account, 120 reads in 15 minutes, and not per address, because a classroom or a family shares one address ([[RATE-LIMITING-AND-ABUSE]]); it is never cached.

```json
{ "home": { "displayName": "Nico", "mentor": "liruf",
            "destinations": ["home", "learn", "mentor", "wallet", "tasks"],
            "composition": { "name": "jungle", "day": "2026-10-11", "number": 12, "total": 30 },
            "cards": [] } }
```

`number` and `total` say how far the person is through their round of compositions. `cards` is the pile's feature cards. Each feature adds its card to this answer when it is built, with its own shape; nothing is sent for what does not exist.

## Privacy

- No tracker loads or sees anything inside the application: its paths are private to analytics (`lib/analytics.tsx`, D-055), whatever the case they are typed in. Most of the people in it are minors. Somebody who accepted the trackers on the site and then walks into the application gets the page loaded afresh, because removing a tracker's tag does not stop code that already ran.
- Core stores and learns nothing about a guest: no account, no session, no cookie. What a guest answered stays in their browser (D-038).
- The home read returns only the name the person chose, their mentor, the menu, and a composition's name and its place in the round.

## Locale strings

`frontend/src/i18n/<locale>/app.json`, in en-US, es-MX and pt-BR: `nav` (the destinations and the menu's controls), `home` (the greetings and the lines under them, the cover, the pile, the failure), `scenes` (the name of each composition), `empty`. `core.json` carries the green button of the site (`siteShell.keepLearning`).

## How it was checked

On the local stack with real sessions of synthetic accounts, 2026-10-11:

- **Core:** 24 checks of the home read (refused without a session, before the age step, after signing out and with an old copy of the cookies; a teenager, a child of 9 and a grown-up; the same composition all day and another the next; a far or impossible day ignored; a user id in the address refused). The choice itself was run for 400 simulated accounts: never the same two days running in a year, every cycle shows all thirty, every composition used about equally.
- **The application:** checks in a real browser: a visitor is sent to sign in; the home at 1440, 1024, 768, 390 and 320 px, light and dark, in the three languages, with no sideways scroll and no cut text; the menu, the current place, the collapse and that it is remembered; a teenager kept out of Family and a grown-up let in; the dock on a phone; the cover's board inside its card at every width.
- **Walks through the interface only** (`npm run audit:app`, [[FRONTEND-TOOLKIT]]): a person signs in from the site and lands on `/home`, passes the cards, plays one, comes back to the site and finds the green button; at 1440 and 320 px light, 1440 px dark in en-US and 390 px dark in pt-BR. `audit:onboarding -- --account` and `audit:signin` check the two other ways in.
- **Every way in, through the interface** (`npm run audit:flows`, each flow in a browser with no cookies and nothing stored, checked before its first step): the learner's button and the onboarding to the account and `/home`; the parent's, on a phone, with Family in the dock; "later", in as a guest with no session, a reload, a place, the site and back, and the account created from inside the application; a guest who erases what they chose; a visitor with nothing chosen, who is sent to sign in; "Sign in" with no onboarding, which leads to choosing a name and a mentor without a second question about the age; an account left at the age step that comes back, closes the window and uses the green button; signing out and in again; a link to `/wallet` opened without a session by a new person (who ends on `/wallet` after choosing name and mentor) and a link to `/tasks` by a returning one. All the others end on `/home`.
- **Security review** with the checklists of `.claude/skills/strix-security-reference/` ([[SECURITY-GUIDE]]): no critical, high or medium finding. Three low ones fixed: an upper-case path (`/HOME`) was the application to the router and public to analytics; trackers loaded on the site stayed in memory after walking into the application; the name was put into the greeting as a replacement pattern. The fresh load for trackers was not exercised, because no tracker is configured on the local stack.
- **Accessibility:** axe-core (WCAG 2.0 to 2.2, A and AA, and best practices) on the home and three destinations at 1440, 768 and 390 px, light and dark, in the three languages: no finding left. It found two, both in the sidebar and both fixed: the current entry's label was the library's orange (3.4 to 1, now the sidebar's own text color), and a row was 40 px tall (now 48). Every control is at least 44 by 44 px.
- **Keyboard only:** the skip link is the first stop and moves the focus to the page; then the menu in order, then the controls of the top; every stop shows its focus; Enter opens a place and collapses the menu; on a phone the dock is one stop, the arrows move along it and Enter opens the place.
- **Reduced motion:** the composition is its still and no icon runs or fetches anything.
- **The narrowest phone:** at 320 px six dock icons did not fit; the dock now sizes its icons to the screen (46 px, down to 34).
- `type-check`, `lint` and `build` in `frontend/` and `backend/`; the anti-slop rules on the new files.

Not checked: a screen reader and a real phone, by a person; Google sign-in into the application (T-019).

## Open points

- The owner's review of the built application.
- What a guest may do inside each feature and what is kept of it, with each feature. A child under 13 can be a guest with no permission of a parent or guardian, because nothing about them leaves their browser; counsel should confirm that reading (T-036).
- If giving the answers to a new account fails, the application waits on its loading screen until the page is loaded again.
- The first feature card, and the values of the board's tiles, each with its feature.
- `/family` is kept from a minor by the menu only; its own routes check the role in Core when they are built.
- The floating mentor (a later session); nothing of it is built or reserved here.
- Focus mode (a lesson without the menu), with Learn.
- The site's theme, language and account controls still use library icons (T-012).

## Related

- [[F-001-authentication]], [[F-003-onboarding]]
- [[CHARACTER-COMPOSITIONS]], [[ICON-SYSTEM]], [[UI-LIBRARIES]]
- [[API-GUIDE]], [[RATE-LIMITING-AND-ABUSE]], [[CHILD-SAFETY-AND-PRIVACY]]
- [[FRONTEND-GUIDE]], [[BUILD-TASKS]] (T-037, T-038), [[DECISIONS]] (D-051 to D-055)

Back to [[INDEX]].

## Update this document when

- A feature adds its destination's page or its card.
- The menu, the home, the cover's board or who has a destination changes.
- How the composition of the day is chosen changes, or seasons are designed.
