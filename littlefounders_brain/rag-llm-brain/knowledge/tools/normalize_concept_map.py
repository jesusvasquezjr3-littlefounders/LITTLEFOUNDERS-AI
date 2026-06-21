#!/usr/bin/env python3
"""
normalize_concept_map.py — HIGIENE + DE-BLOAT del concept_map (bloqueante antes de generar a escala).

La evaluación crítica encontró que el mapa, aunque con cobertura de marco excelente, está estructuralmente
sucio (rompe el pre-filtro DURO país/idioma/tier de la arquitectura) e inflado:
  · depth_tier: ~54 valores distintos (esquema exige 3) → 11% fuera de enum.
  · age_bands:  ~305 valores distintos (esquema exige tier1-5) → rangos demográficos, "adult", "professional".
  · concept_id: 59% no canónicos (códigos opacos, placeholders 'missing-*', colisiones).
  · celdas shared con fuga jurisdiccional (IVA/SAT/IRS/401k…) pese a la regla 'shared = NEUTRO'.
  · atomización en lista ('Presupuesto para X' ×24) que infla el conteo sin densidad.

Este normalizador es DETERMINISTA (sin API) y reusable por build_concept_map.py para que la generación
futura ya salga limpia. Aplica: depth_tier→3 enum, age_bands→tier1-5, concept_id→dotted determinista,
firewall léxico en shared (descarta temas con tokens jurisdiccionales), y colapso de atomizaciones.

Uso:  python3 tools/normalize_concept_map.py            # normaliza in-place (atómico) + reporte
      python3 tools/normalize_concept_map.py --dry-run  # solo reporta, no escribe
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

TOOLS = Path(__file__).resolve().parent
META = TOOLS.parent / "_meta"
MAP_FILE = META / "concept_map.yaml"

DEPTH_ENUM = {"intro", "intermediate", "advanced"}
_DEPTH_SYN = {
    "intro": "intro", "introductory": "intro", "basico": "intro", "básico": "intro", "basic": "intro",
    "beginner": "intro", "foundation": "intro", "foundational": "intro", "core": "intro", "1": "intro",
    "intermediate": "intermediate", "intermedio": "intermediate", "medio": "intermediate", "2": "intermediate",
    "advanced": "advanced", "avanzado": "advanced", "deep": "advanced", "profundo": "advanced",
    "expert": "advanced", "experto": "advanced", "professional": "advanced", "3": "advanced", "4": "advanced",
}
TIER_ENUM = {"tier1", "tier2", "tier3", "tier4", "tier5"}
_SLUG_RE = re.compile(r"[^a-z0-9]+")

# Tokens jurisdiccionales DUROS: prohibidos en celdas shared (firewall léxico).
_FORBIDDEN = [
    "iva", "isr", "sat", "rfc", "cfdi", "resico", "rif", "uma", "imss", "infonavit", "afore",
    "condusef", "banxico", "sofipos", "socap",
    "irs", "ssn", "ein", "itin", "fica", "401(k)", "401k", "roth", "w-2", "1099", "medicare",
    "medicaid", "niit", "salt", "hsa", "fbar", "gaap estadounidense", "estadounidense",
]
_FORB_RE = re.compile(r"\b(" + "|".join(re.escape(t) for t in _FORBIDDEN) + r")\b", re.I)


def norm_depth(v) -> str:
    return _DEPTH_SYN.get(str(v).strip().lower(), "intermediate")


def _tier_of(token: str) -> list[str]:
    t = str(token).strip().lower()
    if t in TIER_ENUM:
        return [t]
    if t in ("all", "todos", "*"):
        return ["tier3", "tier4", "tier5"]
    nums = [int(x) for x in re.findall(r"\d+", t)]
    if nums:
        lo = min(nums)
        if lo <= 7:
            return ["tier1"]
        if lo <= 10:
            return ["tier2"]
        if lo <= 13:
            return ["tier3"]
        if lo <= 17:
            return ["tier4"]
        return ["tier5"]               # 18+ y cualquier rango adulto
    if any(k in t for k in ("niñ", "child", "kid", "primar")):
        return ["tier2"]
    if any(k in t for k in ("adult", "professional", "senior", "joven", "teen", "secundar", "univers")):
        return ["tier5"]
    return []


def norm_age_bands(v) -> list[str]:
    bands = v if isinstance(v, list) else [v]
    out: list[str] = []
    for b in bands:
        for t in _tier_of(b):
            if t not in out:
                out.append(t)
    return sorted(out) or ["tier5"]


def slugify(s: str) -> str:
    return _SLUG_RE.sub("-", str(s).strip().lower()).strip("-")


def norm_concept_id(country: str, domain: str, subdomain: str, slug: str) -> str:
    return f"{country}.{domain}.{subdomain}.{slugify(slug)}".replace("_", "-")


def is_jurisdictional(topic: dict) -> bool:
    blob = " ".join(str(topic.get(k, "")) for k in ("slug", "title_es", "title_en", "angle", "concept_id"))
    return bool(_FORB_RE.search(blob))


def collapse_atomization(topics: list[dict], max_group: int = 5, keep: int = 3) -> tuple[list[dict], int]:
    """Colapsa grupos grandes con el MISMO prefijo de título ('Presupuesto para X' ×N) a `keep` ejemplos."""
    groups: dict[str, list[int]] = {}
    for i, t in enumerate(topics):
        words = slugify(t.get("title_es", "")).split("-")
        prefix = "-".join(words[:2])
        groups.setdefault(prefix, []).append(i)
    drop = set()
    for prefix, idxs in groups.items():
        if len(idxs) > max_group and prefix:
            for i in idxs[keep:]:
                drop.add(i)
    return [t for i, t in enumerate(topics) if i not in drop], len(drop)


def normalize(cmap: dict) -> dict:
    cells = cmap.get("cells", {})
    stats = {"cells": 0, "topics_in": 0, "topics_out": 0, "depth_fixed": 0, "age_fixed": 0,
             "cid_fixed": 0, "shared_dropped": 0, "atomiz_dropped": 0}
    for key, cell in cells.items():
        country, domain, subdomain = key.split("/")
        topics = cell.get("topics", []) or []
        stats["cells"] += 1
        stats["topics_in"] += len(topics)
        kept = []
        seen_slugs = set()
        for t in topics:
            # firewall shared: descartar temas jurisdiccionales en celdas shared
            if country == "shared" and is_jurisdictional(t):
                stats["shared_dropped"] += 1
                continue
            slug = slugify(t.get("slug", "")) or slugify(t.get("title_es", ""))
            if not slug or slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            nd = norm_depth(t.get("depth_tier"))
            if nd != t.get("depth_tier"):
                stats["depth_fixed"] += 1
            na = norm_age_bands(t.get("age_bands", []))
            if na != t.get("age_bands"):
                stats["age_fixed"] += 1
            ncid = norm_concept_id(country, domain, subdomain, slug)
            if ncid != t.get("concept_id"):
                stats["cid_fixed"] += 1
            t.update({"slug": slug, "depth_tier": nd, "age_bands": na, "concept_id": ncid})
            kept.append(t)
        kept, n_atom = collapse_atomization(kept)
        stats["atomiz_dropped"] += n_atom
        stats["topics_out"] += len(kept)
        cell["topics"] = kept
    cmap.setdefault("_meta", {})["normalized"] = True
    return stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    cmap = yaml.safe_load(MAP_FILE.read_text(encoding="utf-8"))
    stats = normalize(cmap)
    print("NORMALIZACIÓN DEL CONCEPT MAP")
    print(f"  celdas: {stats['cells']}")
    print(f"  temas: {stats['topics_in']} → {stats['topics_out']} "
          f"(−{stats['topics_in'] - stats['topics_out']})")
    print(f"  depth_tier corregidos: {stats['depth_fixed']}")
    print(f"  age_bands corregidos:  {stats['age_fixed']}")
    print(f"  concept_id regenerados: {stats['cid_fixed']}")
    print(f"  shared (fuga) descartados: {stats['shared_dropped']}")
    print(f"  atomización colapsada: {stats['atomiz_dropped']}")
    if args.dry_run:
        print("  (dry-run: no se escribió)")
        return 0
    tmp = MAP_FILE.with_suffix(".yaml.tmp")
    tmp.write_text(yaml.safe_dump(cmap, allow_unicode=True, sort_keys=True, width=120), encoding="utf-8")
    tmp.replace(MAP_FILE)
    print(f"  escrito → {MAP_FILE.relative_to(TOOLS.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
