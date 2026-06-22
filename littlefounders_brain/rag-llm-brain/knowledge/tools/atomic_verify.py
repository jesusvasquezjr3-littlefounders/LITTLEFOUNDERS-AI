#!/usr/bin/env python3
"""
atomic_verify.py — Verificación ATÓMICA de afirmaciones (estilo FActScore) contra EVIDENCIA real.

Es la pieza ANTI-LAVADO de la arquitectura v4: el juez-LLM único saturaba (daba 5/5 a docs con
cifras rancias). En vez de "¿está bien el doc?" (una pregunta que un LLM responde con complacencia),
descomponemos el doc en afirmaciones ATÓMICAS y preguntamos, por cada una, "¿la respalda ESTA
evidencia?". El score = soportadas / verificables. Un doc cuya prosa NO esté en la evidencia
(p.ej. autor escribiendo de memoria) obtiene score bajo aunque el juez lo apruebe.

Dos ejes, combinables:
  · DECOMPOSE  heuristic (sin red, $0) | llm (mejor descomposición; usa un proveedor)
  · VERIFY     embed (similitud coseno contra evidencia, $0) | llm (NLI/entailment real, proveedor indep.)

El modo $0 (heuristic+embed) es una SEÑAL barata (proxy de similitud, no entailment estricto) para
escanear el corpus y priorizar. El modo `llm` (entailment con búsqueda) es el veredicto autoritativo.

Uso:
  python3 tools/atomic_verify.py us/personal_finance            # escaneo $0 (heuristic+embed)
  python3 tools/atomic_verify.py us/taxes --verify llm          # NLI real (proveedor independiente)
  python3 tools/atomic_verify.py mx/taxes/iva --json            # salida JSON por-doc
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kb_common import KB, Embedder, cosine, parse_frontmatter  # noqa: E402
from facts_table import load_facts, values_match  # noqa: E402

CANON = {k: v for k, v in load_facts(verified_only=True).items() if v.get("enforce", True)}

# ── descomposición ────────────────────────────────────────────────────────────
_FACT_RE = re.compile(r"<!--\s*@fact\s+(.*?)-->", re.S)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_HEADING_RE = re.compile(r"^#{1,6}\s+.*$", re.M)
_SCAFFOLD_RE = re.compile(r"\b(future\s+claude|futuro\s+claude)\b", re.I)
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])")
_DIGIT_RE = re.compile(r"\d")
_DEF_CUE = re.compile(r"\b(es un|es una|son |se refiere|consiste|significa|is a |is an |are |refers to|means )\b", re.I)


def _parse_fact_attrs(attrs: str) -> dict:
    return {m.group(1): m.group(2).strip('"')
            for m in re.finditer(r"(\w+)=(\"[^\"]*\"|\S+)", attrs)}


def extract_claims(body: str) -> tuple[list[str], list[dict]]:
    """Devuelve (claims_prosa, fact_claims). Las cifras @fact se tratan aparte (las canónicas las
    valida el gate; las off-table son afirmaciones a verificar). La prosa se parte en oraciones y se
    filtra a las VERIFICABLES (con dígito, entidad propia, o cue de definición)."""
    facts = []
    for m in _FACT_RE.finditer(body):
        f = _parse_fact_attrs(m.group(1))
        if f.get("id") and "value" in f:
            facts.append({"id": f["id"], "value": f["value"],
                          "canonical": f["id"] in CANON})
    # prosa: sin comentarios, sin encabezados, sin secciones de andamiaje
    prose = _HEADING_RE.sub(" ", _COMMENT_RE.sub(" ", body))
    claims = []
    for para in prose.split("\n"):
        para = para.strip()
        if not para or _SCAFFOLD_RE.search(para):
            continue
        for s in _SENT_SPLIT.split(para):
            s = re.sub(r"\s+", " ", s).strip(" -*•").strip()
            if len(s) < 40:
                continue
            if _DIGIT_RE.search(s) or _DEF_CUE.search(s):   # oración "verificable"
                claims.append(s)
    return claims, facts


def chunk_evidence(text: str, min_len: int = 60) -> list[str]:
    parts = re.split(r"\n\s*\n", text)
    out = []
    for p in parts:
        p = re.sub(r"\s+", " ", _COMMENT_RE.sub(" ", p)).strip()
        if len(p) >= min_len:
            out.append(p)
    return out


def load_evidence(country: str, domain: str, max_chars: int = 60000) -> str:
    d = KB / "evidence" / country / domain
    if not d.exists():
        return ""
    chunks = [p.read_text(encoding="utf-8") for p in sorted(d.glob("*.md"))]
    return ("\n\n".join(chunks))[:max_chars]


# ── verificación embed ($0) ────────────────────────────────────────────────────
def verify_embed(claims: list[str], ev_chunks: list[str], emb: Embedder, thresh: float):
    if not ev_chunks:
        return [{"claim": c, "supported": None, "score": 0.0} for c in claims]
    ev_vecs = emb.encode(ev_chunks)
    out = []
    for c, cv in zip(claims, emb.encode(claims)):
        best = max((cosine(cv, ev) for ev in ev_vecs), default=0.0)
        out.append({"claim": c, "supported": bool(best >= thresh), "score": round(best, 3)})
    return out


# ── verificación llm (NLI real) ────────────────────────────────────────────────
def verify_llm(claims: list[str], evidence: str, model: str, client=None):
    """NLI por lotes en 3 VÍAS — distingue 'no está en esta evidencia' de 'es FALSO':
      · supported    = la evidencia la implica directamente.
      · contradicted = la evidencia dice OTRA cosa (FALLA REAL de fidelidad).
      · unverifiable = ni la implica ni la contradice (claim plausible fuera del alcance de esta
                       evidencia → señal de que falta RAG-to-write / verificación web, NO un error).
    Los EJEMPLOS ILUSTRATIVOS ('Ana gana $5,000…') se etiquetan 'illustrative' y NO cuentan.
    factscore = supported / (supported + contradicted): fidelidad entre los claims VERIFICABLES.
    `client` (opcional): cliente Qwen YA construido (p.ej. el del verificador del build) para que su gasto
    se contabilice en el presupuesto; si es None se crea uno efímero (modo CLI, sin tracking de budget)."""
    if client is None:
        from llm_qwen import Qwen, provider_for  # lazy
        client = Qwen(provider=provider_for(model))
    cli = client
    numbered = "\n".join(f"{i+1}. {c}" for i, c in enumerate(claims))
    msg = [{"role": "system", "content":
            "Eres un verificador de hechos NLI riguroso pero JUSTO. Etiqueta cada afirmación SOLO contra la "
            "EVIDENCIA dada (sin conocimiento externo) en una de: 'supported' (la evidencia la implica), "
            "'contradicted' (la evidencia afirma algo DISTINTO — error de fidelidad), 'unverifiable' (la "
            "evidencia no la cubre, ni a favor ni en contra), 'illustrative' (es un ejemplo hipotético con "
            "un personaje/escenario inventado, no un hecho a verificar). Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"EVIDENCIA:\n{evidence[:12000]}\n\n===\nAFIRMACIONES:\n{numbered}\n\n"
            'Devuelve {"verdicts":[{"n":1,"label":"supported|contradicted|unverifiable|illustrative","why":"..."}]}'}]
    res = cli.json(msg, model=model, temperature=0.0, max_tokens=4000)
    by_n = {v.get("n"): v for v in res.get("verdicts", [])}
    out = []
    for i, c in enumerate(claims, 1):
        v = by_n.get(i, {})
        lab = v.get("label", "unverifiable")
        # supported True / contradicted False / (unverifiable|illustrative) None (no cuenta al factscore)
        sup = True if lab == "supported" else (False if lab == "contradicted" else None)
        out.append({"claim": c, "supported": sup, "label": lab, "why": v.get("why", "")})
    return out


# ── score inline (para integrar al loop de build_dataset, sin IO) ───────────────
def score_text(body: str, evidence: str, mode: str = "llm", model: str = "glm-4.6",
               thresh: float = 0.5, emb=None, client=None) -> dict:
    """FACTSCORE de un cuerpo ya en memoria contra evidencia ya recuperada. Lo llama build_topic (v4)
    como etapa de gate: contradicted>0 o factscore<umbral ⇒ revise. unverifiable alto = el autor se
    despegó de la evidencia (RAG-to-write flojo).

    Distingue 'illustrative' (ejemplos trabajados, que el contrato de autoría EXIGE) de 'unverifiable':
    los illustrative NO cuentan en `unverifiable` NI en el denominador de la tasa de no-verificables —
    de otro modo un doc que cumple el mandato de tener ejemplos se penalizaría por tenerlos.
    `pertinent` = claims que NO son ilustrativos (base honesta para unv_rate). `client` opcional: cliente
    Qwen ya construido (verificador del build) para contabilizar su gasto en el presupuesto."""
    claims, facts = extract_claims(body)
    if not claims:
        return {"claims": 0, "pertinent": 0, "checkable": 0, "supported": 0, "contradicted": 0,
                "unverifiable": 0, "illustrative": 0, "factscore": None, "contradicted_claims": []}
    if mode == "llm":
        verdicts = verify_llm(claims, evidence, model, client=client) if evidence else \
                   [{"claim": c, "supported": None, "label": "unverifiable"} for c in claims]
    else:
        verdicts = verify_embed(claims, chunk_evidence(evidence), emb or Embedder(backend="fastembed"), thresh)
    checked = [v for v in verdicts if v["supported"] is not None]                  # supported + contradicted
    supported = sum(1 for v in checked if v["supported"])
    illustrative = sum(1 for v in verdicts if v.get("label") == "illustrative")
    # 'unverifiable' = sin verdicto Y no ilustrativo (los ilustrativos no son hechos a verificar).
    unverifiable = sum(1 for v in verdicts if v["supported"] is None and v.get("label") != "illustrative")
    score = (supported / len(checked)) if checked else None
    return {
        "claims": len(claims), "pertinent": len(claims) - illustrative,
        "checkable": len(checked), "supported": supported,
        "contradicted": len(checked) - supported,
        "unverifiable": unverifiable, "illustrative": illustrative,
        "factscore": score,
        "contradicted_claims": [v["claim"][:140] for v in checked if not v["supported"]][:5],
    }


# ── score por doc ──────────────────────────────────────────────────────────────
def factscore(path: Path, emb: Embedder, mode: str, model: str, thresh: float) -> dict:
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    if fm is None:
        return {"doc": str(path), "error": "no frontmatter"}
    country, domain = fm.get("country", ""), fm.get("domain", "")
    evidence = load_evidence(country, domain)
    ev_chunks = chunk_evidence(evidence)
    claims, facts = extract_claims(body)
    offtable = [f for f in facts if not f["canonical"]]

    if mode == "llm":
        verdicts = verify_llm(claims, evidence, model) if (claims and evidence) else \
                   [{"claim": c, "supported": None} for c in claims]
    else:
        verdicts = verify_embed(claims, ev_chunks, emb, thresh)

    checked = [v for v in verdicts if v["supported"] is not None]   # supported + contradicted
    supported = sum(1 for v in checked if v["supported"])
    contradicted = len(checked) - supported
    unverifiable = sum(1 for v in verdicts if v["supported"] is None)
    score = (supported / len(checked)) if checked else None
    return {
        "doc": str(path.relative_to(KB)),
        "country": country, "domain": domain,
        "evidence_chars": len(evidence), "evidence_chunks": len(ev_chunks),
        "claims": len(claims), "checkable": len(checked),
        "supported": supported, "contradicted": contradicted, "unverifiable": unverifiable,
        "factscore": round(score, 3) if score is not None else None,
        "facts_total": len(facts), "facts_canonical": len(facts) - len(offtable),
        "facts_offtable": len(offtable),
        "contradicted_examples": [v["claim"][:160] for v in checked if not v["supported"]][:4],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subtree", help="doc o subárbol (ej. us/taxes, mx/taxes/iva/iva-basics.es.md)")
    ap.add_argument("--verify", choices=["embed", "llm"], default="embed")
    ap.add_argument("--model", default="glm-4.6", help="modelo para --verify llm (proveedor independiente)")
    ap.add_argument("--thresh", type=float, default=0.50, help="umbral de coseno para --verify embed")
    ap.add_argument("--lang", default="es", choices=["es", "en"], help="idioma a evaluar")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = KB / args.subtree
    if root.is_file():
        files = [root]
    else:
        files = sorted(p for p in root.rglob(f"*.{args.lang}.md")
                       if not p.name.startswith("_") and p.name != "README.md")
    if not files:
        print("⚠️  No se encontraron docs.")
        return 1

    emb = Embedder(backend="fastembed") if args.verify == "embed" else None
    rows = [factscore(p, emb, args.verify, args.model, args.thresh) for p in files]
    rows = [r for r in rows if "error" not in r]

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    print(f"\nVerificación atómica · modo={args.verify} · idioma={args.lang} · docs={len(rows)}\n")
    scored = [r for r in rows if r["factscore"] is not None]
    print(f"{'doc':<58} {'fscore':>7} {'sup/chk':>8} {'ev':>5} {'off':>4}")
    print("-" * 88)
    for r in sorted(rows, key=lambda r: (r["factscore"] is None, r["factscore"] or 0)):
        fs = f"{r['factscore']:.2f}" if r["factscore"] is not None else "  n/a"
        ev = "—" if r["evidence_chars"] == 0 else str(r["evidence_chunks"])
        print(f"{r['doc']:<58} {fs:>7} {r['supported']:>3}/{r['checkable']:<4} {ev:>5} {r['facts_offtable']:>4}")
    if scored:
        avg = sum(r["factscore"] for r in scored) / len(scored)
        no_ev = sum(1 for r in rows if r["evidence_chars"] == 0)
        print("-" * 88)
        print(f"FACTSCORE promedio: {avg:.2f}  ·  docs con evidencia: {len(rows)-no_ev}/{len(rows)}  ·  "
              f"docs sin evidencia (no verificables): {no_ev}")
        print("Nota: modo embed = PROXY de similitud (no entailment estricto). Usa --verify llm para el veredicto.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
