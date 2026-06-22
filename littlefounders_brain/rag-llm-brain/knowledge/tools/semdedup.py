#!/usr/bin/env python3
"""
semdedup.py — dedup SEMÁNTICO (SemDeDup) del corpus: el upgrade que el gate léxico within-cell NO da.

El gate inline (dedup.py, shingle-Jaccard, misma celda) atrapa solo casi-verbatim DENTRO de una celda.
Es ciego a los dos modos de fallo que dominan a escala: (1) PARÁFRASIS (mismo hecho reescrito), y (2)
gemelos CROSS-CELL (el mismo concepto — p.ej. 'interés compuesto' — repetido en varias celdas del mapa).
Esta es la pasada de CURACIÓN estándar de la industria (Cosmopedia/NeMo Curator: MinHash → SemDeDup):
embeber + agrupar por similitud de COSENO y quedarse con un representante por cluster.

Firewall: compara SOLO dentro de (country, language). NUNCA cruza países (rompería el pre-filtro duro)
ni idiomas (una traducción EN no es duplicado de su ES). Por defecto solo REPORTA; con --demote degrada
el doc redundante de cada cluster a status:draft (revisión humana), conservando el MEJOR representante
(más cifras ancladas > cuerpo más largo > doc_id menor).

Requiere embeddings REALES para ser fiable: usa --embedder fastembed (el 'hash' es un placeholder léxico
y NO detecta paráfrasis — el tool avisa si lo usas).

Uso:
  python3 tools/semdedup.py --embedder fastembed                  # reporte (dry-run)
  python3 tools/semdedup.py --embedder fastembed --threshold 0.92
  python3 tools/semdedup.py --embedder fastembed --language es --demote
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from kb_common import KB, Embedder, cosine, iter_corpus  # noqa: E402

_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
DEFAULT_THRESHOLD = 0.92


def _clean_body(body: str) -> str:
    return re.sub(r"\s+", " ", _COMMENT_RE.sub(" ", body)).strip()


def _canonical_facts(fm: dict) -> int:
    try:
        return int(fm.get("canonical_facts", 0) or 0)
    except Exception:
        return 0


def _pairs_over_threshold(vecs, threshold):
    """Pares (i,j) con coseno >= threshold. Usa numpy si está (matriz); si no, O(n^2) puro."""
    n = len(vecs)
    pairs = []
    try:
        import numpy as np
        m = np.asarray(vecs, dtype="float32")          # filas L2-normalizadas (bge/fastembed lo están)
        sim = m @ m.T
        iu = np.triu_indices(n, k=1)
        for i, j in zip(*[idx[sim[iu] >= threshold] for idx in iu]):
            pairs.append((int(i), int(j), float(sim[i, j])))
    except ImportError:
        for i in range(n):
            for j in range(i + 1, n):
                c = cosine(vecs[i], vecs[j])
                if c >= threshold:
                    pairs.append((i, j, c))
    return pairs


def _clusters(n, pairs):
    """Union-find sobre los pares → clusters de near-duplicates."""
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, j, _ in pairs:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[max(ri, rj)] = min(ri, rj)
    groups: dict[int, list[int]] = {}
    for x in range(n):
        groups.setdefault(find(x), []).append(x)
    return [g for g in groups.values() if len(g) > 1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--embedder", default="fastembed", choices=["hash", "fastembed"])
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--language", default="es", choices=["es", "en"])
    ap.add_argument("--demote", action="store_true", help="degradar los redundantes a status:draft")
    args = ap.parse_args()

    if args.embedder == "hash":
        print("⚠️  embedder=hash es un placeholder léxico: NO detecta paráfrasis. Usa --embedder fastembed.")

    docs = [d for d in iter_corpus() if d.fm.get("language") == args.language]
    if not docs:
        print(f"No hay docs en idioma {args.language}.")
        return 0

    # agrupar por (country, language) — el firewall: nunca comparar cruzando país/idioma
    groups: dict[tuple, list] = {}
    for d in docs:
        groups.setdefault((d.fm["country"], d.fm["language"]), []).append(d)

    emb = Embedder(backend=args.embedder)
    import build_dataset as bd   # set_status / write_atomic (reusa la forma citada del status)

    total_dups = 0
    for (country, lang), gdocs in sorted(groups.items()):
        vecs = emb.encode([_clean_body(d.body) for d in gdocs])
        pairs = _pairs_over_threshold(vecs, args.threshold)
        clusters = _clusters(len(gdocs), pairs)
        if not clusters:
            continue
        print(f"\n=== {country}/{lang}: {len(clusters)} cluster(s) de near-duplicates "
              f"(coseno >= {args.threshold}) ===")
        for cl in clusters:
            members = sorted(cl, key=lambda i: (-_canonical_facts(gdocs[i].fm),
                                                -len(gdocs[i].body), gdocs[i].fm["doc_id"]))
            keep = members[0]
            redundant = members[1:]
            total_dups += len(redundant)
            print(f"  · KEEP {gdocs[keep].fm['doc_id']} "
                  f"(canon={_canonical_facts(gdocs[keep].fm)}, {len(gdocs[keep].body)} chars)")
            for i in redundant:
                print(f"      DUP  {gdocs[i].fm['doc_id']}  [{gdocs[i].rel}]")
                if args.demote:
                    for suf in (".es.md", ".en.md"):
                        p = gdocs[i].path.with_name(gdocs[i].path.name.replace(".es.md", suf)
                                                    if args.language == "es" else
                                                    gdocs[i].path.name.replace(".en.md", suf))
                        if p.exists():
                            bd.write_atomic(p, bd.set_status(p.read_text(encoding="utf-8"), "draft"))

    print(f"\n{'='*60}")
    verb = "DEGRADADOS a draft" if args.demote else "DETECTADOS (dry-run; usa --demote para degradar)"
    print(f"SemDeDup: {total_dups} doc(s) redundantes {verb} · embedder={args.embedder} "
          f"dim={emb.dim} · umbral coseno={args.threshold}")
    if args.embedder == "hash":
        print("   (recuerda: con 'hash' este número NO es fiable — corre con fastembed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
