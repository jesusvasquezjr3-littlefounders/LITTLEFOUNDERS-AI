# Marketing spacing and composition refinement — 2 October 2026

## Owner request and findings

The owner approved the local marketing artwork and requested better proportions, indentation and distribution on desktop and mobile. Scope remains local only.

The complete-page screenshots exposed problems that the mechanical proportion gate alone did not identify: cumulative shell, hero and section padding; section headings spanning both columns although their content belongs to one; a stretched reasoning card with excessive empty height; feature art competing with adjacent cards; header branding aligned to the viewport rather than the page; and staggered setup cards weakening alignment.

## Changes

- One centered 1120 px content width now guides the marketing header and page. Existing token-based phone/tablet gutters and safe-area protection remain.
- Shared section gaps replace cumulative page-gap and per-section padding. Hero art and supporting illustrations have separate size limits, smaller on phones.
- Split-section headings are grouped with the first content column. Responsive reading order remains heading, explanation, supporting content.
- The landing Mentor block groups its explanation and natural-height interactive demo together, opposite its artwork and actual-model character legend. It no longer stretches a white card through an artificially tall grid.
- Family illustrations are subordinate to the example card; the setup sequence aligns its desktop cards and uses a compact number/title/body arrangement on phones and two columns on tablets.
- Legal content retains complete text and a separate reading/navigation layout. Brand pixels, custom controls and all artwork remain unchanged. Application layouts are outside this styling scope.

## Status and evidence

Implementation: complete. Final local verification: passed, with composite audit provenance below. Human visual acceptance: pending. Release: not requested.

- Frontend type-check, lint and 72 focused component tests passed. i18n, SEO/path parity, product-spec checksum/agent parity and whitespace checks passed.
- Full local draft build passed, including prebuild source parity, manifest integrity and 333 text-free raster OCR checks, with the original logo separately authenticated. The final CSS ownership/sequence metadata correction was rebuilt with `npm run build --ignore-scripts`; its asset bytes/manifest are unchanged, so the passed asset/OCR evidence is reused. The final output is explicitly stamped as non-releasable.
- Header interaction matrix: `audit-results/marketing-composition-header-final/`, 24/24 contexts passed (three locales, both themes, four widths; pointer/keyboard navigation, preferences and accessibility).
- Full interface matrix: `audit-results/marketing-composition-final/`, 24 states, three locales, both themes and up to four widths: 2,280 text-fit / 570 proportion / 570 copy-budget configurations. Text-fit and copy budget passed immediately. Its proportion report retained findings for the isolated shell preview (header wrapper styling depended on a marketing route import) and the equal-height numbered setup sequence.
- Corrected the actual stylesheet dependency by moving header styles into the shell's own stylesheet. Explicitly classified the numbered chronological setup sequence as a uniform sequence under the Bible's legitimate uniform-collection exception; the generic card-row detector remains enabled everywhere else. This changes metadata, not the visual composition or the detector.
- Fresh correction matrix: `audit-results/marketing-composition-delta/`, five affected states, 456 text-fit / 114 proportion / 114 copy-budget configurations: all passed with zero findings, JavaScript errors or media errors. Unaffected page composition is unchanged. The base plus bounded correction reports establish coverage for the complete 24-state matrix; `audit-results/marketing-composition-verified/` records this composite provenance and zero remaining findings, without modifying or claiming the initial report passed.
- Fresh complete screenshots confirm desktop and phone composition in Spanish. Frontend verification uses synthetic Core and does not establish full-stack or production acceptance.

Affected frontend checkpoints: UI-MKT-01 and UI-MKT-04, with UI-MKT-02/03 regression coverage. No product requirement is accepted by this refinement. Previous reports are historical evidence only; fresh screenshots and the three mandatory interface audits will record this composition separately.

## Full-page visual comparison

Screenshots are captured on the actual local routes, in Spanish/light mode, with synthetic Core and optional cookies rejected through the real control. All page content remains intact. These height comparisons demonstrate removed redundant spacing, not a target to minimize reading length.

| Page | Viewport width | Previous height | Refined height | Reduction |
|---|---|---|---|---|
| landing | 1440 | 4139 | 3638 | 12.1% |
| como-funciona | 1440 | 2919 | 2258 | 22.6% |
| familias | 1440 | 3557 | 2953 | 17.0% |
| preguntas-frecuentes | 1440 | 4454 | 4086 | 8.3% |
| landing | 390 | 6565 | 5964 | 9.2% |
| como-funciona | 390 | 3419 | 3017 | 11.8% |
| familias | 390 | 5511 | 4873 | 11.6% |
| preguntas-frecuentes | 390 | 6632 | 6305 | 4.9% |

Updated full-page captures and their receipt: `audit-results/marketing-composition-preview/`. Previous captures: `audit-results/marketing-fullpage/`. The initial aligned header wrapped its desktop actions in Spanish; spacing was corrected before the final screenshot set and final recorded interface matrix. The interrupted initial audit is excluded from final evidence.
