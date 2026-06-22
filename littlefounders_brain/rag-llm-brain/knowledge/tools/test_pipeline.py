#!/usr/bin/env python3
"""
test_pipeline.py — pruebas deterministas de los invariantes del orquestador (sin red, sin LLM).

Cubre los bugs encontrados en la evaluación crítica 2026-06-21 para que NO reaparezcan en silencio:
  · el ciclo status: review → draft (la única válvula de revisión humana) debe round-trippear de verdad,
  · doc_status / _is_draft deben ser tolerantes a comillas (el frontmatter se serializa con json.dumps),
  · el presupuesto del autor (Qwen) no puede quedar sin tope al lanzar --run.

Uso:  python3 tools/test_pipeline.py        # corre todo, sale !=0 si algo falla
      python3 -m pytest tools/test_pipeline.py
"""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import build_dataset as bd  # noqa: E402

_PAYLOAD = {
    "title_es": "Prueba", "title_en": "Test", "volatility": "static",
    "age_bands": ["tier3", "tier4"], "depth_tier": "intro",
    "concept_ids": ["x.y"], "facts": [],
    "body_es": "## For future Claude\nCuerpo de prueba.\n", "body_en": "## For future Claude\nTest body.\n",
}


def test_assemble_writes_quoted_status():
    """assemble_doc serializa el status CON comillas (json.dumps) — la causa raíz del no-op."""
    doc = bd.assemble_doc("shared", "taxes", "what_is_a_tax", "prueba", "es", _PAYLOAD, ["src_x"], {})
    assert 'status: "review"' in doc, "el pipeline debe escribir status citado"
    assert bd.doc_status(doc) == "review"


def test_status_helpers_tolerate_quotes():
    for raw, want in ('status: "review"', "review"), ("status: draft", "draft"), ("status: 'published'", "published"):
        assert bd.doc_status(raw) == want, f"doc_status falló en {raw!r}"


def test_review_to_draft_roundtrip():
    """El bug crítico #1: demover review→draft debe cambiar bytes en disco Y ser detectable por _is_draft."""
    doc = bd.assemble_doc("shared", "taxes", "what_is_a_tax", "prueba", "es", _PAYLOAD, ["src_x"], {})
    demoted = bd.set_status(doc, "draft")
    assert demoted != doc, "set_status debe cambiar el contenido (el viejo .replace era un no-op)"
    assert bd.doc_status(demoted) == "draft"
    assert 'status: "review"' not in demoted


def test_is_draft_on_disk(tmp_path: Path = None):
    import tempfile
    d = Path(tempfile.mkdtemp())
    doc = bd.assemble_doc("shared", "taxes", "what_is_a_tax", "prueba", "es", _PAYLOAD, ["src_x"], {})
    p = d / "prueba.es.md"
    p.write_text(doc, encoding="utf-8")
    assert bd._is_draft(p) is False, "un doc en review NO es draft"
    p.write_text(bd.set_status(doc, "draft"), encoding="utf-8")
    assert bd._is_draft(p) is True, "tras demover, _is_draft debe detectarlo (--retry-drafts depende de esto)"


def test_author_budget_not_silently_unbounded():
    """Bug ALTO #5: el autor (Qwen, mayor gasto) no debe quedar sin tope. O hay budget_usd para su
    proveedor, O un tope de tokens, O el flag explícito de aceptación de gasto ilimitado."""
    author_provider = bd.provider_for(bd.MODELS["author"])
    capped = (author_provider in bd._BUDGET_USD) or ("_total" in bd._BUDGET_USD) or (bd._BUDGET_OUT > 0)
    assert capped, (
        f"el proveedor del autor ({author_provider}) no tiene tope de USD ni de tokens. "
        "Define wise_use.budget_usd['" + author_provider + "'] o budget_output_tokens, "
        "o lanza --run con --i-accept-unbounded-author.")


def test_effective_passes_expands_full_map():
    """Bug crítico #2: el cap 0 (todo el mapa) debe EXPANDIRSE en incrementos acotados que terminan
    cubriendo la celda más grande (cobertura total garantizada), no quedar como un único pase 0."""
    if not bd.CONCEPT_MAP:
        return
    ceil = bd._max_cell_topics()
    eff = bd._effective_passes([2, 5, 0])
    assert 0 not in eff, "el cap 0 debe expandirse, no quedar como 0"
    assert eff[0] == 2 and eff[1] == 5, "los caps finitos se preservan en orden"
    assert eff[-1] >= ceil, "el último incremento debe cubrir la celda más grande"
    assert eff == sorted(eff), "los caps deben ser monótonos crecientes"


def test_coverage_complete_false_when_partial():
    """STOP por cobertura: no debe declararse completa mientras falten temas del mapa."""
    st = bd.map_coverage()
    if st and st["covered"] < st["total"]:
        assert bd.coverage_complete() is False


def test_grounding_label():
    """A3: cada doc lleva una etiqueta de grounding HONESTA (no 'todo 100% real')."""
    p_concept = dict(_PAYLOAD, volatility="static", facts=[])
    assert bd.grounding_meta(p_concept)["grounding_tier"] == "conceptual"
    p_llm = dict(_PAYLOAD, volatility="medium", facts=[{"id": "zz.not.canonical.xyz", "value": "5%"}])
    g = bd.grounding_meta(p_llm)
    assert g["grounding_tier"] == "llm_reviewed" and g["canonical_facts"] == 0 and g["cited_facts"] == 1
    if bd.CANON_ENFORCED:
        fid = sorted(bd.CANON_ENFORCED)[0]
        p_anc = dict(_PAYLOAD, volatility="medium", facts=[{"id": fid, "value": "x"}])
        assert bd.grounding_meta(p_anc)["grounding_tier"] == "anchored"
    doc = bd.assemble_doc("shared", "taxes", "what_is_a_tax", "p", "es", p_concept, ["s"], {})
    assert "grounding_tier:" in doc and "canonical_facts:" in doc


def test_real_wrong_does_not_swallow_errors():
    """A4: _real_wrong NO debe suprimir errores reales (el bug era suprimir por actual_value en blanco)."""
    assert len(bd._real_wrong([{"claim": "tasa", "doc_value": "", "correct_value": "16%"}])) == 1, \
        "un error con correct_value no debe suprimirse aunque falte actual_value"
    assert len(bd._real_wrong([{"claim": "x", "doc_value": "10%", "correct_value": "16%"}])) == 1
    assert bd._real_wrong([{"claim": "x", "doc_value": "16%", "correct_value": "16%"}]) == [], \
        "confirmación dura (doc==correcto) sí se suprime"
    assert bd._real_wrong(["el dato es correcto"]) == [], "string de pura confirmación sin dígitos se suprime"


def _run_all():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  ✓ {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  ✗ {fn.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"  ✗ {fn.__name__}: ERROR {type(e).__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} pruebas pasaron.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_run_all())
