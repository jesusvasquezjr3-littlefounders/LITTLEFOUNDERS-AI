# Application artwork and composition

Owner request: 2 October 2026. Improve application composition, grids, gutters and spacing, with original AI imagery where it supports a clean interface. Local only.

## Implementation

- Three original decorative illustrations support learning, shared everyday tasks and money habits. They appear on learning home, journal, rhythm, shared goals, child progress, family console, task boards, family wallets, teen wallet and settings. Each surface carries one composition; no illustration represents progress, an actual balance or a successful action. Labels, focus order and financial controls remain functional.
- Application headers pair a readable title area with bounded supporting artwork. Phone artwork uses a 96px column; wide artwork uses 192px. Learning has a larger next-step composition and an illustrated honest empty catalogue.
- Embedded family learning and bridge panels use natural content height rather than inherited viewport minimums. Console cards align content to the start. Money pockets remain readable full-width rows on phones and become a collection on wider containers.
- Settings uses asymmetric readable lanes on wide containers and retains one-column DOM order on phones. Profile card content keeps natural vertical alignment.
- The Mentor's route explicitly places the contextual controls and main stage in their intended grid tracks. A header containing only an out-of-flow skip link previously made the stage occupy an automatic track, leaving the flexible track empty. The real 3D stage now fills its flexible track. Actual models, Diorama and learning interaction surfaces remain unchanged.
- No application marketing topbar is added. Existing official logo, custom dropdowns, icon-only theme controls and proprietary glyphs remain.

## Image provenance

Built-in `image_gen.imagegen` generated the selected original illustrations. Earlier paper compositions and edit attempts remain outside the repository as unselected generation candidates. The final assets are encoded from the selected tool outputs as `frontend/public/rebuild/application/{learning,family,wallet}.webp`, with transparent delivery, 960 x 640, and manifest registration. Encoding/resizing adds no illustrated content. These are local style drafts, not approved release assets. Review their edge treatment and palette in both themes during owner acceptance.

Exact selected generation prompts:

### learning

Create an original LittleFounders UI illustration as a FLAT TWO-DIMENSIONAL VECTOR STICKER. An open completely blank indigo notebook, a winding mint paper ribbon, a sky-blue paper sailboat and a lavender telescope aimed at one indigo planet. Limited solid opaque color fills, crisp perfectly hard edges, rounded geometric shapes, clean playful professional editorial vector graphic. Indigo #5c55fd, mint #14b8a6, blue #38bdf8, lavender and ivory, yellow only for coins. Landscape 3:2 composition, ample breathing room. Transparent background. ABSOLUTELY NO SHADOWS, NO GLOW, NO GRADIENTS, NO BLOOM, NO BLURRED EDGES, NO LIGHTING, NO THREE-DIMENSIONAL OBJECTS, NO PAPER TEXTURE, NO PHOTOGRAPHY. Do not create a rendered paper sculpture. All objects must appear flat like a printed children's book vector illustration. No text, numbers, currency signs, people, animals, robots or characters. Do not add stock icons, symbols or UI.

### family

Create an original LittleFounders UI illustration as a FLAT TWO-DIMENSIONAL VECTOR STICKER. Two mint and sky blue watering cans nurturing three mint leaf sprigs beside a completely blank lavender notebook. Limited solid opaque color fills, crisp perfectly hard edges, rounded geometric shapes, clean playful professional editorial vector graphic. Indigo #5c55fd, mint #14b8a6, blue #38bdf8, lavender and ivory, yellow only for coins. Landscape 3:2 composition, ample breathing room. Transparent background. ABSOLUTELY NO SHADOWS, NO GLOW, NO GRADIENTS, NO BLOOM, NO BLURRED EDGES, NO LIGHTING, NO THREE-DIMENSIONAL OBJECTS, NO PAPER TEXTURE, NO PHOTOGRAPHY. Do not create a rendered paper sculpture. All objects must appear flat like a printed children's book vector illustration. No text, numbers, currency signs, people, animals, robots or characters. Do not add stock icons, symbols or UI.

### wallet

Create an original LittleFounders UI illustration as a FLAT TWO-DIMENSIONAL VECTOR STICKER. Three shallow mint, blue and lavender bowls with plain yellow coin discs, a small mint sprig and a completely blank indigo notebook. Limited solid opaque color fills, crisp perfectly hard edges, rounded geometric shapes, clean playful professional editorial vector graphic. Indigo #5c55fd, mint #14b8a6, blue #38bdf8, lavender and ivory, yellow only for coins. Landscape 3:2 composition, ample breathing room. Transparent background. ABSOLUTELY NO SHADOWS, NO GLOW, NO GRADIENTS, NO BLOOM, NO BLURRED EDGES, NO LIGHTING, NO THREE-DIMENSIONAL OBJECTS, NO PAPER TEXTURE, NO PHOTOGRAPHY. Do not create a rendered paper sculpture. All objects must appear flat like a printed children's book vector illustration. No text, numbers, currency signs, people, animals, robots or characters. Do not add stock icons, symbols or UI.

## Verification and status

Implementation: complete. Local verification: passed. Human visual acceptance: pending. Release: not requested. No production, database, lesson content or user records changed.

## Final local evidence

- Frontend type-check and lint passed. The 305 initial focused tests and 12 follow-up progress/copy tests passed. The final local draft build passed scorer/source parity, asset integrity, TypeScript, bundling and SEO generation. Existing bundle-size warnings remain; this change does not resolve them. No commit, push or deployment was performed.
- Text-fit covers 13,056 effective configurations; proportion and copy budget each cover 3,264: 136 affected states, three locales, both themes and four widths, with normal/+40% type and WCAG text spacing for text-fit. The initial matrix had six first-view copy findings in two states. Progress now prioritizes the course map before optional sharing and adds supporting learning art; the guest notice says the same thing more briefly. All four affected variants were rerun across the full matrix, with zero findings, JavaScript errors or media failures.
- Composite evidence is under `audit-results/application-polish-audits-composite/receipt.json`: 132 unchanged states retain initial evidence; four states use final delta evidence. Initial reports and their six copy findings remain under `application-polish-audits/`; passing replacements are under `application-polish-audits-final-delta/`. This is a composite result with explicit provenance, not a claim that the initial run passed.
- Synthetic Core returned empty envelopes for some background research reads and one family task-wallet read. The foreground UI matrix is covered; those responses do not establish complete backend behavior or product acceptance.
- Asset integrity covers 446 class B assets, 21 system-glyph families (22 names), verified original-logo pixels and no external icon packs. All three new rasters received fresh OCR on white and black composites, with zero words; hashes, sizes and paths are in `application-polish-preview/asset-ocr.json`. The unchanged raster scan is reused from the entry-flow checkpoint; build-time OCR was disabled only after the structural gate and this fresh delta passed. The new assets remain local style drafts, and the build carries `LOCAL-DRAFT-BUILD.txt`.
- Final captures comprise 62 light-theme and eight dark-theme desktop/phone images, with no JavaScript or media failures. Four light captures were refreshed after the copy corrections. The gallery and portable ZIP are in `audit-results/application-polish-preview/`. Test courses, balances and identities are illustrative; no production content was restored.
- Family desktop height fell from 3,838px to 3,131px, and phone height from 5,193px to 4,460px by removing embedded viewport-height gaps. Adult Settings desktop fell from 2,433px to 1,747px through its readable asymmetric lanes. Natural content height, not a smaller type scale, accounts for these reductions. The actual Mentor stage now occupies the remaining viewport below its controls.
- Specification checksum/agent parity, authored-UI integrity, the complete i18n key/namespace/static-key gate and whitespace checks passed. The i18n gate used an unchanged temporary copy with LF endings under Git Bash to avoid the documented Windows CRLF trap. Human visual acceptance remains pending; release is not requested.
