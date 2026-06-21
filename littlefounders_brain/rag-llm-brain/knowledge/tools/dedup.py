#!/usr/bin/env python3
"""
dedup.py — detección de near-duplicates SIN dependencias (shingle Jaccard).

A escala enciclopédica, dos temas del mapa pueden solaparse y producir docs casi-idénticos que
inflan el tamaño SIN sumar conocimiento. Este gate mide redundancia REAL (no por slug/string) para
que "tamaño = conocimiento único". Solo stdlib → corre en cualquier venv.

Se compara SIEMPRE dentro de la misma celda (country, domain, subdomain, language) y NUNCA cruzando
países (rompería el firewall) ni cruzando tiers del mismo concepto (las secciones por edad son
cobertura, no duplicación — por eso comparamos el cuerpo completo del doc, no secciones sueltas).
"""
from __future__ import annotations

import re

_WORD = re.compile(r"[a-záéíóúñü0-9]+", re.I)
_FACT = re.compile(r"<!--.*?-->", re.S)


def _norm(text: str) -> str:
    text = _FACT.sub(" ", text)            # ignora los sentinels @fact (no son prosa)
    return " ".join(_WORD.findall(text.lower()))


def shingles(text: str, k: int = 4) -> set:
    toks = _norm(text).split()
    if len(toks) < k:
        return {(t,) for t in toks}
    return {tuple(toks[i:i + k]) for i in range(len(toks) - k + 1)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def max_similarity(text: str, others: list[str]) -> float:
    """Máxima similitud Jaccard del texto vs una lista de textos existentes (0..1)."""
    s = shingles(text)
    best = 0.0
    for o in others:
        best = max(best, jaccard(s, shingles(o)))
        if best >= 0.999:
            break
    return best


def is_near_dup(text: str, others: list[str], threshold: float = 0.70) -> bool:
    """Heurístico conservador (shingle-Jaccard): atrapa docs casi-idénticos sin penalizar docs
    distintos del mismo subdominio. La dedup SEMÁNTICA fina (embeddings/SemDeDup) es el upgrade futuro;
    aquí la defensa primaria contra redundancia es el concept_map (temas distintos, deduplicados)."""
    return max_similarity(text, others) >= threshold
