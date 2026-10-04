# Local marketing extension, 2 October 2026

Owner correction: the outlined wordmark and ordinary-human-only compositions in this checkpoint were rejected. See [MARKETING-CHARACTERS-AND-LOGO.md](MARKETING-CHARACTERS-AND-LOGO.md) for the replacement implementation and separate final verification. This historical evidence does not establish acceptance of the rejected design.

The owner requested the remaining marketing pages to adopt the local landing style, more original illustrations in the hero's house style, a graphic LittleFounders logo in the topbar, and a clean interface. Work remains local only. No commit, push, release, remote upload or production change is authorized.

## Implementation

- How it works, Families and FAQ share the landing's typography, spacing, asymmetrical heroes, rounded illustration frames and restrained panel treatment. Hero images remain below the heading on phones. Existing decisions, consequences, session-aware calls to action, FAQ categories and deep links remain functional.
- Three original illustrations were generated through the built-in ImageGen tool using the existing landing hero as a style reference. They appear in the three page heroes and selected interior sections, including the landing's family section. Delivery images are local WebP files, approximately 47–54 KB each. Source prompts and provenance are in [the art record](MARKETING-ART-PROVENANCE.md).
- How it works also frames Rho's existing real-model catalogue render on the actual Diorama, alongside the four real-model Mentor portraits. No AI look-alike replaces a Mentor.
- Terms and Privacy use the same quiet spacing, hierarchy and surface treatment, retaining the complete legal text, clause links, search and cookie controls. Legal reading areas deliberately remain free of decorative illustrations.
- Marketing headers and their menu use one accessible graphic wordmark image. It is vector lettering in the current brand typeface and palette, with a separately authored dark variant. It replaces the visible text-plus-icon assembly; compact app branding remains unchanged. The old email logo contains stock figures according to its own source documentation and was not revived.
- The public badge-link surface also uses the graphic brand and a neutral, uncluttered public-page treatment. Its expiration contract and server-provided achievement image remain unchanged.
- Language selectors remain custom application controls; theme switches remain icon-only; application pages still have no topbar.

## Verification and status

Implementation and final local verification are complete; human acceptance and new-asset style review are pending.

- 72 focused component tests passed across the site, landing, rebuilt shells, mounted layouts and standalone headers. The expired-badge test now scopes its no-achievement-image assertion to the main content, preserving the new accessible header logo.
- Frontend type checking and lint passed. Three-locale parity/hardcoded-copy checks, SEO surface and marketing-path checks passed. On Windows, the i18n script used the installed Git Bash explicitly because the default `bash` resolved to an unavailable WSL shell.
- Asset integrity passed: 21/24 glyph families, 440 class B assets, 330 raster images checked by offline OCR; nine draft assets remain awaiting owner review (four from the preceding landing checkpoint, three new illustrations and two graphic wordmarks).
- All three UI audits covered 35 states across three locales, two themes and four widths (including +40% text and WCAG spacing): 3,336 text-fit configurations and 834 copy-budget configurations passed, with no JavaScript or media errors. The state filter also included eleven existing public-profile contexts because their route IDs start with `/@`; those contexts are regression evidence, not part of this redesign.
- The proportion audit identified only a 4 px mobile gap between language and theme controls. It was corrected to the 8 px minimum. The final header check reran all three audits on the real visitor header, signed-in landing/family headers and menu: 360 text-fit, 90 proportion and 90 copy-budget configurations passed, with no JS/media errors. The unchanged page-body results remain valid; the initial proportion report is retained as the failure receipt rather than overwritten.
- Real keyboard/pointer navigation, language and theme switching, loaded graphic branding, skip links, route focus, overflow and scoped axe checks passed in 24/24 marketing-header contexts (three locales, two themes, 320/375/768/1280 px). Reports and screenshots: `audit-results/marketing-header-interactions/`.
- `npm run build:local` passed with the full local prebuild gates. After the CSS-only gap correction, the unchanged asset/scorer checks were reused and the type-check/Vite/SEO bundle was refreshed; `dist/LOCAL-DRAFT-BUILD.txt` explicitly records this local-only draft status. Existing broad bundle-size warnings remain; no new release build is claimed.

Evidence: `audit-results/marketing-local-extension/`, `audit-results/marketing-header-spacing/`, `audit-results/marketing-header-interactions/`, and local visual captures in `audit-results/marketing-visual-review/`.

The longer FAQ hero exposed a pre-existing mobile-input issue in the audit driver: CDP pointer coordinates address the visual viewport, while DOM rectangles use the layout viewport. A measured 74 px viewport offset made the intended Privacy press land on the first question. Both active pointer drivers now subtract that offset; the FAQ fixture additionally requires `data-faq-filter=privacy` after the press. The final audits reached this state without collisions or retries. No product click handler was changed to accommodate the test.

Acceptance and new-asset style review remain pending. The new illustrations and graphic wordmark are registered local drafts. Production asset gates still reject unapproved assets; local builds are explicitly marked as draft builds. No release has taken place.
