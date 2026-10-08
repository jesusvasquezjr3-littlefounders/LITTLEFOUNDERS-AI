# Rebuild fonts

The rebuild uses one typeface, **Plus Jakarta Sans** (owner decision OD-37, 6 October 2026; it replaced Fredoka and Nunito). The Latin variable WOFF2 comes unmodified from Google Fonts (`fonts.gstatic.com`, family `plusjakartasans`, version 12, the `latin` subset). The rebuild serves it locally; it makes no request to an external font service.

- `plus-jakarta-sans-latin-v1.woff2`: Plus Jakarta Sans, weights 200-800. Latin covers every Spanish and Portuguese glyph used (`¿¡ñáéíóúüãõâêôç`).
- `plus-jakarta-sans-OFL.txt`: the SIL Open Font License, from the Google Fonts repository's `ofl/plusjakartasans/OFL.txt`. Retain it when redistributing the font.

The type steps (family, weight, size, tracking) are generated from Frontend Bible 02 section 6 and the `typography:` block: edit the Bible, then run `node scripts/build-rebuild-tokens.mjs`. Use a new versioned filename if the font bytes change, because the application's deployed font URLs are cached. The account emails name the family and load it from Google Fonts, because an email client cannot reach a self-hosted file; they fall back to Arial.
