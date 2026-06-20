#!/usr/bin/env python3
"""
build_index.py — construye el índice del cerebro a partir del corpus markdown.

El markdown es la FUENTE DE VERDAD; el índice (.db) es un artefacto DERIVADO regenerable
(gitignoreado). Recorre shared/mx/us, trocea por encabezados/secciones-de-edad, embebe
(metadata prependida) y escribe SQLite con:
  · tabla `chunks`  — metadata denormalizada por chunk + texto + embedding (blob float32)
  · tabla FTS5 `chunks_fts` — índice léxico (BM25) sobre el texto
  · tabla `meta`    — backend de embedding, dim, fecha de build, conteos

Uso:
  python3 tools/build_index.py                      # embedder hash (sin dependencias)
  python3 tools/build_index.py --embedder fastembed # semántica real (requiere `fastembed`)
  python3 tools/build_index.py --out index/kb.db
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from kb_common import KB, Embedder, chunk_doc, embed_input, iter_corpus, to_blob

DEFAULT_OUT = KB / "index" / "kb.db"

SCHEMA = """
CREATE TABLE chunks (
  chunk_id TEXT PRIMARY KEY,
  doc_id TEXT, country TEXT, jurisdiction TEXT, language TEXT,
  domain TEXT, subdomain TEXT, concept_ids TEXT,
  age_band TEXT, depth_tier TEXT, volatility TEXT,
  last_verified_date TEXT, review_due TEXT, source_ids TEXT,
  heading_path TEXT, text TEXT, embedding BLOB
);
CREATE INDEX idx_country_lang ON chunks(country, language);
CREATE INDEX idx_domain ON chunks(domain, subdomain);
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, chunk_id UNINDEXED, tokenize='unicode61');
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--embedder", default="hash", choices=["hash", "fastembed"])
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    emb = Embedder(backend=args.embedder)
    docs = list(iter_corpus())
    chunks = [c for d in docs for c in chunk_doc(d)]
    if not chunks:
        print("⚠️  No hay chunks (corpus vacío).")
        return 1
    vecs = emb.encode([embed_input(c) for c in chunks])
    for c, v in zip(chunks, vecs):
        c.embedding = v

    con = sqlite3.connect(out)
    con.executescript(SCHEMA)
    con.executemany(
        """INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(c.chunk_id, c.doc_id, c.country, c.jurisdiction, c.language, c.domain,
          c.subdomain, json.dumps(c.concept_ids, ensure_ascii=False), c.age_band,
          c.depth_tier, c.volatility, c.last_verified_date, c.review_due,
          json.dumps(c.source_ids), c.heading_path, c.text, to_blob(c.embedding))
         for c in chunks],
    )
    con.executemany("INSERT INTO chunks_fts (text, chunk_id) VALUES (?, ?)",
                    [(c.text, c.chunk_id) for c in chunks])
    con.executemany("INSERT INTO meta VALUES (?, ?)", [
        ("embed_backend", args.embedder), ("embed_dim", str(emb.dim)),
        ("built_at", "2026-06-19"), ("n_docs", str(len(docs))), ("n_chunks", str(len(chunks))),
    ])
    con.commit()
    con.close()

    by_country: dict[str, int] = {}
    for c in chunks:
        by_country[c.country] = by_country.get(c.country, 0) + 1
    print(f"✅ Índice escrito en {out}")
    print(f"   docs={len(docs)}  chunks={len(chunks)}  embedder={args.embedder} dim={emb.dim}")
    print(f"   por país: {by_country}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
