# Rebuild fonts

Fredoka and Nunito Latin variable WOFF2 files were extracted without modification from the font-face blocks in `docs/littlefounders-spec/frontend/mockup/littlefounders-mockup.html`, as specified by Frontend Bible 02 section 6. The rebuild serves them locally; it makes no request to an external font service.

- `fredoka-latin-v1.woff2`: Fredoka, weights 300–700.
- `nunito-latin-v1.woff2`: Nunito, weights 200–1000.

The accompanying SIL Open Font License files were obtained from the Google Fonts repository's `ofl/fredoka/OFL.txt` and `ofl/nunito/OFL.txt`. Retain them when redistributing the fonts. Use a new versioned filename if the font bytes change, because the application's deployed font URLs are cached.
