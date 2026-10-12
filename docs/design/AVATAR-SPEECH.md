---
title: Avatar speech and mouth shapes
status: draft
updated: 2026-10-10
---

# Avatar speech and mouth shapes

> How the character avatars move their mouths when they say words in English, Spanish and Portuguese: the research, the simplified set of mouth shapes, the dictionary that turns written words into them, and what is left until a generated voice exists.

> **Status: draft.** The set and the rules are built and checked by eye on the four characters; nothing here has been tested against recorded or generated speech, because there is none yet.

## Role

The owner asked for the avatars' mouths to say words, and for the mouth gestures of the three interface languages to be researched and simplified into a dictionary usable for narration. Avatar design and rig: [[CHARACTER-AVATARS]]. Code: `frontend/src/features/avatars/visemes.ts` and `audioLipSync.ts`.

## Read this when

- Changing how a mouth moves, adding a language or a mouth shape.
- Connecting a generated voice or any narration audio to an avatar.

## What the research says

- **A viseme is the look of a sound.** Many sounds look the same from outside: p, b and m all close the lips, f and v put the lower lip on the upper teeth. So lip-reading and animation both group sounds into a few mouth shapes. Classic animation charts use about 8 to 12 shapes; the Disney set has 12 (closed lips for p b m, pursed lips for w and "oo", rounded for r and "book"); Adobe Character Animator ships 11.
- **A common production set has 15.** Meta's Oculus Lipsync uses sil, PP (p b m), FF (f v), TH, DD (t d), kk (k g), CH (ch sh j), SS (s z), nn (n l), RR, aa, E, ih, oh, ou. Meta describes the set as chosen "to give the maximum range of lip movement, and agnostic to language".
- **Spanish** has been studied for lip reading: an optimal vocabulary of about 20 visemes, with groups such as b-m-p; ch-y-ll-j; d-s-t. Spanish is written almost as it sounds, which makes text to mouth the easiest of the three.
- **Brazilian Portuguese** adds nasal vowels (a and o with a tilde, and vowels before m or n, produced with the soft palate lowered and a smaller lip opening than oral vowels) and palatal consonants (lh, nh) that share the "j"-like mouth. The lips do not close for the m or n that only nasalizes a vowel.
- **English** spelling is the hard case: the same letters give different sounds. Rules for the common spellings (th, sh, ch, ph, ng, ck, ee, ea, oo, ou, ow, ai, oi, silent final e, igh) cover most everyday words; unusual words will look slightly off, which a cartoon mouth tolerates.

## The simplified set

Thirteen mouth shapes plus rest cover the three languages. Each is four numbers the rig turns into an outline: **open** (the jaw), **wide** (spread or narrowed), **pucker** (a round "o") and **press** (lips together).

| Shape | Sounds it stands for | Look |
|---|---|---|
| rest | silence | closed, relaxed |
| PP | p b m (and v, b in Spanish) | lips pressed shut |
| FF | f v | lower lip against the upper teeth, small gap |
| TH | English th | small opening, tongue between the teeth |
| DD | t d n l | teeth slightly apart |
| KK | k g j (Spanish) q x, back-of-mouth sounds | slightly open |
| SS | s z c (before e, i) | teeth close, lips spread |
| CH | ch sh j (English, Portuguese) | lips rounded and pushed forward |
| RR | r | light rounding |
| AA | a, nasal a (tilde) | wide open |
| EE | e (also accented) | half open, spread |
| II | i, y, ll, n with tilde, nh, lh | small opening, widest spread |
| OO | o (also accented or with a tilde), au | rounded, half open |
| UU | u, w, final o in Portuguese, final l in Portuguese | small round, pushed forward |

## The dictionary and its rules

`visemesFromText(text, { language, rate, duration })` splits the text into words and each word into sounds with rules per language (the page's own language by default, read from the document), gives every sound its shape and a duration (vowels about 115 ms and consonants about 70 ms, stressed vowels longer, the lips closing for p, b and m at least 85 ms), adds short gaps between words and longer ones at commas and full stops, and returns a timeline of `{ at, viseme }`.

- **Spanish**: each letter is one sound, with digraphs ch, ll, rr, qu, gu before e and i; c and g by the vowel that follows; accents lengthen the stressed vowel.
- **Portuguese**: the same plus the tilde vowels, nasal vowels (the m or n after a vowel before a consonant is not shown, so the lips do not close), nh and lh, final o and final e reduced to "u" and "i", l at the end of a syllable as "u", t and d before i as "ch" (as in much of Brazil), and ss and the cedilla.
- **English**: rules for th, sh, ch, ph, wh, ng, ck, kn, wr, qu, the long vowel spellings, the common diphthongs and a silent final e.
- **Fitting to audio**: with `duration` the whole timeline is stretched to the length of a recording of the same text, so the words land where the narration lands. The mouth looks 50 ms ahead so the lips close before the sound arrives, as they do in speech.

## Driving the mouth from audio (no text)

`AudioLipSync` reads an audio element while it plays: the loudness sets how far the jaw opens, and the middle of the spectrum separates rounded vowels (low), "a" (middle) and spread "e" and "i" (high), and a lot of energy above 4 kHz shows "s" and "sh". It is the fallback for narration whose text is not at hand. The avatar's `speakAudio(media, { text })` uses the words when given (stretched to the real length) and the sound itself when not. The analyser only reads the sound being played; nothing is recorded or sent. Browsers start audio suspended until the visitor acts, so call it from the play gesture.

## What the face does besides the mouth

While it speaks the avatar lifts its brows and nods a little with the opening of the mouth, keeps its eyes on the pointer or the screen, and blinks. Rho's mustache rides up as his mouth opens; Dina's smile line stays a smile while her mouth opens under it.

## Not decided or not done

- **The generated voice** (provider, cost, child-safety rules, whether it returns timing): open, T-023. If the provider returns phoneme timing, it replaces the text rules (the avatar already accepts any timeline); if not, `duration` plus the dictionary is the plan, with `AudioLipSync` as the fallback.
- **Checked only by eye on silent frames** of each shape on the four characters, not against real speech.
- **Words the rules get wrong** (English irregular spellings, names and loanwords) look slightly off; an exception list per language can be added when real narration shows which words matter.
- **Other languages** are not covered.

## Related

- [[CHARACTER-AVATARS]]
- [[CHARACTER-POSES]]
- [[FRONTEND-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[BUILD-TASKS]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- A mouth shape or a language rule changes, or a language is added.
- A voice is chosen or real narration is tested.

## Sources

- [Meta Oculus Lipsync viseme reference](https://developers.meta.com/horizon/documentation/unity/audio-ovrlipsync-viseme-reference/)
- [Automatic viseme vocabulary construction for continuous lip-reading (Spanish)](https://arxiv.org/abs/1704.08035)
- [Phoneme-to-viseme mappings: the good, the bad, and the ugly](https://arxiv.org/pdf/1805.02934) and [Disney Research, visemes](https://la.disneyresearch.com/wp-content/uploads/project_visemes_sca20121.pdf)
- [Amazon Polly Brazilian Portuguese phoneme and viseme table](https://docs.aws.amazon.com/polly/latest/dg/ph-table-portuguese-br.html)
- [Nasal vowels in Brazilian Portuguese (fiberscopic analysis)](https://halshs.archives-ouvertes.fr/halshs-00315991)
- [Adobe Character Animator, lip sync mouth shapes](https://www.adobe.com/learn/adobe-character-animator/web/lip-sync-mouth-shapes)
