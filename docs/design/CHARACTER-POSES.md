---
title: Character poses
status: draft
updated: 2026-10-10
---

# Character poses

> The four characters (Liruf, Dina, Zara and Rho), what survived the restart of 9 October 2026, and the catalog of 100 named poses recovered from the previous version as **material to review**, not as requirements.

> **Status: draft.** Nothing in the pose tables below is a decision. They are the previous version's list, copied so the thinking is not lost. The owner reviews them pose by pose (T-018); a pose becomes a requirement only when it is accepted here.

## Role

Records what exists for the characters, where the rest lives, and the starting list of poses, so the first screen that needs a character does not begin from nothing and does not inherit the old product by accident. Visual rules for the page around them: [[DESIGN-SYSTEM]]. Where they appear in the landing: [[LANDING-MESSAGING]].

## Read this when

- A screen, a marketing image or a flow needs a character to do something.
- Deciding what a character's role is in marketing, UI or UX.
- Touching any file under `glb/` or `frontend/public/scenes/`.

## What exists in the repository

- **Models**: `liruf.glb`, `dina.glb`, `zara.glb` and `rho.glb` in `frontend/public/scenes/`, with the artist sources in `glb/` and `glb/originals/`. All are in Git LFS and are never deleted or overwritten without the owner asking ([[CLAUDE]] rule 6).
- **Animation clips**: `frontend/public/scenes/clips-biped.glb` holds the twelve actions `idle`, `wave`, `point`, `nod`, `shake`, `think`, `bow`, `hop`, `jump`, `celebrate`, `dance` and `peek`, the seven emotions `neutral`, `happy`, `excited`, `encouraging`, `proud`, `thinking` and `surprised`, and three variants for one character (`celebrate@liruf`, `celebrate@rho`, `point@liruf`).
- **Mouth images**: `frontend/public/scenes/mouth/` (one per character) and two dioramas with walk masks.

## What was not kept

The code that played them is in the git tag `archive/pre-restart-2026-10-09` only: the pose catalog (`frontend/src/tutor-scene/poseLibrary.ts`), the stage and character components, the clip loader, the pose lab and the clip authoring script (`frontend/scripts/author-clips.py`). The tag is not a design reference ([[CLAUDE]]). Read from it only for something the owner points at, and bring it back only when a screen needs it, with the rules below decided first.

## Facts about the models that matter when rebuilding

- **Scale**: the files are small, the characters are not. Dina is a large animal and stands taller than Rho on screen ([[CHARACTER-COMPOSITIONS]]).
These come from the notes of the previous version and were measured on the files that are still here, so they are evidence, not decisions.

- Liruf, Rho and Zara share 24 bone names, so one clip file drives all three. They do **not** share a rest pose (23 of the 24 bones differ), so a shared clip carries rotation only and is applied on top of each character's own pose. Played as absolute values it deforms two of the three.
- Dina is a quadruped on her own 27-joint rig with different bone names. She is excluded from the shared clips by rig kind and is driven through a separate table that covers all twelve actions with the parts she has (head, chest, ears and tail). She is not excluded from poses.
- The artist exports are fragmented meshes; assume defects when a pose looks wrong and check the model before the animation.
- **`glb/Rho.glb` and `glb/Liruf.glb` are torn, `glb/originals/` is not** (found 2026-10-10 while previewing the loading window). In the rest pose, with no animation at all, the processed Liruf has his belly open (the inside of the body shows through) and the processed Rho has gaps along the left side of his vest; the files in `glb/originals/` are clean in the same pose. Zara's two files are identical. So every static render takes Rho, Liruf and Zara from `glb/originals/`: the 404 scene, the landing's problem scene, the sign-in window's scene and the loading runners were all re-rendered from them on 2026-10-10 (the hero scene was not: its tools are gone, and Rho's vest shows the same torn patches there). The originals also carry Meshy's own clips (`running` for Liruf, `walking_man` for Rho and Zara); the loading runners use a stride authored in code instead, because it reads livelier, and it deforms nothing on the originals. Dina has no original: her only file is `glb/Dina.glb`, with her own walk clip.

## The pose catalog (previous version)

### How it was built

A pose was not a new animation. It was a named pairing of one emotion and one action, with a stated purpose, an optional loop and an optional turn of the body. Seven emotions and twelve actions make 84 pairs, most of them meaningless ("surprised" with "bow") and a few the whole product ("proud" with "celebrate" after a correct answer). The catalog named the 100 that mean something. Where the rig could not express something, the answer was a new clip, not a row. Ids were stable and addressed by content and code; `only` could restrict a pose to one character and was never used.

100 poses produce 80 visually distinct renders; the others differ in intent, not in picture.

Many entries were written for screens that no longer exist (the Tutor, the Lesson Engine, the results screen, age-banded behavior). Read every `Used for` as the old product's intent.

### Greeting (13)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `greet.hello` | happy | wave | First contact in a lesson or a Tutor session. |  |
| `greet.warm` | encouraging | wave | Returning learner, softer than a first hello. |  |
| `greet.excited` | excited | jump | A brand-new course opening. |  |
| `greet.bow` | neutral | bow | Formal open, Dr. Rho in particular. |  |
| `greet.peek` | happy | peek | Arriving mid-scene without taking it over. |  |
| `greet.nod` | neutral | nod | Acknowledging the learner with no words. |  |
| `greet.hop` | happy | hop | Light arrival for a young learner. |  |
| `greet.plain` | neutral | wave | A plain open, for a lesson whose own copy sets the tone. |  |
| `greet.return` | excited | wave | The learner is back after several days away. |  |
| `greet.shy` | surprised | peek | Appearing where the learner did not expect a character. |  |
| `greet.thanks` | happy | bow | Thanking the learner for showing up today. |  |
| `greet.ready` | encouraging | hop | Signalling that the exercise is about to begin. |  |
| `greet.settle` | excited | idle | Arrived and eager, waiting to be given the floor. |  |

### Teaching (15)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `teach.point` | neutral | point | Directing attention at the exercise body. |  |
| `teach.point.excited` | excited | point | The key idea of a segment. |  |
| `teach.explain` | encouraging | point | Walking through a worked example. |  |
| `teach.emphasise` | excited | nod | The sentence that must land. |  |
| `teach.aside` | thinking | idle | A caveat or a footnote, deliberately low energy. |  |
| `teach.warn` | surprised | shake | A common mistake, before it is made. |  |
| `teach.recap` | neutral | nod | Closing a segment by restating it. |  |
| `teach.invite` | encouraging | wave | Handing the turn to the learner. |  |
| `teach.spot` | surprised | point | Calling out a detail the learner has just uncovered. |  |
| `teach.showcase` | proud | point | Presenting the learner’s own work back to them. |  |
| `teach.rule.out` | thinking | shake | Discarding a candidate answer while reasoning aloud. |  |
| `teach.weigh` | neutral | think | Holding two options side by side before choosing one. |  |
| `teach.notthat` | happy | shake | This one, not that one - correcting the framing, never the learner. |  |
| `teach.checkin` | encouraging | peek | Checking whether the learner is still following. |  |
| `teach.wonder` | excited | think | Opening a question the character finds genuinely interesting. |  |

### Feedback (15)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `feedback.correct` | happy | nod | A right answer, first time. |  |
| `feedback.correct.proud` | proud | celebrate | A right answer on a hard item. |  |
| `feedback.correct.streak` | excited | jump | Several right in a row. |  |
| `feedback.correct.quiet` | happy | idle | Right, but the segment continues - no interruption. |  |
| `feedback.retry` | encouraging | shake | Wrong answer. Never scolding. |  |
| `feedback.retry.gentle` | encouraging | nod | A second miss, softer than the first. |  |
| `feedback.almost` | surprised | think | Close but not right - the answer was reasonable. |  |
| `feedback.hint` | thinking | point | Offering a hint the learner asked for. |  |
| `feedback.timeout` | encouraging | wave | A timer ran out with no answer. |  |
| `feedback.correct.bright` | happy | jump | A right answer that deserves more than a nod. |  |
| `feedback.better` | surprised | nod | The answer went further than the one that was expected. |  |
| `feedback.plain.no` | neutral | shake | Wrong, stated plainly and without weight. |  |
| `feedback.nudge` | encouraging | jump | Nudging a learner who has stalled on an easy item. |  |
| `feedback.hold` | surprised | idle | Holding still while the learner reconsiders an answer. |  |
| `feedback.impressed` | proud | peek | Leaning in at an answer that went past what was asked. |  |

### Celebration (14)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `celebrate.lesson` | proud | celebrate | Lesson complete, on the results screen. | loops |
| `celebrate.perfect` | excited | dance | A perfect score. | loops |
| `celebrate.streak` | proud | jump | A daily streak extended. |  |
| `celebrate.levelup` | excited | celebrate | Crossing into a new adventure or saga. | loops |
| `celebrate.dance.slow` | happy | dance | Background joy that must not pull focus. | loops |
| `celebrate.applaud` | proud | wave | Applauding the learner rather than themselves. |  |
| `celebrate.first` | excited | hop | The learner’s very first completed lesson. |  |
| `celebrate.comeback` | proud | nod | Right after a run of wrong answers. |  |
| `celebrate.joy` | happy | celebrate | Joy without the ceremony of a level-up. | loops |
| `celebrate.bow` | proud | bow | Taking a bow at the end of a whole course. |  |
| `celebrate.with` | encouraging | celebrate | Celebrating WITH the learner rather than at them. | loops |
| `celebrate.surprise` | surprised | celebrate | A reward the learner did not know was coming. | loops |
| `celebrate.leap` | neutral | jump | Plain elevation, for a scoreboard beat that carries its own copy. |  |
| `celebrate.satisfied` | proud | dance | A slow, satisfied dance after a long streak. | loops |

### Thinking (10)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `think.ponder` | thinking | think | While the learner is deciding. |  |
| `think.puzzled` | surprised | think | An unexpected answer. |  |
| `think.consider` | thinking | nod | Weighing two options in a decision exercise. |  |
| `think.wait` | neutral | idle | Patient silence. The default while a learner reads. |  |
| `think.curious` | thinking | peek | Leaning in at something the learner did. |  |
| `think.realise` | surprised | jump | The moment an idea lands. |  |
| `think.hmm` | proud | think | Being asked something the character already knows well. |  |
| `think.along` | encouraging | think | Thinking alongside the learner rather than ahead of them. |  |
| `think.wander` | happy | think | Idle curiosity in the gap between two exercises. |  |
| `think.startle` | surprised | hop | A small jolt at something that just appeared on screen. |  |

### Transition (11)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `transition.next` | happy | point | Moving to the next segment. |  |
| `transition.enter` | neutral | peek | A character joining a scene already running. |  |
| `transition.exit` | happy | wave | Leaving a scene. |  |
| `transition.handoff` | encouraging | point | Passing narration to another character. | turned (0.5 rad) |
| `transition.pause` | neutral | idle | A held beat between sections. |  |
| `transition.recap` | neutral | bow | Closing a saga. |  |
| `transition.step.in` | neutral | hop | Stepping into frame without ceremony. |  |
| `transition.withdraw` | thinking | bow | Withdrawing from a scene that continues without them. |  |
| `transition.lift` | thinking | jump | Carrying momentum into a harder section. |  |
| `transition.called.back` | surprised | wave | Being called back just as they were leaving. |  |
| `transition.close.warm` | encouraging | bow | A warm close to a segment that went well. |  |

### Ambient (9)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `ambient.idle` | neutral | idle | The resting state. Every surface’s default. |  |
| `ambient.idle.happy` | happy | idle | Resting, but the segment is going well. |  |
| `ambient.listen` | encouraging | idle | The Tutor while the learner is speaking or typing. |  |
| `ambient.attentive` | neutral | nod | Following along without interrupting. |  |
| `ambient.sway` | happy | dance | Very low-energy background motion. | loops |
| `ambient.watch` | thinking | idle | Present but deliberately not the subject. |  |
| `ambient.hum` | neutral | dance | Background motion in a scene the learner is not looking at. | loops |
| `ambient.curious` | excited | peek | Watching the learner work, from the edge of the frame. |  |
| `ambient.drift` | thinking | dance | Very slow background motion for a thoughtful scene. | loops |

### Marketing (13)

| Id | Emotion | Action | Used for | Notes |
|---|---|---|---|---|
| `marketing.hero` | happy | idle | Standing portrait for a landing surface. |  |
| `marketing.present` | encouraging | point | Presenting something beside them, e.g. a decision card. | turned (0.5 rad) |
| `marketing.invite` | happy | wave | A call to action. |  |
| `marketing.proud` | proud | idle | A confident still for a mentor line-up. |  |
| `marketing.celebrate` | excited | celebrate | A joyful capture for a results or pricing surface. | loops |
| `marketing.think` | thinking | think | Illustrating a decision or a problem. |  |
| `marketing.bow` | neutral | bow | A closing frame. |  |
| `marketing.hero.turned` | happy | idle | The hero portrait at three-quarters, for a two-column block. | turned (0.55 rad) |
| `marketing.away` | neutral | idle | Facing away, for a header where the copy leads and the character frames it. | turned (Math.PI rad) |
| `marketing.wave.right` | happy | wave | Waving toward copy that sits to their right. | turned (-0.5 rad) |
| `marketing.banner` | neutral | celebrate | A large still for a pricing or results banner. | loops |
| `marketing.flourish` | excited | bow | A showman close for a promotional frame. |  |
| `marketing.approach` | thinking | wave | Beckoning the reader further into the product. |  |

## Open questions for the owner

These are written down, not answered. Tracked as T-018.

- [ ] Which of the 100 poses stay, which are merged (several are the same picture), and which are dropped. Suggested order: marketing, greeting and ambient first, because the landing uses them.
- [ ] The role of each character in marketing, in the interface and in the experience: who speaks, to whom, in what voice, and what each one never does.
- [ ] Whether every character gets every pose, or some poses belong to one character.
- [ ] Which poses exist for young children and which for older ones, once the age bands are decided (T-013).
- [ ] The rule for characters beside children's data: nothing a character shows or says exposes a minor's personal data ([[CHILD-SAFETY-AND-PRIVACY]]).
- [ ] How a pose reaches a screen when one is built: a static render, a 3D scene or a short video, and the performance budget it gets ([[PERFORMANCE-AND-SCALING]]).

## Related

- [[CHARACTER-COMPOSITIONS]]
- [[DESIGN-SYSTEM]]
- [[LANDING-MESSAGING]]
- [[FRONTEND-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[PERFORMANCE-AND-SCALING]]
- [[BUILD-TASKS]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- A pose is accepted, merged, renamed or dropped.
- A character's role is decided.
- A model, clip or mouth file is added, replaced or removed.
- Character code is brought back from the archive.
