# Marketing logo and character composition correction — 2 October 2026

## Owner correction and scope

The owner rejected the replacement typographic wordmark and ordinary-human-only artwork in the prior local marketing extension. OD-33 requires the existing full graphic LittleFounders logo and complex AI compositions derived from real 3D Mentor captures, with concrete actions and expressive gestures. This supersedes those two implementation claims in MARKETING-LOCAL-REDESIGN.md. All changes remain local; no commit, push or deployment is included.

## Implementation

- Marketing headers and the public badge header show `/rebuild/brand/logo.png`, byte-identical to the existing `public/email-templates/lf-logo-email.png`, including its full graphic design. The rejected two outlined wordmark variants are removed. Application screens still have no marketing topbar.
- Three original AI compositions use actual model captures as identity references: Rho and Liruf compare a decision using a balance; Zara and Dina construct a plant stand; all four Mentors build and discuss a miniature bridge. They replace the How it works, Families and FAQ hero artwork. The landing Mentor section and How it works collaboration section also use these compositions. Existing ordinary-human art remains in supporting sections.
- Images are not claimed to be direct mesh renders or pixel-exact 3D assets. OD-33 explicitly permits new AI marketing poses. The application Mentor stage and its catalogue render assets are unchanged.
- The no-text raster gate permits the exact original brand image by pinned SHA-256 and path only. It still rejects text in all other marketing illustrations. A contract test rejects altered logo bytes and alternate paths.
- Three translated accessible descriptions, asset registration, clean spacing and existing custom preferences are retained.

## Verification and acceptance

Implementation: complete. Final local verification: passed. Owner acceptance and visual review: pending. Release: not requested. All checks below ran after the corrected implementation was complete; prior reports are not used as evidence for these assets.

- Frontend type-check and lint: passed. Five focused component suites: 72/72 tests passed. Brand-logo integrity contract: 1/1 passed, covering exact bytes/path and altered-byte rejection.
- i18n checks, SEO surface, marketing path parity, product specification checksums/agent parity and diff whitespace check: passed.
- Full local draft build: passed, including prebuild source parity, asset registration/provenance, size budgets and OCR. 442 class-B assets; 333 non-logo rasters passed the no-text check. The existing graphic logo is separately verified by its pinned SHA-256. Eleven draft assets remain pending visual review; `dist/LOCAL-DRAFT-BUILD.txt` prevents treating this output as a release.
- Final page audits: `audit-results/marketing-character-correction/`, 24 affected marketing states, three locales, both themes and up to four viewport widths. Text-fit: 2,280 configurations; proportion: 570; copy budget: 570. Zero findings, JavaScript errors or media errors. Text-fit includes +40% text and WCAG text-spacing stress.
- Real pointer/keyboard header checks: `audit-results/marketing-character-header/report.json`, 24/24 contexts passed across three locales, both themes and 320/375/768/1280 widths. Covers language selection, theme toggling, branding, navigation, focus and accessibility. Synthetic Core is used; this is frontend verification, not a production/full-stack claim.
- Visual inspection confirmed the complete original logo and the new integrated character composition in desktop/mobile and Spanish dark-theme screenshots. The generated Families image containing extra characters was rejected and corrected before delivery.

Affected checkpoints: UI-MKT-02 and UI-MKT-03; layout/navigation regression checks also cover UI-MKT-01 and UI-MKT-04. No product requirement is marked accepted by this local art correction.
