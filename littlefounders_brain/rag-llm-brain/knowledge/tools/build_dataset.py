#!/usr/bin/env python3
"""
build_dataset.py — PIPELINE AUTÓNOMO del cerebro de conocimiento.

Construye el dataset markdown SOLO (sin consumir tokens de Claude): usa Qwen (Model Studio) para
planear, redactar, juzgar y verificar; web grounding vía enable_search; gate determinista para los
invariantes; y un crítico de completitud que FUERZA profundidad hasta cumplir build_policy.yaml.

Flujo por documento:
  PLANNER (Qwen)  → lista exhaustiva de temas por (country, domain, subdomain)
  AUTHOR  (Qwen+search) → cuerpo ES/EN con @fact + fuentes (web actual)
  ENSAMBLE (código) → frontmatter determinista + registro de fuentes + sentinels @fact
  GATE (código) → si falla, revise loop (Qwen)
  JUDGE+VERIFY (Qwen+search) → rúbrica + fact-check adversario; si < barra, revise loop
  CHECKPOINT (reanudable)
Crítico de completitud por subdominio: loop-until-dry (N rondas sin temas nuevos).
STOP global (conjunción): cobertura completa ∧ tamaño >= meta ∧ eval verde.

Uso:
  python3 tools/build_dataset.py --status
  python3 tools/build_dataset.py --only us/taxes/payroll_tax --max-docs 2     # slice de prueba
  python3 tools/build_dataset.py --plan-only us/taxes/payroll_tax
  python3 tools/build_dataset.py --run                                        # corrida completa
  nohup python3 tools/build_dataset.py --run > build.log 2>&1 &               # autónomo en background
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent
META = KB / "_meta"
TOOLS = KB / "tools"
sys.path.insert(0, str(TOOLS))
from llm_qwen import Qwen, provider_for  # noqa: E402
from facts_table import canonical_block, load_facts, values_match  # noqa: E402

TAXO = yaml.safe_load((META / "taxonomy.yaml").read_text())
POLICY = yaml.safe_load((META / "build_policy.yaml").read_text())
SOURCES_FILE = META / "sources.yaml"
DATE = POLICY["content_conventions"]["date_anchor"]
# Checkpoint = existencia de los pares .es/.md en disco (re-ejecutar salta lo ya hecho).
MODELS = POLICY["models"]
WISE = POLICY.get("wise_use", {})
CANON_ALL = load_facts(verified_only=True)     # tabla canónica (verdad de base) para inyectar al autor
STATE_FILE = KB / POLICY["run"].get("state_file", "index/build_state.json")
_STATE_LOCK = threading.Lock()
_BUDGET_OUT = int(WISE.get("budget_output_tokens", 0) or 0)


def _parse_budget_usd(raw):
    """Tope de gasto en USD POR PROVEEDOR. Acepta dict {deepseek:8, glm:9, qwen:null} o un número
    (tratado como tope agregado '_total'). null/ausente = sin tope para ese proveedor."""
    if isinstance(raw, dict):
        return {k: float(v) for k, v in raw.items() if v not in (None, "null", "")}
    if raw:
        return {"_total": float(raw)}
    return {}


_BUDGET_USD = _parse_budget_usd(WISE.get("budget_usd"))
_ALERT_USD = float(WISE.get("alert_usd_remaining", 0) or 0)
PRICING = POLICY.get("pricing_usd_per_mtok", {})
TARGETS = POLICY["targets"]
STOP_ON = TARGETS.get("stop_on", "coverage")             # coverage | size
SIZE_TARGET = float(TARGETS.get("total_size_mb", 10))
SIZE_SAFETY = float(TARGETS.get("size_safety_cap_mb", 0) or 0)
_AUTHOR_CLIENT = None     # se fija en main(); usado para presupuesto/alerta y tope de tokens del autor
_alerted: set = set()     # proveedores ya alertados (para no repetir la alerta)
RETRY_DRAFTS = False     # --retry-drafts: en el resume, regenerar los docs en estado draft


def _is_draft(es_path: Path) -> bool:
    try:
        return "status: draft" in es_path.read_text(encoding="utf-8")[:500]
    except Exception:
        return False


def write_atomic(path: Path, text: str):
    """Escribe a .tmp y renombra: un corte a mitad NO deja un doc corrupto."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def _price(model: str) -> dict:
    return PRICING.get(model, {"in": 0.0, "out": 0.0})


def _role_clients():
    # (cliente, modelo) por rol; los clientes se crean lazy (_judge_client/_planner_client/main)
    return ((_AUTHOR_CLIENT, MODELS["author"]), (_JUDGE_CLIENT, MODELS["judge"]),
            (_PLANNER_CLIENT, MODELS["planner"]))


def estimated_cost_by_provider() -> dict:
    """Gasto estimado en USD POR PROVEEDOR (tokens×precio). Clave = provider del cliente."""
    out: dict = {}
    for client, model in _role_clients():
        if client is None:
            continue
        pr = _price(model)
        u = client.usage
        c = (u.get("prompt_tokens", 0) / 1e6 * pr.get("in", 0.0)
             + u.get("completion_tokens", 0) / 1e6 * pr.get("out", 0.0))
        out[client.provider] = out.get(client.provider, 0.0) + c
    return out


def estimated_cost_usd() -> float:
    return sum(estimated_cost_by_provider().values())


def budget_exceeded(qw=None) -> bool:
    """True si el autor superó su tope de tokens, O si ALGÚN proveedor superó su tope en USD
    (la corrida muere cuando cualquiera de las 3 cuentas se agota)."""
    if _BUDGET_OUT > 0 and _AUTHOR_CLIENT and _AUTHOR_CLIENT.usage.get("completion_tokens", 0) >= _BUDGET_OUT:
        return True
    if not _BUDGET_USD:
        return False
    costs = estimated_cost_by_provider()
    if "_total" in _BUDGET_USD and sum(costs.values()) >= _BUDGET_USD["_total"]:
        return True
    return any(costs.get(prov, 0.0) >= cap for prov, cap in _BUDGET_USD.items() if prov != "_total")


def size_stop() -> bool:
    """En modo 'size' frena al alcanzar total_size_mb; en 'coverage' solo el tope de seguridad (si lo hay)."""
    if STOP_ON == "size":
        return corpus_size_mb() >= SIZE_TARGET
    return SIZE_SAFETY > 0 and corpus_size_mb() >= SIZE_SAFETY


def budget_alert():
    """Imprime una ALERTA (una vez por proveedor) cuando su saldo estimado baja del umbral → recargar."""
    if not _BUDGET_USD or _ALERT_USD <= 0:
        return
    costs = estimated_cost_by_provider()
    for prov, cap in _BUDGET_USD.items():
        if prov == "_total" or prov in _alerted:
            continue
        remaining = cap - costs.get(prov, 0.0)
        if remaining < _ALERT_USD:
            _alerted.add(prov)
            print(f"\n⚠️  ALERTA SALDO {prov.upper()}: restante estimado ${remaining:.2f} < ${_ALERT_USD:.2f}. "
                  f"Recarga esa API si vas a continuar.\n", flush=True)


def save_state(doc_id: str, status: str):
    """Manifiesto de progreso (index/build_state.json) para resume/observabilidad. Atómico + lock."""
    with _STATE_LOCK:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        state = {}
        if STATE_FILE.exists():
            try:
                state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            except Exception:
                state = {}
        state[doc_id] = {"status": status, "ts": DATE}
        tmp = STATE_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=0), encoding="utf-8")
        tmp.replace(STATE_FILE)

JURIS = {"mx": "MX-FED", "us": "US-FED", "shared": "NONE"}
CURRENCY = {"mx": "MXN", "us": "USD", "shared": "null"}
CADENCE_MONTHS = {"static": None, "low": 24, "medium": 12, "high": 3}
PRIMARY_HINTS = (".gov", ".gob.mx", "gob.mx", "diputados.gob.mx", "banxico.org.mx",
                 "inegi.org.mx", "imss.gob.mx", "imcp.org.mx")


# ─────────────────────────── helpers ───────────────────────────
def add_months(date_str: str, months: int) -> str:
    y, m, d = map(int, date_str.split("-"))
    m0 = m - 1 + months
    y += m0 // 12
    m = m0 % 12 + 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def review_due(volatility: str) -> str:
    months = CADENCE_MONTHS.get(volatility)
    return "null" if months is None else add_months(DATE, months)


def tier_of_url(url: str) -> str:
    u = url.lower()
    if any(h in u for h in PRIMARY_HINTS):
        return "primary"
    if any(k in u for k in ("irs.gov", "sec.gov", "sba.gov", "federalreserve", "bls.gov",
                            "dol.gov", "ssa.gov", "fdic.gov", "ncua.gov")):
        return "primary"
    if any(k in u for k in ("investopedia", "nerdwallet", "taxfoundation", "kiplinger",
                            "elcontribuyente", "elfinanciero", "eleconomista")):
        return "reputable"
    return "tertiary"


class SourceRegistry:
    def __init__(self):
        doc = yaml.safe_load(SOURCES_FILE.read_text()) or {}
        self.ids = set((doc.get("sources") or {}).keys())
        self.by_url = {}
        for sid, s in (doc.get("sources") or {}).items():
            if s.get("url"):
                self.by_url[s["url"].rstrip("/")] = sid
        self.lock = threading.Lock()      # sources.yaml es compartido entre workers

    def register(self, url, title="", publisher="", jurisdiction="NONE") -> str:
        key = (url or "").rstrip("/")
        if not key:
            return ""
        with self.lock:
            if key in self.by_url:
                return self.by_url[key]
            h = hashlib.md5(key.encode()).hexdigest()[:8]
            sid = f"src_gen_{h}"
            tier = tier_of_url(url)
            # Truncar el TEXTO antes de json.dumps (no después): truncar la salida JSON podía
            # cortar una secuencia \uXXXX a la mitad → YAML inválido → el gate crasheaba.
            t = (title or url)[:160]
            pub = (publisher or "")[:120]
            block = (f"\n  {sid}:\n    title: {json.dumps(t, ensure_ascii=False)}\n"
                     f"    publisher: {json.dumps(pub, ensure_ascii=False)}\n"
                     f"    url: {json.dumps(url, ensure_ascii=False)}\n    tier: {tier}\n"
                     f"    jurisdiction: {jurisdiction or 'NONE'}\n    accessed: {DATE}\n")
            with open(SOURCES_FILE, "a", encoding="utf-8") as f:
                f.write(block)
            self.ids.add(sid)
            self.by_url[key] = sid
            return sid


# ─────────────────────── frontmatter + body ───────────────────────
def assemble_doc(country, domain, subdomain, slug, lang, payload, src_ids, fact_src):
    doc_id = f"{country}-{domain}-{subdomain}-{slug}"
    vol = payload["volatility"]
    fm = {
        "doc_id": doc_id,
        "title_es": payload["title_es"], "title_en": payload["title_en"],
        "language": lang,
        "translation_of": "null" if lang == "es" else doc_id,
        "country": country, "jurisdiction": JURIS[country],
        "domain": domain, "subdomain": subdomain,
        "concept_ids": payload.get("concept_ids", []),
        "age_bands": payload["age_bands"], "depth_tier": payload["depth_tier"],
        "volatility": vol, "last_verified_date": DATE, "verified_by": "qwen-pipeline",
        "review_due": review_due(vol), "sources": sorted(set(src_ids)),
        "status": "review", "currency": CURRENCY[country], "schema_version": "kb-1.0",
    }
    lines = ["---"]
    for k, v in fm.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        elif v == "null":
            lines.append(f"{k}: null")
        else:
            # citar SIEMPRE los strings → robusto ante ':', ' #', y otros caracteres YAML-especiales
            lines.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
    lines.append("---")
    body = payload["body_es"] if lang == "es" else payload["body_en"]
    body = replace_facts(body, payload.get("facts", []), fact_src)
    return "\n".join(lines) + "\n" + body.strip() + "\n"


def replace_facts(body, facts, fact_src):
    fmap = {f["id"]: f for f in facts}

    def repl(m):
        fid = m.group(1)
        f = fmap.get(fid)
        if not f:
            return ""
        sid = fact_src.get(fid, "")
        if not sid:
            return ""
        # sanear el valor: una sola línea, sin '-->' (cerraría el comentario) ni comillas internas.
        # Se CITA con comillas para que valores multi-token (rangos, "3,500,000 MXN") round-trippeen
        # por el parser del gate sin truncarse en el primer espacio.
        val = str(f["value"]).replace("\n", " ").replace("-->", "→").replace('"', "'").strip()
        return (f'<!-- @fact id={fid} value="{val}" verified={DATE} '
                f'src={sid} volatility={f.get("volatility","medium")} -->')
    return re.sub(r"\[\[fact:([a-zA-Z0-9_.]+)\]\]", repl, body)


# ─────────────────────────── Qwen roles ───────────────────────────
def q_planner(qw, country, domain, subdomain):
    band_rules = json.dumps(TAXO["age_bands"], ensure_ascii=False)
    msg = [{"role": "system", "content":
            "Eres un arquitecto curricular experto en finanzas/impuestos/negocios MX y US. Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"País={country} dominio={domain} subdominio={subdomain}. "
            + ("REGLA: 'shared' es el bucket NEUTRO: propón SOLO conceptos universales (qué es, cómo funciona, "
               "principios, matemática), SIN instrumentos, leyes, cifras ni nombres de un país (nada de IVA, SAT, "
               "IRS, RESICO, salario mínimo MX/US, etc. — eso va en mx/ o us/). "
               if country == "shared" else "")
            + f"{POLICY['completeness']['critic_prompt_hint']} "
            f"Propón una lista de documentos (mínimo {POLICY['depth']['min_docs_per_subdomain']}) "
            f"para cubrir bien este subdominio, cada uno con un ángulo distinto y ENSEÑABLE "
            f"(básico, mecánica, casos borde, trámites paso a paso, errores comunes, comparativa, cambios 2026). "
            f"Tiers de edad disponibles (techo Piaget): {band_rules}. "
            'Devuelve {"topics":[{"slug":"kebab-case","title_es":"...","title_en":"...","angle":"...",'
            '"age_bands":["tier3","tier4","tier5"],"depth_tier":"intro|intermediate|advanced",'
            '"volatility":"static|low|medium|high","concept_id":"dotted.id"}]}'}]
    return _planner_client().json(msg, model=MODELS["planner"], temperature=0.5).get("topics", [])


_EVIDENCE_CACHE = {}


def load_evidence(country, domain, max_chars=12000):
    """Lee el caché de evidencia curada (NotebookLM) para (país,dominio). Vacío si no existe."""
    key = (country, domain)
    if key not in _EVIDENCE_CACHE:
        d = KB / "evidence" / country / domain
        chunks = [p.read_text(encoding="utf-8") for p in sorted(d.glob("*.md"))] if d.exists() else []
        _EVIDENCE_CACHE[key] = ("\n\n---\n\n".join(chunks))[:max_chars]
    return _EVIDENCE_CACHE[key]


def q_author(qw, country, domain, subdomain, topic, gate_errors="", evidence=""):
    fix = f"\nCORRIGE estos errores del gate anterior: {gate_errors}" if gate_errors else ""
    forb = TAXO["age_bands"]
    # CIFRAS CANÓNICAS (verdad de base): el autor DEBE copiar estos id+valor, no inventar.
    canon = canonical_block(CANON_ALL, JURIS[country])
    canon_block = (
        "CIFRAS CANÓNICAS OFICIALES (verdad de base verificada). Si mencionas alguna de estas cifras, "
        "usa EXACTAMENTE su id en [[fact:id]] y su valor EXACTO — NO inventes ni 'recuerdes' otro número:\n"
        f"{canon}\n\n===\n\n"
    ) if canon else ""
    # Uso sabio: si hay evidencia curada, NO buscar (ahorra tokens); buscar solo si falta.
    use_search = bool(MODELS["grounding_search"]) and (
        WISE.get("author_search_when_evidence", False) or not evidence)
    ev_block = (
        "EVIDENCIA CURADA (extraída por NotebookLM de FUENTES PRIMARIAS oficiales). Fundamenta tu "
        "redacción y tus @fact PRIORITARIAMENTE en esta evidencia y cita esas URLs como fuentes. "
        f"Si un punto no está aquí, búscalo en la web:\n\n{evidence}\n\n===\n\n"
    ) if evidence else ""
    msg = [{"role": "system", "content":
            "Eres autor experto de contenido educativo bilingüe (ES canónico, EN fiel) de finanzas/impuestos, "
            "edades 5-18+, fundamentado en FUENTES PRIMARIAS (.gov/leyes) y actual a 2026-06-20. Devuelve SOLO JSON."},
           {"role": "user", "content":
            canon_block + ev_block +
            f"País={country} ({JURIS[country]}) dominio={domain} subdominio={subdomain}.\n"
            f"Documento: slug={topic['slug']} | {topic['title_es']} / {topic['title_en']} | ángulo: {topic.get('angle','')}\n"
            f"age_bands={topic['age_bands']} depth_tier={topic['depth_tier']} volatility={topic['volatility']}\n\n"
            "REGLAS DURAS:\n"
            f"- Cuerpo con secciones por tier, cada encabezado con comentario, p.ej. "
            "'## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->'. Cubre TODOS los age_bands dados.\n"
            f"- Empieza con '## For future Claude' (2-3 frases: qué, jurisdicción, fecha 2026-06-20, diferenciador MX vs US).\n"
            f"- VOCABULARIO PROHIBIDO en secciones tier1/tier2: {forb['tier1']['forbidden']+forb['tier2']['forbidden']} "
            "(ni sus equivalentes en inglés). Explica concreto, no abstracto.\n"
            "- Incluye AL MENOS un mini-ejemplo NUMÉRICO con cifras REDONDEADAS, presentado como "
            "ILUSTRACIÓN ('por ejemplo, si ganas $5,000...'). NO le pongas @fact a cálculos derivados "
            "ni a montos exactos de tablas (p.ej. retención exacta): esos son ilustrativos, no datos oficiales.\n"
            f"- Marca con [[fact:<id.punteado>]] SOLO las cifras OFICIALES y verificables (tasas, límites, "
            "umbrales, versiones, fechas oficiales) y declára cada una en 'facts' con su fuente PRIMARIA. "
            f"Apunta a >= {POLICY['depth']['min_cited_facts_per_doc']} hechos oficiales si el tema los tiene.\n"
            "- Si una cifra está en CIFRAS CANÓNICAS, usa su id EXACTO y su valor EXACTO (un gate determinista "
            "los compara: cualquier diferencia = RECHAZO). Evita citar cifras MUY volátiles (tasas de banco "
            "central) que no estén en esa lista; si lo haces, hazlo SIEMPRE con su fecha de vigencia.\n"
            "- NO mezcles jurisdicciones: nada de instrumentos del otro país como si aplicaran aquí.\n"
            f"- Usa fuentes REALES y ACTUALES (busca en la web); incluye >= 1 fuente PRIMARIA (.gov/ley) para hechos volátiles.{fix}\n\n"
            'Devuelve {"title_es":"...","title_en":"...","concept_ids":["..."],"age_bands":[...],'
            '"depth_tier":"...","volatility":"...",'
            '"sources":[{"url":"https://...","title":"...","publisher":"...","jurisdiction":"MX-FED|US-FED|NONE"}],'
            '"facts":[{"id":"dotted.id","value":"16%","volatility":"medium","source_index":0}],'
            '"body_es":"## For future Claude\\n...","body_en":"## For future Claude\\n..."}'}]
    return qw.json(msg, model=MODELS["author"], enable_search=use_search,
                   temperature=0.4, max_tokens=8000, timeout=240)


def q_judge(qw, country, es_text, evidence=""):
    """Juez = GLM (z.ai) con BÚSQUEDA WEB (proveedor independiente del autor). Recibe la evidencia
    curada para verificar por NLI. Las cifras CANÓNICAS ya las valida el gate → el juez NO las re-checa
    (uso sabio: no se gastan tokens preguntando lo que facts.yaml ya garantiza)."""
    ev = (f"EVIDENCIA CURADA (fuentes primarias) para contrastar:\n{evidence[:4000]}\n\n===\n\n"
          if evidence else "")
    canon_note = (
        "NOTA: las cifras CANÓNICAS (tasas/umbrales/límites oficiales en la tabla del sistema) ya las valida "
        "un gate determinista contra una tabla oficial verificada; NO las marques como erróneas. Concéntrate "
        "en (a) cifras NO canónicas, (b) coherencia y pedagogía, (c) CERO fuga de jurisdicción.\n")
    msg = [{"role": "system", "content":
            "Eres revisor crítico (no sello de goma) de contenido educativo financiero. Verifica hechos vs fuentes "
            "primarias (BUSCA EN LA WEB cuando dudes). Devuelve SOLO JSON, sin texto extra."},
           {"role": "user", "content":
            ev + f"País={country}. {canon_note}\nEvalúa este documento (1-5 por dimensión) y verifica sus "
            f"cifras/reglas NO canónicas:\n\n{es_text[:6000]}\n\n"
            "REGLA CRÍTICA de wrong_facts: incluye ÚNICAMENTE cifras/afirmaciones del documento que sean "
            "REALMENTE INCORRECTAS (el valor del documento DIFIERE del valor real verificado). Si una cifra "
            "es correcta o coincide con la fuente, NO la incluyas. Si no encuentras errores, devuelve []. "
            "Cada entrada: objeto {\"claim\":\"...\",\"doc_value\":\"...\",\"correct_value\":\"...\"}.\n"
            'Devuelve {"scores":{"factual_accuracy":n,"pedagogical_scaffolding":n,"country_correctness":n,'
            '"translation_fidelity":n,"engagement":n},"hard_fails":[...],"wrong_facts":[...],"verdict":"publish|revise"}'}]
    return _judge_client().json(msg, model=MODELS["judge"], enable_search=MODELS["grounding_search"],
                                temperature=0.2, timeout=240)


_JUDGE_CLIENT = None
_PLANNER_CLIENT = None


def _judge_client():
    """Cliente del juez. Proveedor independiente del autor (deduce glm/deepseek/qwen del modelo)."""
    global _JUDGE_CLIENT
    if _JUDGE_CLIENT is None:
        _JUDGE_CLIENT = Qwen(provider=provider_for(MODELS["judge"]))
    return _JUDGE_CLIENT


def _planner_client():
    """Cliente del planner/crítico — proveedor independiente (p.ej. DeepSeek V4) → 3er pool de cuota."""
    global _PLANNER_CLIENT
    if _PLANNER_CLIENT is None:
        _PLANNER_CLIENT = Qwen(provider=provider_for(MODELS["planner"]))
    return _PLANNER_CLIENT


def q_critic(qw, country, domain, subdomain, existing_slugs):
    msg = [{"role": "system", "content": "Eres crítico de completitud. Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"País={country} dominio={domain} subdominio={subdomain}. Ya existen estos documentos: {existing_slugs}.\n"
            f"{POLICY['completeness']['critic_prompt_hint']}\n"
            'Lista SOLO los temas que FALTAN (no repitas los existentes). '
            'Devuelve {"missing":[{"slug":"...","title_es":"...","title_en":"...","angle":"...",'
            '"age_bands":[...],"depth_tier":"...","volatility":"...","concept_id":"..."}]}'}]
    return _planner_client().json(msg, model=MODELS["planner"], temperature=0.6).get("missing", [])


# ─────────────────────────── gate ───────────────────────────
def run_gate(subtree):
    r = subprocess.run([sys.executable, str(TOOLS / "gate_kb.py"), subtree],
                       capture_output=True, text=True, cwd=str(KB.parent))
    errs = [ln.strip() for ln in r.stdout.splitlines() if "HARD:" in ln]
    return r.returncode == 0, errs


def _register_payload_sources(reg, payload, country):
    src_ids, fact_src, url_to_id = [], {}, {}
    srcs = payload.get("sources", [])
    for s in srcs:
        sid = reg.register(s.get("url", ""), s.get("title", ""), s.get("publisher", ""),
                           s.get("jurisdiction", JURIS[country]))
        src_ids.append(sid)
        url_to_id[s.get("url", "")] = sid
    for f in payload.get("facts", []):
        idx = f.get("source_index", 0)
        if 0 <= idx < len(srcs):
            fact_src[f["id"]] = url_to_id.get(srcs[idx].get("url", ""), src_ids[0] if src_ids else "")
    return src_ids, fact_src


def _log(entry):
    (KB / "index").mkdir(exist_ok=True)
    with open(KB / "index" / "build_log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


_CONFIRM_RE = re.compile(
    r"(es correct|son correct|coincide|correctamente|dato correcto|cifra correcta|"
    r"valor correcto|s[ií] es correct|is correct|are correct|matches|accurate)", re.I)


def _real_wrong(wrong):
    """Filtra falsos positivos del juez (Qwen-Flash a veces lista en wrong_facts hechos que en
    realidad CONFIRMA). Cuenta solo los que difieren (dict actual!=correct) o que NO contienen una
    frase de confirmación (string)."""
    out = []
    for w in (wrong or []):
        if isinstance(w, dict):
            actual = str(w.get("actual_value", w.get("doc_value", ""))).strip().lstrip("$").replace(",", "")
            correct = str(w.get("expected_value", w.get("correct_value", ""))).strip().lstrip("$").replace(",", "")
            if actual and correct and actual == correct:
                continue  # coinciden → no es error
            txt = " ".join(str(v) for v in w.values())
            if _CONFIRM_RE.search(txt) and not actual:
                continue
        elif isinstance(w, str):
            if _CONFIRM_RE.search(w):
                continue  # el juez dice que ESTÁ correcto → no es error
        out.append(w)
    return out


# ─────────────────────── build one document ───────────────────────
def build_topic(qw, reg, country, domain, subdomain, topic):
    """author → gate → judge, todo dentro de UN solo revise-loop. El juez (con búsqueda web)
    devuelve hechos erróneos que se RE-alimentan al autor. Si tras max rondas sigue con
    problemas, el doc se conserva como `draft` (no se borra) para revisión humana."""
    subdir = KB / country / domain / subdomain
    subdir.mkdir(parents=True, exist_ok=True)
    slug = topic["slug"]
    es_path = subdir / f"{slug}.es.md"
    en_path = subdir / f"{slug}.en.md"
    if es_path.exists() and not (RETRY_DRAFTS and _is_draft(es_path)):
        return "exists"   # resume: ya hecho (salvo que sea draft y se pida --retry-drafts)

    bar = POLICY["quality_bar"]
    feedback, last_issue = "", ""
    evidence = load_evidence(country, domain) if POLICY["run"]["grounding_backend"] in ("hybrid", "notebooklm") else ""
    u0 = dict(qw.usage)
    for attempt in range(bar["max_revise_rounds"] + 1):
        payload = q_author(qw, country, domain, subdomain, topic, feedback, evidence=evidence)
        # Guarda contra respuestas JSON incompletas (p.ej. truncadas) → revise en vez de crashear el subdominio
        missing = [k for k in ("title_es", "title_en", "body_es", "body_en", "age_bands", "depth_tier", "volatility")
                   if not payload.get(k)]
        if missing:
            feedback = (f"Tu JSON quedó INCOMPLETO (faltó: {missing}). Devuelve el JSON COMPLETO con TODOS los "
                        "campos; sé más conciso si es necesario para que quepa, pero no omitas body_en.")
            last_issue = f"incomplete:{missing}"
            continue
        # Normalizar depth_tier a la enum del esquema (el autor a veces usa 'profundo'/'expert'/etc.)
        payload["depth_tier"] = {
            "intro": "intro", "básico": "intro", "basico": "intro", "beginner": "intro", "basic": "intro",
            "intermediate": "intermediate", "intermedio": "intermediate", "medio": "intermediate",
            "advanced": "advanced", "avanzado": "advanced", "profundo": "advanced", "experto": "advanced",
            "expert": "advanced", "deep": "advanced",
        }.get(str(payload.get("depth_tier", "")).strip().lower(), "intermediate")
        src_ids, fact_src = _register_payload_sources(reg, payload, country)
        if not src_ids:
            feedback = "No devolviste fuentes. Incluye fuentes REALES (>=1 primaria .gov) y regenera."
            last_issue = "no_sources"
            continue
        es_doc = assemble_doc(country, domain, subdomain, slug, "es", payload, src_ids, fact_src)
        en_doc = assemble_doc(country, domain, subdomain, slug, "en", payload, src_ids, fact_src)
        write_atomic(es_path, es_doc)
        write_atomic(en_path, en_doc)

        ok, errs = run_gate(f"{country}/{domain}/{subdomain}")
        if not ok:
            feedback = "Corrige estos errores del GATE y regenera: " + " | ".join(errs)[:600]
            last_issue = "gate:" + (errs[0] if errs else "")[:80]
            continue

        try:
            judged = q_judge(qw, country, es_doc, evidence=evidence)
        except Exception as e:
            last_issue = f"judge_error:{e}"
            break  # gate ya pasó; aceptar pese a fallo del juez (se marca abajo)
        sc = judged.get("scores", {})
        wrong = _real_wrong(judged.get("wrong_facts"))
        hard = judged.get("hard_fails") or []
        below = [f"{k}={sc.get(k)}<{bar[k]}" for k in
                 ("factual_accuracy", "country_correctness", "pedagogical_scaffolding",
                  "translation_fidelity", "engagement") if k in sc and sc[k] < bar[k]]
        if wrong or hard or judged.get("verdict") == "revise" or below:
            feedback = ("Revisa y REGENERA. Verifica cada cifra contra fuente PRIMARIA ACTUAL (2026). "
                        f"HECHOS ERRÓNEOS: {wrong}. FALLAS DURAS: {hard}. DIMENSIONES BAJAS: {below}.")
            last_issue = f"judge wrong={wrong[:2]} below={below}"
            continue
        spent = {k: qw.usage[k] - u0[k] for k in u0}
        did = f"{country}-{domain}-{subdomain}-{slug}"
        _log({"doc_id": did, "status": "review", "scores": sc, "spent": spent})
        save_state(did, "review")
        return f"built_ok(scores={sc})"

    # rondas agotadas con problemas → conservar como draft + registrar
    if es_path.exists():
        for p in (es_path, en_path):
            write_atomic(p, p.read_text(encoding="utf-8").replace("status: review", "status: draft", 1))
    did = f"{country}-{domain}-{subdomain}-{slug}"
    _log({"doc_id": did, "status": "draft", "issue": last_issue})
    save_state(did, "draft")
    return f"needs_review({last_issue[:140]})"


# ─────────────────────── build one subdomain ───────────────────────
def build_subdomain(qw, reg, country, domain, subdomain, max_docs=None):
    """max_docs = TOPE TOTAL de docs en la celda (existentes + nuevos), no solo nuevos. Así la
    orquestación breadth-first puede subir el cap por pasada y cada celda crece de forma incremental."""
    if size_stop() or budget_exceeded():
        return {}
    subdir = KB / country / domain / subdomain
    # 'existing' excluye drafts si --retry-drafts (para que se regeneren)
    existing = sorted(p.name[:-6] for p in subdir.glob("*.es.md")
                      if not (RETRY_DRAFTS and _is_draft(p))) if subdir.exists() else []
    have_count = len(existing)
    if max_docs and have_count >= max_docs:
        return {}     # esta celda ya alcanzó el cap de esta pasada → no replanear (ahorra tokens)
    topics = q_planner(qw, country, domain, subdomain)
    results = {}
    dry = 0
    rounds = 0
    while rounds < POLICY["completeness"]["max_expansion_rounds"]:
        new = [t for t in topics if t["slug"] not in existing and t["slug"] not in results]
        if not new:
            dry += 1
            if dry >= POLICY["completeness"]["dry_rounds_to_stop"]:
                break
        else:
            dry = 0
        for t in new:
            produced = sum(1 for r in results.values()
                           if r.startswith(("built", "exists", "needs_review")))
            if max_docs and have_count + produced >= max_docs:
                return results
            if size_stop() or budget_exceeded():
                return results
            results[t["slug"]] = build_topic(qw, reg, country, domain, subdomain, t)
            print(f"  [{country}/{domain}/{subdomain}] {t['slug']}: {results[t['slug']]}", flush=True)
        rounds += 1
        cap = max_docs or POLICY["depth"]["min_docs_per_subdomain"]
        have = existing + list(results.keys())
        if len(have) < cap and dry < POLICY["completeness"]["dry_rounds_to_stop"]:
            topics = q_critic(qw, country, domain, subdomain, have)
        else:
            break
    return results


# ─────────────────────────── status / stop ───────────────────────────
def corpus_size_mb():
    total = sum(p.stat().st_size for c in ("shared", "mx", "us")
                for p in (KB / c).rglob("*.md")) if any((KB / c).exists() for c in ("shared", "mx", "us")) else 0
    return total / 1e6


def status():
    target = POLICY["targets"]["total_size_mb"]
    print(f"Tamaño corpus: {corpus_size_mb():.2f} MB / meta {target} MB")
    review = draft = total = 0
    for c in ("shared", "mx", "us"):
        base = KB / c
        if not base.exists():
            continue
        for p in base.rglob("*.es.md"):
            total += 1
            head = p.read_text(encoding="utf-8")[:500]
            if "status: draft" in head:
                draft += 1
            elif "status: review" in head:
                review += 1
    print(f"Docs (.es): {total}  |  review: {review}  draft(revisión humana): {draft}")
    jobs = all_jobs()
    covered = sum(1 for (c, d, s) in jobs
                  if (KB / c / d / s).exists() and any((KB / c / d / s).glob("*.es.md")))
    print(f"Amplitud (breadth): {covered}/{len(jobs)} celdas país×dominio×subdominio con ≥1 doc")
    for c in ("shared", "mx", "us"):
        base = KB / c
        if not base.exists():
            continue
        for dom in sorted(p.name for p in base.iterdir() if p.is_dir()):
            for sub in sorted(p.name for p in (base / dom).iterdir() if p.is_dir()):
                n = len(list((base / dom / sub).glob("*.es.md")))
                flag = "✓" if n >= POLICY["depth"]["min_docs_per_subdomain"] else " "
                print(f"  {flag} {c}/{dom}/{sub}: {n} docs")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--plan-only", metavar="C/D/S")
    ap.add_argument("--only", metavar="C/D/S", help="construir un subdominio")
    ap.add_argument("--max-docs", type=int)
    ap.add_argument("--run", action="store_true", help="corrida completa (todos los subdominios)")
    ap.add_argument("--workers", type=int, default=4, help="subdominios en paralelo (concurrencia)")
    ap.add_argument("--retry-drafts", action="store_true",
                    help="en el resume, regenerar los docs en estado draft (en vez de saltarlos)")
    args = ap.parse_args()

    global RETRY_DRAFTS, _AUTHOR_CLIENT
    RETRY_DRAFTS = args.retry_drafts

    if args.status:
        status(); return 0

    qw = Qwen()
    _AUTHOR_CLIENT = qw       # para presupuesto/alerta en $ y tope de tokens del autor
    reg = SourceRegistry()

    if args.plan_only:
        c, d, s = args.plan_only.split("/")
        topics = q_planner(qw, c, d, s)
        print(json.dumps(topics, ensure_ascii=False, indent=2))
        print(f"\n{len(topics)} temas planeados. usage={qw.usage}")
        return 0

    if args.only:
        c, d, s = args.only.split("/")
        res = build_subdomain(qw, reg, c, d, s, max_docs=args.max_docs)
        print(f"\nResultado {args.only}: {res}\nusage={qw.usage}")
        return 0

    if args.run:
        run_all(qw, reg, args.workers, args.max_docs)
        return 0

    ap.print_help()
    return 0


def all_jobs():
    # Construir por país y luego INTERCALAR (round-robin) para que MX/US no se mueran de hambre
    # mientras 'shared' acapara todos los workers. Prioridad: mx, us (contenido jurisdiccional), shared.
    order = ["mx", "us", "shared"]
    per = {c: [] for c in order}
    for c in order:
        if c not in POLICY["coverage"]["countries"]:
            continue
        domains = POLICY["coverage"]["shared_domains"] if c == "shared" else list(TAXO["domains"].keys())
        for d in domains:
            if d not in TAXO["domains"]:
                continue
            for s in TAXO["domains"][d]["subdomains"]:
                per[c].append((c, d, s))
    jobs, i = [], 0
    while any(i < len(per[c]) for c in order):
        for c in order:
            if i < len(per[c]):
                jobs.append(per[c][i])
        i += 1
    return jobs


def run_all(qw, reg, workers, max_docs):
    """Orquestación BREADTH-FIRST: varias pasadas con cap creciente de docs/subdominio. La pasada 1
    cubre TODO el espectro a un baseline; las siguientes profundizan SOLO tras cubrir todo. El stop de
    tamaño/presupuesto puede cortar en cualquier punto → primero ancho, luego hondo."""
    jobs = all_jobs()
    br = POLICY.get("breadth", {})
    if max_docs:                                   # --max-docs fuerza una sola pasada con ese cap
        passes = [max_docs]
    elif br.get("enabled"):
        passes = br.get("passes") or [br.get("baseline_docs_per_subdomain", 2)]
    else:
        passes = [POLICY["depth"]["min_docs_per_subdomain"]]
    stopdesc = "COBERTURA total de la taxonomía" if STOP_ON != "size" else f"tamaño {SIZE_TARGET} MB"
    print(f"Cobertura: {len(jobs)} subdominios · STOP por {stopdesc} · workers={workers} · "
          f"BREADTH-FIRST pasadas(cap)={passes}", flush=True)

    def work(job, cap):
        if size_stop() or budget_exceeded():
            return
        budget_alert()
        c, d, s = job
        try:
            build_subdomain(qw, reg, c, d, s, max_docs=cap)
        except Exception as e:                       # un subdominio que falle NO tumba la corrida
            print(f"  !! error en {c}/{d}/{s}: {e}", flush=True)

    for pi, cap in enumerate(passes, 1):
        if size_stop():
            print("TOPE DE TAMAÑO DE SEGURIDAD ALCANZADO.", flush=True)
            break
        if budget_exceeded():
            print("PRESUPUESTO ALCANZADO (tokens/USD).", flush=True)
            break
        print(f"\n=== PASADA {pi}/{len(passes)} · cap {cap} docs/subdominio (amplitud→profundidad) ===",
              flush=True)
        if workers <= 1:
            for j in jobs:
                if size_stop() or budget_exceeded():
                    break
                work(j, cap)
        else:
            with ThreadPoolExecutor(max_workers=workers) as ex:
                list(ex.map(lambda j, _c=cap: work(j, _c), jobs))
    status()
    print(f"usage autor={qw.usage}", flush=True)
    if _JUDGE_CLIENT:
        print(f"usage juez={_JUDGE_CLIENT.usage}", flush=True)
    if _PLANNER_CLIENT:
        print(f"usage planner={_PLANNER_CLIENT.usage}", flush=True)
    by = {k: round(v, 3) for k, v in estimated_cost_by_provider().items()}
    print(f"COSTO ESTIMADO ~${estimated_cost_usd():.2f} USD · por proveedor: {by}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
