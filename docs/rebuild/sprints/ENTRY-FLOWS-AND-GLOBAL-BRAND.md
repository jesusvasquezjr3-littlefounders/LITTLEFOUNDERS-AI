# Entry flows and global graphic branding

Owner request: 2 October 2026. Local changes only. The official full graphic logo replaces the previous symbol plus live-text lockup wherever the shared brand component appears. Improve entry-flow composition, spacing and indentation, with restrained original AI artwork where useful.

## Implementation

- `BrandMark` always renders the unchanged, manifest-registered company graphic. Authentication, recovery, parental verification, learner/parent/staff rails, navigation sheets and authoring screens share this implementation. It has intrinsic dimensions and an accessible company name. This does not add a topbar to application routes.
- Authentication uses a centered, bounded composition. Desktop places supporting artwork beside a readable form; tablet/phone retain a single form column. Branding aligns with field edges. No decorative image pushes phone form fields below the fold. Existing custom language and icon-only theme controls remain available.
- First-run welcome uses the official graphic and a modest original illustration. The full-bleed single-state presentation remains; onboarding panels and docked actions share a 560px maximum width. Conditional discovery, age safeguards, Mentor selection and account-save choices are unchanged.
- The new illustration is original, flat editorial artwork: a blank notebook, growing plant, watering can, kite, plain coins and orbital shapes. It contains no characters, text or logos and does not replace real Mentor models. It is decorative, transparent, static and shared across themes. Its colors exclude action orange and error red. The asset is a local draft pending owner style review.
- Updated pre-existing verification assumptions that treated every raster logo as legacy or still opened the removed application topbar. The staff-menu audit now opens the actual bottom-dock menu. Standalone-state tests assert the current marketing-only topbar rule.

## Image provenance

Built-in `image_gen.imagegen` generated the original illustration and recolored the watering can and kite through the same image tool. Image generation did not use third-party iconography or stock images. The original and revised tool outputs remain in the Codex generated-image directory; the selected output is encoded as `frontend/public/rebuild/identity/ideas-garden.webp` and registered as `identity.garden`. Encoding/resizing preserves transparency and adds no content.

Generation prompt: an original compact flat tactile cut-paper garden of ideas, with an entirely blank indigo notebook, mint seedling, watering can, three plain golden coins, a paper kite and indigo orbital shapes. Transparent negative space; rounded solid silhouettes; no characters, stock icons, text, numerals, logos, gradients or glass. The final editing prompt preserves composition and changes the watering can to sky/cobalt blue and the kite/tail to lavender/purple, removing orange and red because those colors belong to action and error states.

## Verification and status

Implementation: complete. Local verification: passed. Human visual acceptance: pending. Release: not requested. No account, database, authentication provider or production asset is changed.

Evidence is recorded under `audit-results/entry-polish-preview/` and `audit-results/entry-polish-audits-final/`. Screenshots use local routes with synthetic Core identities; controlled component previews expose conditional/success/failure UI states without performing live account, email or identity transactions. The initial audit could not open the retired staff-topbar selector; it is preserved as setup-error evidence under `audit-results/entry-polish-audits/`, not reported as passed.

Affected frontend checkpoints: UI-ENTRY-01 (global graphic branding), UI-ENTRY-02 (entry-flow layout), UI-ENTRY-03 (proprietary welcome art). Product A.1, G.1 and H.5 retain their separate product acceptance and release statuses.

## Final local evidence

- Frontend type-check and lint passed; 79 focused identity/shell/application tests passed.
- Text-fit: 5,232 configurations; proportion: 1,308; copy budget: 1,308. All three passed with zero findings, JavaScript errors or media failures. Coverage is 55 entry/shell states across three locales, both themes and up to four widths (320, 375, 768, 1280). Narrow-menu states retain their supported width restrictions. This is the affected-state matrix, not the entire product catalogue.
- Synthetic Core reported empty envelopes for three background reads under the teen analytics disclosure (`/coop-goals`, `/learn/bridges`, `/learn/rhythm`). This does not establish those underlying product surfaces or full-stack behavior; the foreground disclosure and entry-flow geometry are covered.
- Asset integrity passed for 443 class B assets and 334 text-free raster OCR checks, with the official company graphic authenticated separately. After the illustration color revision, the final raster received its own fresh OCR check (zero words; SHA-256 `6c9a022357edc2343fb3f39555730f1c581300d526a89206dc3413adc832bf4f`) and the complete structural manifest gate passed again. Unchanged raster OCR evidence is reused rather than repeated.
- The local draft build passed with scorer/source parity, asset integrity, TypeScript, bundling and SEO generation. Build-time OCR reuses the preceding full scan plus final-art delta; the output carries `LOCAL-DRAFT-BUILD.txt` and is not a release artifact.
- Twelve final desktop/mobile captures of login, registration, verification, welcome, Mentor choice and guest upgrade have zero JavaScript or media failures. The illustration is 960 × 877, RGBA WebP, 92,656 bytes; the original logo pixels are unchanged.
- Product specification checksums/agent parity and whitespace checks passed. No commit, push or deployment was performed. Human visual acceptance remains pending.
