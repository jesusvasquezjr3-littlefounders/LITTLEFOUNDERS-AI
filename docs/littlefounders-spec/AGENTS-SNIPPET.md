# Text to add to the repository's AGENTS.md

Copy the block below into `AGENTS.md` at the repository root (append; do not replace the file). Fill in the paths.

---

## LittleFounders specification (binding)

The product and frontend specification lives in `docs/littlefounders-spec/` (adjust if you placed it elsewhere). It is binding. Precedence when documents disagree:

1. `product/13-OWNER-DECISION-LOG.md`
2. `product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and its appendices
3. `frontend/frontend-bible/02-FOUNDATIONS.md`, then `01`, `03`–`08` (a chapter written for one subject, such as `08` for the Mentor, refines `02` on that subject)
4. `frontend/mockup/littlefounders-mockup.html`: a visual reference only, minus `frontend/mockup/KNOWN-DEVIATIONS.md`
5. `product/reviews/`: history, never implement from it

External sources, cited by name:

- Product audit `00`–`09`: `<path>`
- `COSMIC_NARRATIVE.md`: `<path>`
- 3D Mentor characters: `<path>`
- Diorama: `<path>`
- Pose catalogue: `<path>`
- Forge (content pipeline): `<path>`

Before building any screen:

- Read `02-FOUNDATIONS.md` §1–2 (decisions D1–D13 and rules 1–23), then the chapter for the surface you are building.
- Every string meets the Copy Budget (`06`). Every component declares `data-copy-role`.
- Use at most 24 system glyphs. Every other visual is our own asset, in the house style, registered in the asset manifest (`07`). Never use stock icon or illustration packs for meaningful visuals.
- Mentor characters are only renders of the real 3D models in catalogue poses. Never generate a look-alike. Never use a letter avatar.
- The Mentor screen is the stage: the character on the Diorama (`08`). Never a chat window.
- Never import a component from the legacy frontend (buttons, inputs, chat, cards). Build from the Bible (`02` rule 23).
- No lives. No celebration outside the milestone list. "Tutor" is only the verified parent; the AI is the Mentor.
- Every minor safeguard follows age, not role. Option B: a teen may have a personal wallet without a parent. Tasks and approvals are guardian-only.

Before merging UI changes, run the text-fit, proportion and copy-budget audits (`frontend/verification-tools`, adapted to the real app's driver). All three must pass.
