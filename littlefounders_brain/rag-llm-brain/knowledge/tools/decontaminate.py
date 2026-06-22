#!/usr/bin/env python3
"""
decontaminate.py — guarda anti eval-auto-confirmante (decontamination, estándar de la industria).

Riesgo: si un doc del corpus reproduce VERBATIM una pregunta del set de evaluación (golden_qa /
competency_questions), una evaluación por coincidencia de texto se vuelve circular ("el corpus contiene
literalmente la pregunta → la encuentra → pasa"). Esta herramienta detecta solapamiento de n-gramas
entre los ítems de eval y el corpus (técnica de Cosmopedia/GPT: n-grama + SequenceMatcher) y lo reporta.

NOTA: las RESPUESTAS canónicas (p.ej. '16%') SÍ deben estar en el corpus — eso es correcto, no
contaminación. Lo que NO debe pasar es que el corpus parrotee las PREGUNTAS de eval.

Uso:
  python3 tools/decontaminate.py             # reporte (dry-run)
  python3 tools/decontaminate.py --strict    # exit!=0 si hay contaminación (para CI)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
EVAL = KB / "eval"
sys.path.insert(0, str(TOOLS))
from kb_common import iter_corpus  # noqa: E402

_WORD = re.compile(r"[a-záéíóúñü0-9]+", re.I)
NGRAM = 13          # n-grama de palabras (estándar de decontaminación)
RATIO = 0.85        # umbral SequenceMatcher para preguntas cortas (< NGRAM palabras)


def _words(s: str) -> list[str]:
    return _WORD.findall((s or "").lower())


def _ngrams(words: list[str], n: int = NGRAM) -> set:
    return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)} if len(words) >= n else set()


def _eval_questions() -> list[str]:
    qs: list[str] = []
    gq = EVAL / "golden_qa.json"
    if gq.exists():
        qs += [it["q"] for it in json.loads(gq.read_text())["items"] if it.get("q")]
    cq = EVAL / "competency_questions.json"
    if cq.exists():
        for cell_qs in json.loads(cq.read_text())["cells"].values():
            qs += list(cell_qs)
    return qs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit!=0 si hay contaminación")
    args = ap.parse_args()

    questions = _eval_questions()
    q_grams = [(q, _ngrams(_words(q))) for q in questions]
    q_short = [(q, _words(q)) for q in questions if len(_words(q)) < NGRAM]
    hits = []
    for d in iter_corpus():
        body_words = _words(d.body)
        body_grams = _ngrams(body_words)
        body_text = " ".join(body_words)
        for q, qg in q_grams:
            if qg and (qg & body_grams):
                hits.append((d.rel, q, "ngram"))
        for q, qw in q_short:                       # preguntas cortas: ventana deslizante + ratio
            n = len(qw)
            for i in range(0, max(0, len(body_words) - n) + 1, max(1, n // 2)):
                window = " ".join(body_words[i:i + n])
                if SequenceMatcher(None, " ".join(qw), window).ratio() >= RATIO:
                    hits.append((d.rel, q, "fuzzy"))
                    break

    if hits:
        print(f"⚠️  CONTAMINACIÓN: {len(hits)} solapamiento(s) pregunta-de-eval ↔ corpus:")
        for rel, q, kind in hits[:40]:
            print(f"  [{kind}] {rel}  ⟵  «{q[:70]}»")
    else:
        print(f"✅ Sin contaminación: 0 preguntas de eval ({len(questions)} revisadas) aparecen verbatim en el corpus.")
    return 1 if (hits and args.strict) else 0


if __name__ == "__main__":
    raise SystemExit(main())
