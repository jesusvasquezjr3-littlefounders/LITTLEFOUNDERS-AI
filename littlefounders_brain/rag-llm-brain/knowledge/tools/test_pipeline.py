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
        # loop 3: 1 canónica + 2 NO canónicas → minoría verificada → partially_anchored (no "anchored")
        p_part = dict(_PAYLOAD, volatility="medium",
                      facts=[{"id": fid, "value": "x"}, {"id": "zz.a", "value": "1"}, {"id": "zz.b", "value": "2"}])
        gp = bd.grounding_meta(p_part)
        assert gp["grounding_tier"] == "partially_anchored", gp
        assert gp["anchored_ratio"] == round(1 / 3, 2), gp
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


def test_retriever_excludes_stale_walltime():
    """D: staleness por WALL-CLOCK. Un chunk con review_due en el pasado debe (a) aparecer sin filtro y
    (b) ser EXCLUIDO con exclude_stale. Lockea el fix del 'reloj congelado'."""
    import datetime as dt
    import sqlite3
    import tempfile
    from pathlib import Path
    tools = Path(__file__).resolve().parent
    sys.path.insert(0, str(tools))
    import build_index as bi
    from kb_common import Embedder, to_blob
    from retriever import Retriever

    d = Path(tempfile.mkdtemp())
    db = d / "k.db"
    con = sqlite3.connect(db)
    con.executescript(bi.SCHEMA)
    emb = Embedder("hash")
    today = dt.date.today()
    past = dt.date(today.year - 1, today.month, min(today.day, 28)).isoformat()
    future = dt.date(today.year + 1, today.month, min(today.day, 28)).isoformat()
    rows = []
    for cid, rd in (("fresh", future), ("stale", past)):
        v = emb.encode_one("ahorro dinero meta emergencia")
        rows.append((cid, "doc-" + cid, "mx", "MX-FED", "es", "personal_finance", "saving",
                     "[]", "tier3", "intro", "high", str(today), rd, "[]", "ahorro",
                     "ahorro dinero meta emergencia importante", to_blob(v)))
    con.executemany("INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    con.executemany("INSERT INTO chunks_fts (text, chunk_id) VALUES (?,?)", [(r[15], r[0]) for r in rows])
    con.executemany("INSERT INTO meta VALUES (?,?)", [("embed_backend", "hash"), ("embed_dim", "384")])
    con.commit()
    con.close()
    r = Retriever(db)
    ids_all = {h["chunk_id"] for h in r.query("ahorro dinero", country="mx", language="es", top_k=10)}
    ids_fresh = {h["chunk_id"] for h in r.query("ahorro dinero", country="mx", language="es",
                                                exclude_stale=True, top_k=10)}
    assert "stale" in ids_all, "el chunk vencido debe aparecer SIN exclude_stale"
    assert "stale" not in ids_fresh, "exclude_stale debe quitar el chunk vencido (wall-clock)"
    assert "fresh" in ids_fresh, "el chunk fresco debe permanecer"


def test_semdedup_clustering():
    """C1: la lógica de near-dup semántico (pares sobre umbral + union-find) agrupa correctamente,
    sin depender de fastembed (vectores a mano)."""
    import math
    import semdedup as sd

    def norm(v):
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]
    vecs = [norm([1.0, 0.0]), norm([0.99, 0.02]), norm([0.0, 1.0])]   # 0≈1 (dup), 2 ortogonal
    pairs = sd._pairs_over_threshold(vecs, 0.9)
    clusters = sd._clusters(len(vecs), pairs)
    assert clusters == [[0, 1]], f"esperaba un cluster {{0,1}}, got {clusters}"


def test_cache_validator_rejects_truncated_json():
    """v4 anti-poison: una respuesta JSON truncada-pero-no-vacía NO debe pasar el validador de caché, así
    no se cachea ni se re-sirve en cada resume (antes envenenaba el doc para siempre)."""
    from llm_qwen import _is_parseable_json
    assert _is_parseable_json('{"a": 1, "b": [1,2,3]}') is True
    assert _is_parseable_json('```json\n{"ok": true}\n```') is True
    assert _is_parseable_json('{"a": 1, "b": [1,2,') is False, "JSON truncado debe rechazarse"
    assert _is_parseable_json("") is False


def test_atomic_illustrative_excluded_from_unverifiable():
    """v4: los ejemplos ILUSTRATIVOS (que el contrato de autoría EXIGE) NO deben inflar la tasa de
    no-verificables ni su denominador. factscore = supported/(supported+contradicted)."""
    import atomic_verify as av
    verds = [
        {"claim": "a" * 50, "supported": True, "label": "supported"},
        {"claim": "b" * 50, "supported": None, "label": "illustrative"},
        {"claim": "c" * 50, "supported": None, "label": "unverifiable"},
        {"claim": "d" * 50, "supported": False, "label": "contradicted"},
    ]
    orig_v, orig_e = av.verify_llm, av.extract_claims
    av.verify_llm = lambda claims, evidence, model, client=None: verds
    av.extract_claims = lambda body: ([v["claim"] for v in verds], [])
    try:
        fs = av.score_text("dummy", "evidence", mode="llm", model="x")
    finally:
        av.verify_llm, av.extract_claims = orig_v, orig_e
    assert fs["illustrative"] == 1, fs
    assert fs["unverifiable"] == 1, f"la ilustrativa NO cuenta como no-verificable: {fs}"
    assert fs["pertinent"] == 3, f"denominador = claims - ilustrativas: {fs}"
    assert fs["checkable"] == 2 and fs["supported"] == 1 and fs["contradicted"] == 1, fs
    assert abs(fs["factscore"] - 0.5) < 1e-9, fs


def test_atomic_claims_preserve_fact_values():
    """v4.1: extract_claims debe sustituir los comentarios @fact con sus VALORES antes de limpiar
    comentarios. Sin esto, los valores canónicos (16,100 USD, 37%, etc.) viven dentro del comentario
    que se remueve → el verificador atómico chequea prosa SIN cifras → factscore siempre n/a.
    Con la sustitución, claims como 'la deducción estándar es 16,100 USD' SÍ son verificables."""
    import atomic_verify as av
    body = (
        "## Resumen\n"
        "El impuesto federal aplica sobre ingresos gravables. "
        "La deducción estándar para solteros es "
        '<!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=s volatility=low --> '
        "en 2026, y la tasa máxima marginal es "
        '<!-- @fact id=us.federal.top_rate value="37%" verified=2026-06-21 src=s volatility=low -->.'
    )
    claims, facts = av.extract_claims(body)
    joined = " ".join(claims)
    assert "16,100 USD" in joined, f"el valor @fact debe preservarse en los claims: {joined}"
    assert "37%" in joined, f"el valor @fact debe preservarse en los claims: {joined}"
    assert len(facts) == 2, f"debe extraer 2 facts: {facts}"


def test_cost_guard_blocks_underbudget_massive_run():
    """v4 GO-para-TERMINAR: la corrida MASIVA se rehúsa si los caps no cubren la proyección completa
    (cierra el 'STOP por budget disfrazado de cobertura'); --i-accept-underbudget la permite."""
    import build_dataset as bd
    bd._guard_cost_projection(True)         # override SIEMPRE pasa (no lanza)
    saved = bd._BUDGET_USD
    try:
        bd._BUDGET_USD = {"glm": 1.0, "qwen": 1.0}   # caps minúsculos → insuficientes vs ~$964 proyectado
        raised = False
        try:
            bd._guard_cost_projection(False)
        except SystemExit:
            raised = True
        assert raised, "caps insuficientes deben abortar la corrida masiva (sin override)"
    finally:
        bd._BUDGET_USD = saved


def test_cost_guard_blocks_scalar_total_budget():
    """R4 regresión (loop 2): un budget_usd ESCALAR (→{_total}) también debe bloquear la corrida masiva bajo
    presupuesto. Antes el guard sólo miraba caps por-proveedor → un tope agregado de $1 colaba (mientras
    budget_exceeded SÍ lo enforzaba) — un --run habría muerto a mitad."""
    import build_dataset as bd
    saved = bd._BUDGET_USD
    try:
        bd._BUDGET_USD = {"_total": 1.0}     # tope AGREGADO minúsculo vs ~$964 proyectado
        raised = False
        try:
            bd._guard_cost_projection(False)
        except SystemExit:
            raised = True
        assert raised, "un budget_usd agregado (_total) insuficiente debe abortar la corrida masiva"
    finally:
        bd._BUDGET_USD = saved


def test_retriever_normalizes_legacy_index():
    """R7 regresión (loop 2): un índice SIN el flag embed_normalized (construido antes del fix) debe
    normalizarse al vuelo en el retriever para que cosine (producto punto) sea correcto. Se prueba la ruta
    de back-compat con vectores crudos no-unitarios."""
    import sqlite3
    import tempfile
    from pathlib import Path
    tools = Path(__file__).resolve().parent
    sys.path.insert(0, str(tools))
    import build_index as bi
    from kb_common import to_blob
    from retriever import Retriever
    d = Path(tempfile.mkdtemp())
    db = d / "legacy.db"
    con = sqlite3.connect(db)
    con.executescript(bi.SCHEMA)
    # dos chunks: 'big' con vector de MAYOR norma pero MISMA dirección que 'small' → sin normalizar, big
    # gana por norma (sesgo); normalizado, ambos empatan en dirección y decide el léxico/orden estable.
    base = [1.0, 1.0] + [0.0] * 382
    big = [5.0, 5.0] + [0.0] * 382
    rows = []
    for cid, vec, txt in (("small", base, "ahorro emergencia meta"), ("big", big, "ahorro emergencia meta")):
        rows.append((cid, "doc-" + cid, "mx", "MX-FED", "es", "personal_finance", "saving",
                     "[]", "tier3", "intro", "low", "2026-06-21", None, "[]", "h", txt, to_blob(vec)))
    con.executemany("INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    con.executemany("INSERT INTO chunks_fts (text, chunk_id) VALUES (?,?)", [(r[15], r[0]) for r in rows])
    # meta SIN embed_normalized (índice legacy) → el retriever debe normalizar al vuelo
    con.executemany("INSERT INTO meta VALUES (?,?)", [("embed_backend", "hash"), ("embed_dim", "384")])
    con.commit(); con.close()
    r = Retriever(db)
    assert r._stored_normalized is False, "índice sin flag debe tratarse como NO normalizado"
    hits = r.query("ahorro emergencia", country="mx", language="es", top_k=2)
    assert len(hits) == 2, "ambos chunks deben recuperarse tras el pre-filtro"


def test_embedder_fastembed_path_normalizes():
    """v4: cosine() es un producto punto que asume vectores unitarios → el branch fastembed debe
    L2-normalizar (se prueba la utilidad _l2 sin descargar el modelo de 1GB)."""
    import math as _m
    from kb_common import Embedder
    v = Embedder._l2([3.0, 4.0])
    assert abs(_m.sqrt(sum(x * x for x in v)) - 1.0) < 1e-9, "debe quedar norma 1"
    assert abs(v[0] - 0.6) < 1e-9 and abs(v[1] - 0.8) < 1e-9


def test_d1_unanchored_numeral_in_worked_example():
    """D1: un numeral oficial (umbral $ con miles, tasa %) en un ejemplo trabajado que NO es @fact
    debe reportarse (advisory). El riesgo H2: un tramo del año equivocado ($11,600 = 2024 en un doc
    2026) que ni el gate (solo @fact) ni el verificador NLI (illustrative) detectan."""
    import gate_kb

    class _FakeDoc:
        def __init__(self, body):
            self.body = body
            self.errors, self.warns, self.nunanchored, self.nunanchored_hard = [], [], 0, 0
        def err(self, m): self.errors.append(m); self.nunanchored += 1
        def warn(self, m): self.warns.append(m); self.nunanchored += 1

    body = (
        "**Worked example**\n"
        "Carlos reports $52,000 in gross income. Standard deduction: "
        '<!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=s volatility=low -->.\n'
        "Taxable income = $52,000 - $16,100 = $35,900\n"
        "- First $11,600: 10% rate -> $1,160\n"   # $11,600 + 10% = NO anclados (riesgo H2)
        "Total = $1,160 + $2,916 = **$4,076**\n"  # resultados derivados (=, ->) → NO reportar
    )
    saved = gate_kb.STRICT_NUMERALS
    gate_kb.STRICT_NUMERALS = False
    try:
        d = _FakeDoc(body)
        gate_kb.Doc._check_unanchored_numerals(d)
    finally:
        gate_kb.STRICT_NUMERALS = saved
    flagged = " ".join(d.warns)
    assert "$11,600" in flagged, f"debe reportar el tramo no-anclado $11,600: {d.warns}"
    assert "10%" in flagged, f"debe reportar la tasa no-anclada 10%: {d.warns}"
    assert "$4,076" not in flagged, f"el resultado derivado NO se reporta: {d.warns}"
    assert "$52,000" not in flagged, f"el ingreso hipotetico del actor NO se reporta: {d.warns}"
    assert "$16,100" not in flagged, f"el valor @fact anclado NO se reporta: {d.warns}"


def test_d1_strict_numerals_is_hard():
    """D1: con --strict-numerals, los numerales no-anclados son HARD-FAIL (no advisory)."""
    import gate_kb

    class _FakeDoc:
        def __init__(self, body):
            self.body = body
            self.errors, self.warns, self.nunanchored, self.nunanchored_hard = [], [], 0, 0
        def err(self, m): self.errors.append(m); self.nunanchored += 1
        def warn(self, m): self.warns.append(m); self.nunanchored += 1

    body = "**Ejemplo trabajado**\n- Primeros $11,600: tasa del 10% -> $1,160\n"
    saved = gate_kb.STRICT_NUMERALS
    gate_kb.STRICT_NUMERALS = True
    try:
        d = _FakeDoc(body)
        gate_kb.Doc._check_unanchored_numerals(d)
    finally:
        gate_kb.STRICT_NUMERALS = saved
    assert any("$11,600" in e for e in d.errors), f"strict debe ser HARD: {d.errors}"
    assert not d.warns, "strict no debe producir advisories"


def test_d2_usage_delta_per_role():
    """D2: el gasto GLM (juez+verificador, ~88% del costo) debe atribuirse por-doc. Antes solo se
    logueaba el autor (Qwen) en build_log.jsonl → cost_projection calibraba el cuello de botella a ciegas."""
    import build_dataset as bd
    # delta normal (cliente existia antes): u1 - u0
    u0 = {"calls": 5, "prompt_tokens": 1000, "completion_tokens": 500}
    u1 = {"calls": 8, "prompt_tokens": 2000, "completion_tokens": 900}
    d = bd._usage_delta(u0, u1)
    assert d["calls"] == 3 and d["prompt_tokens"] == 1000 and d["completion_tokens"] == 400, d
    # cliente creado durante este doc (u0=None): u1 ya es el gasto de este doc
    d0 = bd._usage_delta(None, {"calls": 2, "prompt_tokens": 300, "completion_tokens": 100})
    assert d0 and d0["prompt_tokens"] == 300, d0
    # sin gasto medible
    assert bd._usage_delta(None, None) is None
    assert bd._usage_delta(u0, u0) is None or all(v == 0 for v in bd._usage_delta(u0, u0).values())


def test_grounding_meta_honest_with_fact_src():
    """Loop 2: grounding_meta con fact_src sólo cuenta facts que sobreviven replace_facts (tienen
    source). Sin esto, el frontmatter dice 'anchored, 4 facts' pero el body tiene 1 @fact (3 dropeados
    por replace_facts al no tener source) → grounding_tier DISHONESTO."""
    import build_dataset as bd
    if not bd.CANON_ENFORCED:
        return
    fid = sorted(bd.CANON_ENFORCED)[0]
    payload = dict(_PAYLOAD, volatility="medium",
                   facts=[{"id": fid, "value": "x"}, {"id": "zz.no_src", "value": "1"}])
    # sin fact_src: cuenta ambos (comportamiento legacy)
    g_legacy = bd.grounding_meta(payload)
    assert g_legacy["cited_facts"] == 2, g_legacy
    # con fact_src: sólo el que tiene source mapeado
    g_honest = bd.grounding_meta(payload, fact_src={fid: "src_a"})
    assert g_honest["cited_facts"] == 1, f"fact_src debe excluir facts sin source: {g_honest}"
    assert g_honest["canonical_facts"] == 1, g_honest


def test_replace_facts_leaves_unresolved_visible():
    """Loop 2: replace_facts NO debe dropear silenciosamente [[fact:id]] sin source → dejarlo visible
    para que el gate lo flagea como HARD-FAIL. Antes retornaba '' → placeholder vacío silencioso."""
    import build_dataset as bd
    body = "HSA limit: [[fact:us.hsa.limit_self]] en 2026."
    # fact NO en la lista de facts → queda visible (no vacío)
    out = bd.replace_facts(body, [], {})
    assert "[[fact:us.hsa.limit_self]]" in out, f"unresolved debe quedar visible, got: {out}"
    # fact EN la lista pero sin source → queda visible
    out2 = bd.replace_facts(body, [{"id": "us.hsa.limit_self", "value": "4,400 USD"}], {})
    assert "[[fact:us.hsa.limit_self]]" in out2, f"sin source debe quedar visible, got: {out2}"
    # fact con source → se reemplaza por @fact
    out3 = bd.replace_facts(body, [{"id": "us.hsa.limit_self", "value": "4,400 USD"}],
                            {"us.hsa.limit_self": "src_x"})
    assert "@fact id=us.hsa.limit_self" in out3 and "4,400 USD" in out3, out3
    assert "[[fact:" not in out3, f"no debe quedar placeholder resuelto: {out3}"


def test_d1_scan_high_confidence_only():
    """D1 enforcement: scan_unanchored_numerals marca cifras OFICIALES (tasa/tramo) no-ancladas en ejemplos,
    pero NO montos ilustrativos sueltos (sin cue de tasa) → bajo falso-positivo para el ruteo a draft, así no
    se draftean docs no-fiscales con cifras de ejemplo legítimas."""
    from gate_kb import scan_unanchored_numerals
    # bracket NO-anclado en línea con cue de tasa → SÍ se marca (el caso H2 real)
    body_bad = "## Ejemplo trabajado\n- Primeros $12,400: tasa del 10% → $1,240\n"
    flagged = scan_unanchored_numerals(body_bad, high_conf_only=True)
    assert any("12,400" in n for n in flagged), flagged
    # monto ilustrativo sin cue de tasa → NO se marca (evita draftear un doc de presupuesto por una cifra de ejemplo)
    body_ok = "## Ejemplo ilustrativo\n- Ana ahorra $1,500 cada mes para su meta\n"
    assert scan_unanchored_numerals(body_ok, high_conf_only=True) == [], scan_unanchored_numerals(body_ok)


def test_judge_lean_mode_skips_search_and_evidence():
    """L1+L2 (optimización de costo): el juez en modo LEAN (use_search=False) NO activa búsqueda web NI
    inyecta evidencia (ahorra ~$0.01+tokens/llamada); en modo FACTCHECK sí. Captura los args, sin red."""
    import build_dataset as bd

    class _FakeClient:
        provider = "glm"
        def json(self, msg, **kw):
            self.enable_search = kw.get("enable_search")
            self.has_evidence = "EVIDENCIA CURADA" in msg[1]["content"]
            return {"scores": {}, "verdict": "publish"}

    saved = bd._JUDGE_CLIENT
    fake = _FakeClient()
    bd._JUDGE_CLIENT = fake
    try:
        bd.q_judge(None, "us", "texto del doc", evidence="EVIDENCIA REAL DE PRUEBA", use_search=False)
        assert fake.enable_search is False, "LEAN no debe activar búsqueda web"
        assert fake.has_evidence is False, "LEAN no debe inyectar evidencia"
        bd.q_judge(None, "us", "texto del doc", evidence="EVIDENCIA REAL DE PRUEBA", use_search=True)
        assert fake.enable_search is True, "FACTCHECK debe activar búsqueda (grounding_search=true)"
        assert fake.has_evidence is True, "FACTCHECK debe inyectar evidencia"
    finally:
        bd._JUDGE_CLIENT = saved


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
