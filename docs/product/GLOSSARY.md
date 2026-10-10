---
title: Glossary
status: scaffold
updated: 2026-10-10
---

# Glossary

> The one agreed vocabulary of the domain, so code, UI copy, data and documents use the same words.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Language models drift between synonyms. A fixed vocabulary keeps table names, identifiers, API fields and user-facing copy consistent in all three locales.

## Read this when

- Naming a table, type, endpoint, component or locale key.
- Writing user-facing copy.
- Anything in the domain is ambiguous.

## To define

- [ ] Each domain term with a definition and an example.
- [ ] Words that must not be used for it (rejected synonyms).
- [ ] The translation of each term in en-US, es-MX and pt-BR.
- [ ] Terms that must never appear in child-facing copy.

## Terms decided

| Term (en-US) | es-MX | pt-BR | Meaning |
|---|---|---|---|
| child | (not shown yet) | (not shown yet) | A user type: an account whose declared age is under 18. The stored word; the previous version stored `kid`, with another meaning ([[DECISIONS]] D-030). |
| universal | (not shown yet) | (not shown yet) | A user type: an account whose declared age is 18 or over. |
| parent | (not shown yet) | (not shown yet) | A user type on top of `universal`: a verified parent. The verification is a later feature. |
| admin, superadmin | (not shown yet) | (not shown yet) | Staff types on top of `universal`. `superadmin` is only for a `@littlefounders.ai` address and grants the others. |
| Core | | | The backend: the only server the browser calls ([[DECISIONS]] D-028). Not a word a user reads. |
| Seeds | Semillas | to confirm with the owner ("Sementes" is the direct translation) | The official currency of LittleFounders ([[DECISIONS]] D-024). It never represents real money. How it is earned and used is not designed yet. |

## Related

- [[DECISIONS]]
- [[PRODUCT-REQUIREMENTS]]
- [[DATABASE-GUIDE]]
- [[CODE-STYLE-GUIDE]]
- [[USER-FLOWS]]

Back to [[INDEX]].

## Update this document when

- A new domain concept appears.
- A term is renamed or a synonym is rejected.
