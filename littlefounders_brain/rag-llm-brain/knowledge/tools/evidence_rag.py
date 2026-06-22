#!/usr/bin/env python3
"""
evidence_rag.py — recuperación de EVIDENCIA POR-TEMA para el autor (RAG-to-write, arquitectura v4).

v3 inyectaba un BLOB de evidencia por-DOMINIO (12k chars, genérico) → el autor escribía mayormente de
memoria y el verificador atómico no tenía contra-qué medir (unverifiable≈100%). v4: para CADA tema,
recuperamos los top-k pasajes de evidencia MÁS RELEVANTES y el autor escribe DESDE ahí. Así la prosa
queda anclada a fuentes reales y el verificador atómico puede confirmarla.

Ranking LÉXICO (TF-IDF/overlap, stdlib): elegido sobre embeddings a propósito — el hot-path del build NO
debe depender de cargar un modelo de 1GB ni de inferencia ONNX en CPU (frágil/OOM con 400+ pasajes por
dominio × 8 workers). El match tema↔pasaje por solape de términos (con peso IDF) es robusto, determinista,
$0 y rápido, y basta para seleccionar la evidencia relevante que el autor citará. (Embeddings = upgrade
opcional offline, no en la generación.)

API:
  retrieve_for_topic(country, domain, topic_text, top_k=8, max_chars=8000) -> str   # evidencia ordenada
  evidence_chunks(country, domain) -> list[str]                                      # pasajes crudos
"""
from __future__ import annotations

import math
import re
from collections import Counter
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_WORD_RE = re.compile(r"[a-záéíóúñü0-9]{3,}", re.I)
# stopwords mínimas ES/EN (evitan que 'the/de/and' dominen el solape)
_STOP = set("the and for that with you your are can not los las una unos unas del que por con para "
            "como más este esta esto sus son una uno cada other this from have will你".split())


def _toks(text: str) -> list[str]:
    return [t for t in _WORD_RE.findall(text.lower()) if t not in _STOP]


_chunk_cache: dict = {}
_idf_cache: dict = {}


def evidence_chunks(country: str, domain: str, min_len: int = 80) -> list[str]:
    key = (country, domain)
    if key not in _chunk_cache:
        d = KB / "evidence" / country / domain
        out: list[str] = []
        if d.exists():
            for p in sorted(d.glob("*.md")):
                for para in re.split(r"\n\s*\n", p.read_text(encoding="utf-8")):
                    para = re.sub(r"\s+", " ", _COMMENT_RE.sub(" ", para)).strip()
                    if len(para) >= min_len:
                        out.append(para)
        _chunk_cache[key] = out
    return _chunk_cache[key]


def _idf(country: str, domain: str):
    """IDF por término sobre los pasajes del dominio (se calcula una vez, se cachea)."""
    key = (country, domain)
    if key not in _idf_cache:
        chunks = evidence_chunks(country, domain)
        n = len(chunks) or 1
        df: Counter = Counter()
        for ch in chunks:
            for t in set(_toks(ch)):
                df[t] += 1
        _idf_cache[key] = (chunks, [set(_toks(ch)) for ch in chunks],
                           {t: math.log(1 + n / (1 + c)) for t, c in df.items()})
    return _idf_cache[key]


# Firewall de evidencia: el caché de NotebookLM mezcla jurisdicciones (us/taxes tiene fuentes MX). Para que
# RAG-to-write sea jurisdiction-safe, excluimos pasajes PURAMENTE de la jurisdicción opuesta (marcadores
# fuertes del otro país y NINGUNO del propio). 'shared' no filtra. No-fatal aunque pase algo: el gate
# valida la jurisdicción de cada @fact y el juez marca fuga; esto solo limpia el INSUMO del autor.
_MX_MARK = re.compile(r"\b(lisr|liva|resico|cfdi|banxico|infonavit|conasami|diario oficial|m[eé]xico|"
                      r"impuesto sobre la renta|valor agregado)\b", re.I)
_US_MARK = re.compile(r"\b(internal revenue|irs|form 1040|1099|w-2|w-4|social security administration|"
                      r"federal income tax|standard deduction)\b", re.I)


def _wrong_jurisdiction(text: str, country: str) -> bool:
    if country == "shared":
        return False
    if country == "us":
        return bool(_MX_MARK.search(text)) and not _US_MARK.search(text)
    if country == "mx":
        return bool(_US_MARK.search(text)) and not _MX_MARK.search(text)
    return False


def retrieve_for_topic(country: str, domain: str, topic_text: str,
                       top_k: int = 8, max_chars: int = 8000) -> str:
    """Top-k pasajes de evidencia más relevantes al tema (solape de términos pesado por IDF), con
    FIREWALL de jurisdicción sobre el insumo. '' si no hay evidencia (el autor cae a búsqueda web)."""
    chunks, chunk_tokensets, idf = _idf(country, domain)
    if not chunks:
        return ""
    q = set(_toks(topic_text))
    if not q:
        clean = [c for c in chunks if not _wrong_jurisdiction(c, country)]
        return "\n\n---\n\n".join(clean[:top_k])[:max_chars]
    scored = []
    for ch, ts in zip(chunks, chunk_tokensets):
        if _wrong_jurisdiction(ch, country):
            continue
        score = sum(idf.get(t, 0.0) for t in (q & ts))
        if score > 0:
            scored.append((score, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    out, total = [], 0
    for _, ch in scored[:top_k]:
        if total >= max_chars:
            break
        ch = ch[:max_chars - total]      # truncar (no saltar): un solo pasaje de ley puede exceder el tope
        out.append(ch); total += len(ch)
    return "\n\n---\n\n".join(out)


if __name__ == "__main__":
    import sys
    c, d, *q = sys.argv[1:]
    r = retrieve_for_topic(c, d, " ".join(q) or "concepto general", top_k=5)
    print(f"[{c}/{d}] {len(evidence_chunks(c, d))} pasajes · recuperados {len(r)} chars\n")
    print(r[:1500])
