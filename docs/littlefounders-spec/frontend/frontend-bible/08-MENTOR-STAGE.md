# 08 · The Mentor stage — a 3D character on its Diorama, not a chatbot

Status: **owner-mandated (OD-15, 21 September 2026). Non-negotiable.** Written in English because the file feeds an AI frontend agent. Where this file and `13-OWNER-DECISION-LOG.md` disagree, the log wins. The Mentor's behaviour (pedagogy, safety, moderation, memory, session limits) is defined by the Product package, Block C and Appendices D, E and F. This file defines only how the Mentor **looks and is operated**.

## 0. The decision

The AI Mentor is **one of the four 3D characters** (Dr. Rho, Zara, Liruf or Dina, chosen by the learner), **standing on the Diorama**. It is not a chat window with an avatar.

Two things are therefore **destroyed, not restyled**, when this work is imported:

1. **The legacy Mentor UI** in the current LittleFounders application: the generic chat layout, with a message thread, bubbles, a bot avatar and an input bar as the whole screen. It is deleted and rebuilt from this file. No component, layout or style from it is ported.
2. **The legacy buttons and controls** across the application. They are replaced everywhere by the flat button system and controls in `02` §9.1–9.2 and §9.8. There is no "legacy" variant, and no mix of old and new buttons on any screen.

The v2.1 mockup's `mentor` route shows a chat-bubble layout with letter avatars. It is **not** the design. It is recorded as deviation **K42**.

## 1. Source of truth for the 3D

- The character models, the **Diorama**, and the **pose/animation catalogue** live in the main project folder. The agent opens them and builds from them. This file does not redefine them. If anything here conflicts with those assets, the assets win and this file is corrected.
- Poses and gestures come from the catalogue. The existing gesture and emotion vocabulary already built for the Mentor is reused, never duplicated (requirement B.8).
- The character renders in real time on the Diorama where the device allows (section 7). Everywhere else, stills and sequences are rendered from the same models (`07` §4).

## 2. What the screen is made of (top to bottom on a phone)

| Layer | What it is | Rules |
|---|---|---|
| **1. Top bar** | Close/back, the character's name, a menu (change Mentor, transcript, and "what my grown-up sees" only when a guardian link exists) | System glyphs only (`07` §2). The character's name is the title. Never "AI", "bot" or "assistant". |
| **2. The stage** | The Diorama with the character on it. It is the **dominant area of the screen**: about 55–60% of the height on a phone, and the left 7 of 12 columns on a wide screen. | Full-bleed scene, never boxed in a card. The character is the protagonist (`01` §1, pattern 3: the character is the protagonist, not decoration). Nothing decorative covers the character's face or hands. |
| **3. Speech plate** | The Mentor's **current turn only**, as a short caption anchored to the stage just below the character | One turn at a time, within the Copy Budget (`06`: 20 words and 2 sentences; 12 words for ages 6–9). One question per turn. It is not a scrolling thread. |
| **4. Board (on demand)** | The teaching board (`05`) when the Mentor demonstrates something | It enters beside the character on wide screens, and slides up over the lower stage on phones. The character stays visible and points or reacts. The board holds the visual; the character holds the voice. |
| **5. Response area** | 2–3 **reply chips** with suggested answers, the **text field**, and a **microphone** (only where the age safeguards allow it, C.2) | Chips are `option` controls (8 words at most; 5 for ages 6–9). The field is the flat input (`02` §9.8). One primary action. It never looks like a messaging app: no bubble tails, no read receipts, no typing dots. |

**The transcript** (the full conversation so far) is available from the menu as a sheet: accessible, searchable by screen readers, and in reading order. It is a secondary view for accessibility and review, never the primary layout.

## 3. Character states (what the learner sees the Mentor do)

Every state maps to catalogue poses and animations. The UI requests states and never fakes them.

| State | When | What the learner sees |
|---|---|---|
| Idle | Waiting for the learner | Catalogue idle loop. It counts as one of the 3 idle loops allowed on screen (`02` §9.4). |
| Listening | The learner is typing or speaking | Listening pose. With the microphone on, a level indicator in the response area (not on the character). |
| Thinking | Waiting for the model's reply | A thinking pose, **instead of typing dots**. If the wait exceeds about 1.5 s, a short status in the speech plate ("Thinking…", 1 word). |
| Speaking | Delivering a turn | The speaking animation, with the speech plate text shown as it is spoken. Audio follows the voice rules for the age and the session. |
| Demonstrating | Explaining with the board | A pointing or presenting gesture toward the board. |
| Encouraging | After a miss, or when offering a guided review (D9) | A warm gesture. Never disappointment, never a "sad" face (B.26: no shame signals). |
| Celebrating | **Only** on a D7 milestone reached in the session | The celebration gesture and, if applicable, the milestone asset (`07` §5). Never per answer. |
| Closing | Session end (C.16) | A closing gesture matched to how the session actually ended. |

## 4. Behaviour the UI must make visible (from Block C, not redefined here)

- **Hint ladder (C.13)** and **self-explanation prompts (C.14):** shown as Mentor turns, with reply chips for the likely answers.
- **Adaptation offers (C.15)**, such as the guided review: an offer with two equal choices, never a default-accepted path.
- **Repair (C.19):** "Did that help?" is a turn with chips, not a modal.
- **Session end (C.8, C.12, C.16):** the Mentor suggests stopping. The UI shows the closing state, one summary line, and one action back to the learning path.
- **What the grown-up sees:** only when a guardian link exists (a child in a family). A line in the menu explains it within the Copy Budget ("Your grown-up sees topics, not your words."). A teen without a parent (Option B) and an adult learner never see this line. The full rule lives in the Product package.

## 5. Text and voice together

- The speech plate is a **caption of the current turn**, kept short. When the Mentor also speaks it aloud, the plate still shows it for accessibility and for muted devices. The Forge content gate for authored segments follows B.18 (no long on-screen text duplicating narration). In live conversation the plate is the caption, and the Copy Budget keeps it short.
- Captions can be turned off only where accessibility settings allow. The transcript always keeps the full text.

## 6. Layout by width

- **Phone (< 600 px):** stacked. Top bar, stage (about 55–60% of the height), speech plate overlapping the lower edge of the stage, response area pinned to the bottom above the safe area. The board slides up over the lower stage.
- **Tablet (600–1023 px):** the stage keeps about 50% of the height. The speech plate sits beside the character when the scene allows it.
- **Desktop (≥ 1024 px):** the stage takes the left 7 of 12 columns, and the speech plate, board and response area take the right 5. This is an asymmetric split (`03`), never 50/50.
- The stage is never smaller than the response area on any width.

## 7. Performance and fallbacks

- **Real-time 3D** is used where the device and the settings allow it. Budgets: first render of the stage under 2.5 s on a mid-range phone, and a steady 30 fps minimum. The model loads progressively, with a pre-rendered still of the same character and pose shown until it is ready.
- **Fallback (low-power device, no WebGL, or data saver):** pre-rendered stills and short sequences from the same models and catalogue poses (`07` §4). The layout does not change. In the fallback, idle is a still: sequences play once per state change and settle.
- **Reduced motion:** the character switches poses with a short cross-fade instead of animating. The idle loop stops. Every state stays visible (`04` §3).
- **Mobile wrapper (OD-12):** the stage remains one isolated component with a documented interface (inputs: character, state, board open/closed, age band; outputs: ready, error). The future wrapper shares this web component and must preserve its fallback, input and accessibility behavior.

## 8. Choosing and changing the Mentor

- The chooser shows the **four real characters on the Diorama**, rendered from the models. It does not use letter avatars or cards with personality paragraphs.
- Each character has its name and one line of at most 6 words. Personality shows through pose and animation, not text.
- The choice fills every Mentor slot in the product: the lesson prompt label, the guided review, the home card, the navigation tab (the character's name and avatar), the profile and this stage (`02` §9.7).

## 9. Age bands (B.23)

- **6–9:** the largest character presence, the most animation and the smallest text budgets (`06`). Reply chips come first; the text field is secondary.
- **10–12:** the stage is slightly smaller, and the text field is equal to the chips.
- **13–17:** minimal "mascot" framing: the same character and Diorama, calmer animation, and the text field first. Framing is never childish.
- The Diorama, the character models and the components do not change between bands. Presence and wording do.

## 10. Acceptance checklist (the legacy UI is gone when all of these pass)

1. There is no chat thread as the primary view. The transcript is a secondary sheet only.
2. There are no bubble tails, typing dots, bot or letter avatars, or "AI assistant" labels.
3. The chosen character, on the Diorama, occupies the dominant area on every width.
4. Every character state in section 3 is driven by catalogue poses, and there is no celebration outside D7.
5. The speech plate and chips pass the Copy Budget audit. All text passes the Text Fit audit.
6. The microphone appears only where C.2 allows it.
7. Reduced motion and the low-power fallback render the same layout with stills.
8. Every button and control on the screen is from the `02` system. No legacy component is imported anywhere in the Mentor feature.
9. The same stage component and character system is reused for the lesson player's character presence (B.8), not rebuilt.

## 11. The compact stage in the lesson player (B.8)

Requirement B.8 asks for the Mentor's visible, animated presence during lessons, using the same character system. The lesson player uses **the same stage component at a compact size**, not a second system:

- **Phone:** a band at the top of the lesson screen, under the progress bar, at most **25% of the height** (30% for ages 6–9, 15% for teens). The character sits on the edge of its Diorama, waist-up or full body as the catalogue pose allows. The band may show the active adventure's scene (B.8). Below the band, the screen keeps its full-bleed lesson hue (`02` §4.5).
- **Desktop:** a side column of 4 of 12 columns, left of the question. The question, the answers and the board take the other 8.
- **Behaviour:** the same states as section 3. The character introduces the question, reacts to answers with encouraging or neutral gestures, and demonstrates beside the board. It never goes inside the board (`05` V3). It never celebrates a single correct answer (D7).
- **Text:** the Mentor's words in a lesson are the prompt label ("Dina asks") and, for a guided review or a hint, one speech-plate turn within the Mentor budget (`06`).
- **Reduced motion and low power:** stills, as in section 7.
- The compact stage never pushes the answers below the first view on a 375 × 740 px screen. If it would, it shrinks to the minimum band (15%) first.
