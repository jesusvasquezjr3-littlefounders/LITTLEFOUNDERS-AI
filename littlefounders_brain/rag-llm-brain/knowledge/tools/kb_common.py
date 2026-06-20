#!/usr/bin/env python3
"""
kb_common.py — utilidades compartidas por build_index / retriever / eval.

· parse_frontmatter      → (fm: dict, body: str)
· iter_corpus            → recorre shared/mx/us y entrega Doc
· chunk_doc              → corta por encabezados + secciones <!-- age_band: -->
· Embedder               → vectorizador. Default DETERMINISTA y sin dependencias
                           (hashing de palabras + trigramas → vector L2-normalizado).
                           Opcional: Embedder(backend="fastembed") para semántica real.

El firewall anti-fuga NO depende del embedding: se aplica como pre-filtro de metadata
(country+language) en el retriever, antes de cualquier similitud. El embedder solo ordena
dentro del conjunto ya filtrado. Por eso el hashing-embedder basta para el piloto.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent
CORPUS_DIRS = ("shared", "mx", "us")
EMBED_DIM = 384


def _anchor_date() -> str:
    try:
        bp = yaml.safe_load((KB / "_meta" / "build_policy.yaml").read_text())
        return bp["content_conventions"]["date_anchor"]
    except Exception:
        return "2026-06-20"


ANCHOR_DATE = _anchor_date()    # fecha "as of" única (= build_policy date_anchor)

_HEADING_RE = re.compile(r"^(#{2,3})\s+(.*)$", re.M)
_AGEBAND_RE = re.compile(r"<!--\s*age_band:\s*([a-z0-9, ]+?)\s*-->")
_FACT_RE = re.compile(r"<!--\s*@fact\b.*?-->", re.S)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_WORD_RE = re.compile(r"[a-záéíóúñü0-9]+", re.I)


def parse_frontmatter(text: str):
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    return yaml.safe_load(text[3:end]), text[end + 4:]


@dataclass
class Doc:
    path: Path
    rel: str
    fm: dict
    body: str


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    country: str
    jurisdiction: str
    language: str
    domain: str
    subdomain: str
    concept_ids: list
    age_band: str
    depth_tier: str
    volatility: str
    last_verified_date: str
    review_due: str | None
    source_ids: list
    heading_path: str
    text: str
    embedding: list = field(default_factory=list)


def iter_corpus(root: Path = KB):
    for d in CORPUS_DIRS:
        base = root / d
        if not base.exists():
            continue
        for p in sorted(base.rglob("*.md")):
            if p.name.startswith("_") or p.name == "README.md":
                continue
            text = p.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(text)
            if fm is None:
                continue
            yield Doc(path=p, rel=str(p.relative_to(root)), fm=fm, body=body)


def _clean(text: str) -> str:
    text = _COMMENT_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def chunk_doc(doc: Doc) -> list[Chunk]:
    """Un chunk por sección hoja (encabezado ## / ###). El age_band del chunk = la marca
    <!-- age_band: --> más cercana hacia atrás, o age_bands[0] del doc si no hay marca."""
    fm = doc.fm
    body = doc.body
    # mapa posición -> tiers activos (por marcas age_band)
    marks = [(m.start(), [t.strip() for t in m.group(1).split(",") if t.strip()])
             for m in _AGEBAND_RE.finditer(body)]

    def tier_at(pos: int) -> str:
        active = fm.get("age_bands", ["tier5"])[:1]
        for mpos, tiers in marks:
            if mpos <= pos and tiers:
                active = tiers
        return active[0] if active else "tier5"

    headings = list(_HEADING_RE.finditer(body))
    chunks: list[Chunk] = []
    if not headings:
        segments = [("", 0, len(body))]
    else:
        segments = []
        # preámbulo antes del primer encabezado
        if headings[0].start() > 0:
            segments.append(("(intro)", 0, headings[0].start()))
        for i, h in enumerate(headings):
            start = h.end()
            end = headings[i + 1].start() if i + 1 < len(headings) else len(body)
            title = _COMMENT_RE.sub("", h.group(2)).strip()
            segments.append((title, start, end))

    idx = 0
    for title, start, end in segments:
        raw = body[start:end]
        text = _clean(raw)
        if len(text) < 12:
            continue
        tier = tier_at(start)
        heading_path = title or "(root)"
        chunks.append(Chunk(
            chunk_id=f"{fm['doc_id']}::{fm['language']}::{idx}",
            doc_id=fm["doc_id"],
            country=fm["country"],
            jurisdiction=fm["jurisdiction"],
            language=fm["language"],
            domain=fm["domain"],
            subdomain=fm["subdomain"],
            concept_ids=fm.get("concept_ids", []),
            age_band=tier,
            depth_tier=fm["depth_tier"],
            volatility=fm["volatility"],
            last_verified_date=str(fm["last_verified_date"]),
            review_due=(str(fm["review_due"]) if fm.get("review_due") else None),
            source_ids=fm.get("sources", []),
            heading_path=heading_path,
            text=text,
        ))
        idx += 1
    return chunks


def embed_input(chunk: Chunk) -> str:
    """Texto que se embebe: metadata prependida (sesga la recuperación hacia las facetas)."""
    return (f"country:{chunk.country} domain:{chunk.domain} subdomain:{chunk.subdomain} "
            f"tier:{chunk.age_band} {chunk.heading_path}. {chunk.text}")


class Embedder:
    def __init__(self, backend: str = "hash", dim: int = EMBED_DIM):
        self.backend = backend
        self.dim = dim
        self._fe = None
        if backend == "fastembed":
            from fastembed import TextEmbedding  # type: ignore
            self._fe = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self.dim = 384

    @staticmethod
    def _features(text: str):
        text = text.lower()
        toks = _WORD_RE.findall(text)
        feats = list(toks)
        for w in toks:
            for i in range(len(w) - 2):
                feats.append(w[i:i + 3])      # trigramas de carácter
        return feats

    def _hash_vec(self, text: str) -> list[float]:
        v = [0.0] * self.dim
        for f in self._features(text):
            h = int(hashlib.md5(f.encode()).hexdigest(), 16)
            sign = 1.0 if (h >> 1) & 1 else -1.0
            v[h % self.dim] += sign
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def encode(self, texts: list[str]) -> list[list[float]]:
        if self.backend == "fastembed":
            return [list(map(float, e)) for e in self._fe.embed(texts)]  # type: ignore
        return [self._hash_vec(t) for t in texts]

    def encode_one(self, text: str) -> list[float]:
        return self.encode([text])[0]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))   # ambos L2-normalizados (fastembed bge también)


def to_blob(vec: list[float]) -> bytes:
    import struct
    return struct.pack(f"{len(vec)}f", *vec)


def from_blob(blob: bytes) -> list[float]:
    import struct
    return list(struct.unpack(f"{len(blob)//4}f", blob))
