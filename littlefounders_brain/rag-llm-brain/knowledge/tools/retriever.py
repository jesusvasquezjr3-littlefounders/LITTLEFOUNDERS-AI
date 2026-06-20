#!/usr/bin/env python3
"""
retriever.py — recuperación HÍBRIDA con firewall anti-fuga.

Orden (BRAIN_STRATEGY.md §5):
  1. PRE-FILTRO DURO obligatorio: language == target AND country IN (target, 'shared').
     `country` y `language` son argumentos SIN default — no hay ruta sin ellos.
  2. Filtros opcionales: domain, subdomain, concept_ids, exclude_stale.
  3. Scoring híbrido sobre los sobrevivientes: vector (coseno) + léxico (FTS5/BM25),
     fusionados con Reciprocal Rank Fusion (RRF, k=60).
  4. Boost por tier de edad (señal de ranking, NO filtro).
  5. Devuelve provenance (source_ids + last_verified_date) en cada hit.

Uso CLI:
  python3 tools/retriever.py --country mx --language es "¿cuánto es el IVA?"
  python3 tools/retriever.py --country us --language en --exclude-stale "what is the VAT rate?"
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sqlite3
from pathlib import Path

from kb_common import KB, ANCHOR_DATE, Embedder, cosine, from_blob

DEFAULT_DB = KB / "index" / "kb.db"
TODAY = dt.date.fromisoformat(ANCHOR_DATE)
RRF_K = 60
_WORD_RE = re.compile(r"[a-záéíóúñü0-9]+", re.I)


class Retriever:
    def __init__(self, db: Path = DEFAULT_DB):
        self.con = sqlite3.connect(db)
        self.con.row_factory = sqlite3.Row
        backend = self.con.execute("SELECT v FROM meta WHERE k='embed_backend'").fetchone()[0]
        self.emb = Embedder(backend=backend)

    def _candidates(self, country, language, domain, subdomain, concept_ids, exclude_stale):
        sql = ("SELECT * FROM chunks WHERE language = ? "
               "AND country IN (?, 'shared')")
        params = [language, country]
        if domain:
            sql += " AND domain = ?"; params.append(domain)
        if subdomain:
            sql += " AND subdomain = ?"; params.append(subdomain)
        rows = [dict(r) for r in self.con.execute(sql, params).fetchall()]
        if concept_ids:
            want = set(concept_ids)
            rows = [r for r in rows if want & set(json.loads(r["concept_ids"]))]
        if exclude_stale:
            kept = []
            for r in rows:
                rd = r["review_due"]
                if rd and dt.date.fromisoformat(rd) < TODAY:
                    continue
                kept.append(r)
            rows = kept
        return rows

    def _fts_ranks(self, query, candidate_ids):
        toks = _WORD_RE.findall(query.lower())
        if not toks:
            return {}
        match = " OR ".join(f'"{t}"' for t in toks)
        ranks = {}
        try:
            cur = self.con.execute(
                "SELECT chunk_id, bm25(chunks_fts) AS score FROM chunks_fts "
                "WHERE chunks_fts MATCH ? ORDER BY score", (match,))
            r = 0
            for row in cur.fetchall():
                if row["chunk_id"] in candidate_ids:
                    ranks[row["chunk_id"]] = r
                    r += 1
        except sqlite3.OperationalError:
            return {}
        return ranks

    def query(self, query, *, country, language, domain=None, subdomain=None,
              concept_ids=None, exclude_stale=False, tier=None, top_k=8):
        cands = self._candidates(country, language, domain, subdomain, concept_ids, exclude_stale)
        if not cands:
            return []
        cand_ids = {c["chunk_id"] for c in cands}
        # vector ranking
        qv = self.emb.encode_one(query)
        scored = sorted(cands, key=lambda c: cosine(qv, from_blob(c["embedding"])), reverse=True)
        vrank = {c["chunk_id"]: i for i, c in enumerate(scored)}
        # lexical ranking
        lrank = self._fts_ranks(query, cand_ids)
        # RRF fuse + tier boost
        fused = []
        for c in cands:
            cid = c["chunk_id"]
            s = 1.0 / (RRF_K + vrank.get(cid, 10_000))
            if cid in lrank:
                s += 1.0 / (RRF_K + lrank[cid])
            if tier and c["age_band"] == tier:
                s += 0.01
            fused.append((s, c))
        fused.sort(key=lambda x: x[0], reverse=True)
        out = []
        for s, c in fused[:top_k]:
            rd = c["review_due"]
            stale = bool(rd and dt.date.fromisoformat(rd) < TODAY)
            out.append({
                "chunk_id": c["chunk_id"], "doc_id": c["doc_id"], "score": round(s, 5),
                "country": c["country"], "language": c["language"], "domain": c["domain"],
                "subdomain": c["subdomain"], "age_band": c["age_band"],
                "volatility": c["volatility"], "heading": c["heading_path"],
                "last_verified_date": c["last_verified_date"], "stale": stale,
                "sources": json.loads(c["source_ids"]),
                "snippet": c["text"][:220],
            })
        return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--country", required=True, choices=["mx", "us"])
    ap.add_argument("--language", required=True, choices=["es", "en"])
    ap.add_argument("--domain")
    ap.add_argument("--tier")
    ap.add_argument("--exclude-stale", action="store_true")
    ap.add_argument("--top-k", type=int, default=6)
    ap.add_argument("--db", default=str(DEFAULT_DB))
    args = ap.parse_args()

    r = Retriever(Path(args.db))
    hits = r.query(args.query, country=args.country, language=args.language,
                   domain=args.domain, tier=args.tier, exclude_stale=args.exclude_stale,
                   top_k=args.top_k)
    print(f"\nQuery: {args.query!r}  [country={args.country} language={args.language}]\n")
    for h in hits:
        flag = " ⚠️STALE" if h["stale"] else ""
        print(f"  [{h['score']}] {h['country']}/{h['domain']}/{h['subdomain']} ({h['age_band']}) "
              f"«{h['heading']}»{flag}")
        print(f"        {h['snippet']}")
        print(f"        ↳ fuentes={h['sources']} verificado={h['last_verified_date']}\n")
    # aserción de cordura: ningún hit del país opuesto
    opposite = "us" if args.country == "mx" else "mx"
    leak = [h for h in hits if h["country"] == opposite]
    print(f"Firewall: {'❌ FUGA' if leak else '✅ sin fuga'} (hits país-opuesto: {len(leak)})")


if __name__ == "__main__":
    main()
