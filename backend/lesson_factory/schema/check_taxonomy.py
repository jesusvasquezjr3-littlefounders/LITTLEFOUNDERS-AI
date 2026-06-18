#!/usr/bin/env python3
"""
Valida concept_taxonomy.json:
  - prerequisitos colgantes (apuntan a un concept_id inexistente)
  - ciclos en el grafo de prerequisitos (debe ser un DAG)
  - (opcional) concept_ids referenciados en lecciones que no existen en la taxonomía

Uso:
  python3 schema/check_taxonomy.py
  python3 schema/check_taxonomy.py --scan <ruta_lesson.json o glob>
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
TAX_FILE = BASE / "concept_taxonomy.json"


def load():
    return json.loads(TAX_FILE.read_text(encoding="utf-8"))["concepts"]


def check_dangling(concepts: dict) -> list[str]:
    errs = []
    for cid, c in concepts.items():
        for p in c.get("prerequisites", []):
            if p not in concepts:
                errs.append(f"'{cid}' depende de '{p}' que no existe")
    return errs


def find_cycles(concepts: dict) -> list[list[str]]:
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {k: WHITE for k in concepts}
    cycles, stack = [], []

    def dfs(u):
        color[u] = GRAY
        stack.append(u)
        for v in concepts[u].get("prerequisites", []):
            if v not in concepts:
                continue
            if color[v] == GRAY:
                cycles.append(stack[stack.index(v):] + [v])
            elif color[v] == WHITE:
                dfs(v)
        stack.pop()
        color[u] = BLACK

    for k in concepts:
        if color[k] == WHITE:
            dfs(k)
    return cycles


def scan_lessons(pattern: str, concepts: dict):
    unknown, used = {}, set()
    for path in glob.glob(pattern, recursive=True):
        try:
            L = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            continue
        for ex in (L.get("content_es", []) or []):
            for cid in (ex.get("concept_ids") or []):
                used.add(cid)
                if cid not in concepts:
                    unknown.setdefault(cid, []).append(Path(path).name)
    return used, unknown


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", help="glob de lecciones para cross-check de concept_ids")
    args = ap.parse_args()

    concepts = load()
    print(f"Conceptos en la taxonomía: {len(concepts)}")

    dangling = check_dangling(concepts)
    cycles = find_cycles(concepts)

    print(f"Prerequisitos colgantes: {'❌ ' + str(len(dangling)) if dangling else '✅ 0'}")
    for e in dangling:
        print(f"  - {e}")
    print(f"Ciclos (debe ser DAG): {'❌ ' + str(len(cycles)) if cycles else '✅ 0'}")
    for c in cycles:
        print(f"  - {' -> '.join(c)}")

    if args.scan:
        used, unknown = scan_lessons(args.scan, concepts)
        print(f"\nconcept_ids usados en lecciones escaneadas: {len(used)}")
        print(f"concept_ids desconocidos (no en taxonomía): {'❌ ' + str(len(unknown)) if unknown else '✅ 0'}")
        for cid, files in list(unknown.items())[:20]:
            print(f"  - '{cid}' en {files[:3]}")

    ok = not dangling and not cycles
    print(f"\nTAXONOMÍA: {'✅ VÁLIDA (DAG, sin colgantes)' if ok else '❌ INVÁLIDA'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
