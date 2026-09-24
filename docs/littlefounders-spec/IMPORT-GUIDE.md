# Import guide

The package is built so that importing it **adds** files and never silently overwrites anything in the repository.

## 1. Before you copy

1. **Look for older copies** of these documents in the repository, for example from an earlier hand-off:
   `git grep -l "Product Gold Standard Requirements"`, `git grep -l "Owner Decision Log"`, `git grep -l "Frontend Design Research Foundation"`, and any folder named `frontend-delivery*` or `frontend-bible`.
   If you find any, **delete them in the same commit** that adds this package. Two versions of the requirements or the Bible side by side is the one thing that would make the import a problem. This package supersedes all of them.
2. **Locate the sources this package cites by name** and note their real paths. They are listed in section 3 of this guide.

## 2. Copy

Copy the whole folder to one place, for example:

```
<repo>/docs/littlefounders-spec/
```

Keep the inner structure (`product/`, `product/reviews/`, `frontend/...`) exactly as it is. Frontend files refer to each other with relative paths such as `../mockup/KNOWN-DEVIATIONS.md`, and product files refer to `frontend/...` by folder name.

The file names `10-*`, `11-*`, `12-*` and `13-*` continue the numbering of the existing product audit files `00-*` to `09-*`. If your team prefers them next to those files, move the whole `product/` folder content there, including `reviews/`. References are by file name, so they still resolve.

## 3. Map the external sources (write these paths into AGENTS.md)

| Cited as | What it is | Where it lives in the repository (fill in) |
|---|---|---|
| `00-EXECUTIVE-SUMMARY.md` … `09-CONFIGURATION.md` | The product audit of the legacy platform | |
| `COSMIC_NARRATIVE.md` | The brand narrative and the approved brand lines | |
| 3D Mentor characters (Dr. Rho, Zara, Liruf, Dina) | Models | |
| Diorama | The 3D scene the Mentor stands on | |
| Pose catalogue | The defined poses and animations | |
| Forge | The content pipeline (lesson authoring and gates) | |

## 4. Check the import

1. **Integrity.** From inside the copied folder, run `sha256sum -c CHECKSUMS.sha256`. Every line must say `OK`.
2. **Audit tools.** In `frontend/verification-tools`, run `npm install`, set `CHROME_PATH` to a local Chrome or Chromium, and run:
   - `npm run text-fit`: expected 0 issues;
   - `npm run proportion`: expected 0 findings;
   - `npm run copy-budget`: expected 142 findings, the known K40 baseline. This command exits with code 1 while the K40 baseline stands, and npm reports that as an error: that is expected. Exit code 2 means a setup problem.
3. **Agent instructions.** Add `AGENTS-SNIPPET.md` to the repository's `AGENTS.md`, with the paths from section 3. Do not replace the whole file.

## 5. What the import changes in the codebase (for planning)

- **Nothing is deleted by the import itself.** The deletions are work items that follow from the documents:
  - the legacy Mentor chat UI and the legacy buttons and controls are removed and rebuilt (OD-15, Bible `08` §0, `02` rule 23);
  - the frontend is rebuilt (OD-2);
  - generic icon sets beyond the 24 system glyphs are removed (OD-14).
- The mockup is **not** production code. It is a visual reference. Its state hooks (`S`, `render()`) exist only so the audit tools can drive it. Auditing the real application needs a new driver with the same checks (see `frontend/README.md`).
