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
import socket
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent
META = KB / "_meta"
TOOLS = KB / "tools"
sys.path.insert(0, str(TOOLS))
from llm_qwen import Qwen, provider_for  # noqa: E402
from facts_table import canonical_block, load_facts, values_match  # noqa: E402
from dedup import is_near_dup  # noqa: E402

TAXO = yaml.safe_load((META / "taxonomy.yaml").read_text())
POLICY = yaml.safe_load((META / "build_policy.yaml").read_text())
SOURCES_FILE = META / "sources.yaml"
DATE = POLICY["content_conventions"]["date_anchor"]
# Checkpoint = existencia de los pares .es/.md en disco (re-ejecutar salta lo ya hecho).
MODELS = POLICY["models"]
WISE = POLICY.get("wise_use", {})
CANON_ALL = load_facts(verified_only=True)     # tabla canónica (verdad de base) para inyectar al autor
# Subconjunto que el GATE valida determinísticamente (verified + enforce!=false) — = "anclaje 100% real".
CANON_ENFORCED = {k for k, v in CANON_ALL.items() if v.get("enforce", True)}
CONCEPT_MAP_FILE = META / "concept_map.yaml"


def _load_concept_map() -> dict:
    try:
        return (yaml.safe_load(CONCEPT_MAP_FILE.read_text(encoding="utf-8")) or {}).get("cells", {})
    except Exception:
        return {}


CONCEPT_MAP = _load_concept_map()   # espinazo de conocimiento (qué es "TODO"); vacío ⇒ planner en vivo
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
SEARCH_USD = POLICY.get("search_usd_per_call", {})   # surcharge de búsqueda web por llamada, por proveedor
TARGETS = POLICY["targets"]
STOP_ON = TARGETS.get("stop_on", "coverage")             # coverage | size
SIZE_TARGET = float(TARGETS.get("total_size_mb", 10))
SIZE_SAFETY = float(TARGETS.get("size_safety_cap_mb", 0) or 0)
_AUTHOR_CLIENT = None     # se fija en main(); usado para presupuesto/alerta y tope de tokens del autor
_alerted: set = set()     # proveedores ya alertados (para no repetir la alerta)
RETRY_DRAFTS = False     # --retry-drafts: en el resume, regenerar los docs en estado draft


# El frontmatter se serializa con json.dumps → `status: "review"` (CON comillas). Toda lectura/escritura
# de status debe ser tolerante a comillas (`"review"` | review | 'review'); un substring crudo NO matchea.
_STATUS_RE = re.compile(r'^status:\s*["\']?([A-Za-z_]+)["\']?\s*$', re.M)


def doc_status(text: str) -> str:
    """Valor de `status:` del frontmatter, tolerante a comillas. '' si no se encuentra."""
    m = _STATUS_RE.search(text[:800])
    return m.group(1) if m else ""


def set_status(text: str, new: str) -> str:
    """Reescribe `status:` a la forma canónica citada `status: "<new>"`. Idempotente."""
    return _STATUS_RE.sub(f'status: "{new}"', text, count=1)


def _is_draft(es_path: Path) -> bool:
    try:
        return doc_status(es_path.read_text(encoding="utf-8")) == "draft"
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
    # (cliente, modelo) por rol; los clientes se crean lazy (_judge_client/_planner_client/_verifier_client/main).
    # El VERIFICADOR cuenta como rol propio: su gasto (GLM, cuello de botella) debe ser visible al budget.
    return ((_AUTHOR_CLIENT, MODELS["author"]), (_JUDGE_CLIENT, MODELS["judge"]),
            (_PLANNER_CLIENT, MODELS["planner"]),
            (_VERIFIER_CLIENT, MODELS.get("verifier", MODELS["judge"])))


def estimated_cost_by_provider() -> dict:
    """Gasto estimado en USD POR PROVEEDOR (tokens×precio). Clave = provider del cliente."""
    out: dict = {}
    for client, model in _role_clients():
        if client is None:
            continue
        pr = _price(model)
        u = client.usage_snapshot()      # lectura consistente (lock) — los workers escriben en paralelo
        c = (u.get("prompt_tokens", 0) / 1e6 * pr.get("in", 0.0)
             + u.get("completion_tokens", 0) / 1e6 * pr.get("out", 0.0)
             + u.get("search_calls", 0) * float(SEARCH_USD.get(client.provider, 0.0)))
        out[client.provider] = out.get(client.provider, 0.0) + c
    return out


def estimated_cost_usd() -> float:
    return sum(estimated_cost_by_provider().values())


def budget_exceeded(qw=None) -> bool:
    """True si el autor superó su tope de tokens, O si ALGÚN proveedor superó su tope en USD
    (la corrida muere cuando cualquiera de las 3 cuentas se agota)."""
    if _BUDGET_OUT > 0 and _AUTHOR_CLIENT and _AUTHOR_CLIENT.usage_snapshot().get("completion_tokens", 0) >= _BUDGET_OUT:
        return True
    if not _BUDGET_USD:
        return False
    costs = estimated_cost_by_provider()
    if "_total" in _BUDGET_USD and sum(costs.values()) >= _BUDGET_USD["_total"]:
        return True
    return any(costs.get(prov, 0.0) >= cap for prov, cap in _BUDGET_USD.items() if prov != "_total")


def _author_is_capped() -> bool:
    """True si el proveedor del autor (mayor gasto, pay-as-you-go) tiene ALGÚN tope (USD o tokens)."""
    prov = provider_for(MODELS["author"])
    return (prov in _BUDGET_USD) or ("_total" in _BUDGET_USD) or (_BUDGET_OUT > 0)


def _guard_author_budget(accept_unbounded: bool):
    """Antes de --run: rehúsa arrancar si el autor no tiene tope (un runaway factura directo a tarjeta)."""
    if _author_is_capped() or accept_unbounded:
        return
    prov = provider_for(MODELS["author"])
    sys.exit(
        f"ABORTO: el autor ({prov}) no tiene tope de USD ni de tokens y es pay-as-you-go "
        f"(un runaway factura DIRECTO a la tarjeta). Define wise_use.budget_usd['{prov}'] o "
        f"budget_output_tokens en build_policy.yaml, o repite con --i-accept-unbounded-author.")


def _guard_cost_projection(accept_under: bool):
    """Antes de una corrida MASIVA (--run sin --max-docs): rehúsa arrancar si los caps de presupuesto NO
    cubren la corrida COMPLETA proyectada. Cierra el riesgo #1 (un --run que muere a mitad por budget
    disfrazado de 'STOP por cobertura'): GO-para-arrancar → GO-para-TERMINAR. El smoke de Fase 1
    (--only / --max-docs) NO pasa por aquí. La doc decía que el preflight 'rehúsa el GO' — antes era sólo
    advisory; este guard lo hace REAL en el punto que importa (el lanzamiento de la corrida masiva)."""
    if accept_under or not _BUDGET_USD:
        return
    try:
        from cost_projection import map_topics, project
        proj = project(map_topics(), safety=1.3, atomic=True)
    except Exception:
        return     # no bloquear por un fallo de la proyección misma; es un raíl de seguridad, no un dogma
    short = []
    for prov, pv in proj.get("by_provider", {}).items():
        if prov == "_total":
            continue
        cap = _BUDGET_USD.get(prov)
        if cap is not None and cap < pv:
            short.append(f"{prov} cap ${cap:.0f} < proyectado ${pv:.0f}")
    if short:
        total = sum(proj.get("by_provider", {}).values())
        sys.exit(
            f"ABORTO: presupuesto insuficiente para TERMINAR la corrida completa (~${total:.0f}): "
            f"{'; '.join(short)}. Sube wise_use.budget_usd a la proyección (cost_projection.py → "
            "'cap recomendado') y recarga las APIs, o repite con --i-accept-underbudget "
            "(corte LIMPIO y reanudable al agotar el cap).")


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


# ── Liveness de fuentes (anti-fabricación de citas) ──────────────────────────
# El autor puede ALUCINAR una URL .gov (que se auto-clasificaría 'primary' por substring) y citarla
# como grounding de una cifra volátil. Verificamos que la URL RESUELVE antes de concederle tier alto;
# si no resuelve, se degrada a 'tertiary' (y el gate, que exige primary para volatilidad>=medium, fuerza
# al autor a buscar una fuente real). Cache + fuera del lock de sources (no serializar la red).
VERIFY_LIVENESS = bool(WISE.get("verify_source_liveness", True))
_LIVENESS_CACHE: dict = {}
_LIVENESS_LOCK = threading.Lock()


def _url_alive(url: str, timeout: int = 8) -> bool:
    key = (url or "").rstrip("/")
    if not key:
        return False
    with _LIVENESS_LOCK:
        if key in _LIVENESS_CACHE:
            return _LIVENESS_CACHE[key]
    alive = False
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(
                key, method=method, headers={"User-Agent": "Mozilla/5.0 (littlefounders-kb-source-check)"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                code = getattr(r, "status", None) or r.getcode()
                alive = 200 <= int(code) < 400
            if alive:
                break
        except urllib.error.HTTPError as e:
            # el servidor RESPONDIÓ: 401/403/405/406/429 = EXISTE pero bloquea bots/rate-limit → cuenta como
            # vivo (no es URL fabricada). 404/410/5xx → reintenta GET; si ambos fallan, queda muerto.
            if e.code in (401, 403, 405, 406, 429):
                alive = True
                break
            continue
        except (TimeoutError, socket.timeout):
            # TRANSITORIO (lentitud puntual): NO degradar — degradar dispararía re-draft loops carísimos
            # en docs cuya fuente sí existe. Se asume viva (el beneficio de la duda en timeouts).
            alive = True
            break
        except urllib.error.URLError as e:
            if isinstance(getattr(e, "reason", None), (TimeoutError, socket.timeout)):
                alive = True   # timeout envuelto en URLError → transitorio, no penalizar
                break
            continue           # DNS no resuelve / conexión rechazada → host fabricado o caído → muerto
        except Exception:
            continue
    with _LIVENESS_LOCK:
        _LIVENESS_CACHE[key] = alive
    return alive


def resolved_tier(url: str) -> str:
    """tier_of_url + degradación por liveness: una URL 'primary/reputable' que NO resuelve → 'tertiary'."""
    tier = tier_of_url(url)
    if VERIFY_LIVENESS and tier in ("primary", "reputable") and not _url_alive(url):
        return "tertiary"
    return tier


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
        # liveness FUERA del lock (no serializar la red entre workers); cache evita re-fetch
        tier = resolved_tier(url)
        with self.lock:
            if key in self.by_url:
                return self.by_url[key]
            h = hashlib.md5(key.encode()).hexdigest()[:8]
            sid = f"src_gen_{h}"
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
def grounding_meta(payload, evidence_used=False) -> dict:
    """Etiqueta HONESTA de grounding por-doc (NO 'todo es 100% real'). Distingue:
      · anchored     = ≥1 cifra validada DETERMINÍSTICAMENTE contra facts.yaml (verdad de base),
      · llm_reviewed = sin ancla canónica → revisado por el juez LLM + fuentes (pendiente firma SME),
      · conceptual   = contenido conceptual estático sin cifras volátiles.
    Permite a cualquier consumidor (lección/chatbot) saber QUÉ tan verificado está cada doc."""
    facts = payload.get("facts", []) or []
    cited = len(facts)
    canon = sum(1 for f in facts if f.get("id") in CANON_ENFORCED)
    vol = payload.get("volatility", "medium")
    if canon > 0:
        tier = "anchored"
    elif vol == "static" and cited == 0:
        tier = "conceptual"
    else:
        tier = "llm_reviewed"
    return {"grounding_tier": tier, "canonical_facts": canon,
            "cited_facts": cited, "evidence_grounded": bool(evidence_used)}


def assemble_doc(country, domain, subdomain, slug, lang, payload, src_ids, fact_src,
                 grounding=None, evidence_used=False):
    doc_id = f"{country}-{domain}-{subdomain}-{slug}"
    vol = payload["volatility"]
    gm = grounding if grounding is not None else grounding_meta(payload, evidence_used)
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
    fm.update(gm)     # etiqueta de grounding (tier + conteos) — campos opcionales, el gate no los exige
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
        "EVIDENCIA RECUPERADA (FUENTES PRIMARIAS, los pasajes MÁS RELEVANTES a este tema). REGLA v4: "
        "CADA afirmación material de tu texto DEBE poder SEGUIRSE de esta evidencia — un verificador "
        "atómico (NLI) la chequeará afirmación por afirmación; lo que no se funde aquí se RECHAZA. "
        "Funda tu redacción y tus @fact en esta evidencia y cita esas URLs. Si un punto necesario NO "
        f"está aquí, búscalo en la web y cítalo; NO escribas de memoria:\n\n{evidence}\n\n===\n\n"
    ) if evidence else ""
    msg = [{"role": "system", "content":
            "Eres autor experto de contenido educativo bilingüe (ES canónico, EN fiel) de finanzas/impuestos, "
            f"edades 5-18+, fundamentado en FUENTES PRIMARIAS (.gov/leyes) y actual a {DATE}. Apuntas a calidad "
            "NIVEL ENCICLOPEDIA/INDUSTRIA (estándar Investopedia/IRS/SAT/CONDUSEF): definición clara, ejemplo "
            "TRABAJADO con cifras resueltas, fechado explícito de cada dato, y auto-contención. Devuelve SOLO JSON."},
           {"role": "user", "content":
            canon_block + ev_block +
            f"País={country} ({JURIS[country]}) dominio={domain} subdominio={subdomain}.\n"
            f"Documento: slug={topic['slug']} | {topic['title_es']} / {topic['title_en']} | ángulo: {topic.get('angle','')}\n"
            f"age_bands={topic['age_bands']} depth_tier={topic['depth_tier']} volatility={topic['volatility']}\n\n"
            "REGLAS DURAS:\n"
            f"- Cuerpo con secciones por tier, cada encabezado con comentario, p.ej. "
            "'## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->'. Cubre TODOS los age_bands dados.\n"
            f"- Empieza con '## Resumen' (2-3 frases AUTO-CONTENIDAS: qué es, jurisdicción, fecha {DATE}, "
            "diferenciador MX vs US). Es contenido real e indexable, NO un meta-comentario ni te dirijas a un asistente.\n"
            f"- VOCABULARIO PROHIBIDO en secciones tier1/tier2: {forb['tier1']['forbidden']+forb['tier2']['forbidden']} "
            "(ni sus equivalentes en inglés). Explica concreto, no abstracto.\n"
            "- ESTRUCTURA NIVEL ENCICLOPEDIA en la sección del tier MÁS ALTO presente (tier4/tier5): (a) una "
            "definición de UNA línea; (b) '**Puntos clave**' con 3-5 viñetas; (c) cómo funciona / cómo se calcula "
            "(fórmula si aplica); (d) un EJEMPLO TRABAJADO; (e) consideraciones/excepciones ('Ojo:', 'Excepción:'); "
            "(f) si aplica, una comparación 'X vs Y'. En tiers bajos, versión simplificada pero con el ejemplo.\n"
            "- EJEMPLO TRABAJADO OBLIGATORIO: con un ACTOR con nombre y un escenario ('Ana gana $10,000…'), TODOS "
            "los insumos nombrados, la operación mostrada y el RESULTADO resuelto a una cifra concreta ('= $1,600'). "
            "Preséntalo como ILUSTRACIÓN con cifras REDONDEADAS. NO le pongas @fact a cálculos derivados ni a montos "
            "de tablas (retención exacta): son ilustrativos, no datos oficiales.\n"
            f"- FECHADO: toda cifra sensible al tiempo lleva su periodo/'vigente a {DATE[:7]}' o 'ejercicio fiscal'. "
            "AUTO-CONTENCIÓN (para RAG): di explícitamente el país y el periodo, y define los términos que uses "
            "(un chunk recuperado debe entenderse solo, sin contexto externo).\n"
            f"- Marca con [[fact:<id.punteado>]] SOLO las cifras OFICIALES y verificables (tasas, límites, "
            "umbrales, versiones, fechas oficiales) y declára cada una en 'facts' con su fuente PRIMARIA. "
            f"Apunta a >= {POLICY['depth']['min_cited_facts_per_doc']} hechos oficiales si el tema los tiene.\n"
            "- Si una cifra está en CIFRAS CANÓNICAS, usa su id EXACTO y su valor EXACTO (un gate determinista "
            "los compara: cualquier diferencia = RECHAZO). Evita citar cifras MUY volátiles (tasas de banco "
            "central) que no estén en esa lista; si lo haces, hazlo SIEMPRE con su fecha de vigencia.\n"
            "- NO mezcles jurisdicciones: nada de instrumentos del otro país como si aplicaran aquí.\n"
            "- NEUTRALIDAD: explica, no vendas; nada de recomendar productos/marcas ni sesgo político.\n"
            f"- Usa fuentes REALES y ACTUALES (busca en la web); cita SOLO fuentes PRIMARIAS o reputadas; "
            f"incluye >= 1 fuente PRIMARIA (.gov/ley) para hechos volátiles.{fix}\n\n"
            'Devuelve {"title_es":"...","title_en":"...","concept_ids":["..."],"age_bands":[...],'
            '"depth_tier":"...","volatility":"...",'
            '"sources":[{"url":"https://...","title":"...","publisher":"...","jurisdiction":"MX-FED|US-FED|NONE"}],'
            '"facts":[{"id":"dotted.id","value":"16%","volatility":"medium","source_index":0}],'
            '"body_es":"## Resumen\\n...","body_en":"## Summary\\n..."}'}]
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
            "DIMENSIONES ADICIONALES (estándar industria/enciclopedia): completeness = ¿cubre los subtemas "
            "esperados (qué es / cómo se calcula / quién / cuándo / excepciones), no solo una definición?; "
            "worked_example = ¿hay un ejemplo TRABAJADO con actor nombrado, insumos y resultado numérico resuelto?; "
            "citation_quality = ¿las cifras se apoyan en fuentes PRIMARIAS rastreables y fechadas?\n"
            'Devuelve {"scores":{"factual_accuracy":n,"pedagogical_scaffolding":n,"country_correctness":n,'
            '"translation_fidelity":n,"engagement":n,"completeness":n,"worked_example":n,"citation_quality":n},'
            '"hard_fails":[...],"wrong_facts":[...],"verdict":"publish|revise"}'}]
    return _judge_client().json(msg, model=MODELS["judge"], enable_search=MODELS["grounding_search"],
                                temperature=0.2, timeout=240)


_JUDGE_CLIENT = None
_PLANNER_CLIENT = None
_VERIFIER_CLIENT = None


def _judge_client():
    """Cliente del juez. Proveedor independiente del autor (deduce glm/deepseek/qwen del modelo)."""
    global _JUDGE_CLIENT
    if _JUDGE_CLIENT is None:
        _JUDGE_CLIENT = Qwen(provider=provider_for(MODELS["judge"]))
    return _JUDGE_CLIENT


def _verifier_client():
    """Cliente del VERIFICADOR atómico (NLI). Cliente PROPIO (no efímero) para que su gasto se contabilice
    en el presupuesto (antes atomic_verify creaba un Qwen() suelto → el gasto del cuello de botella GLM era
    INVISIBLE al budget_exceeded). Usa MODELS['verifier'] (key honrada; por defecto == juez)."""
    global _VERIFIER_CLIENT
    if _VERIFIER_CLIENT is None:
        _VERIFIER_CLIENT = Qwen(provider=provider_for(MODELS.get("verifier", MODELS["judge"])))
    return _VERIFIER_CLIENT


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


def _cell_topics(qw, country, domain, subdomain):
    """Temas de la celda: del concept_map (espinazo EXHAUSTIVO) si existe; si no, planner en vivo.
    Devuelve (topics, from_map). Si from_map=True, el orquestador NO expande con el crítico (el mapa
    ya es la fuente de verdad de 'qué es TODO')."""
    cell = CONCEPT_MAP.get(f"{country}/{domain}/{subdomain}")
    if cell and cell.get("topics"):
        return cell["topics"], True
    return q_planner(qw, country, domain, subdomain), False


def _existing_es_bodies(subdir, slug):
    """Cuerpos (.es) de OTROS docs de la celda — para el gate de dedup near-dup."""
    out = []
    if not subdir.exists():
        return out
    for p in subdir.glob("*.es.md"):
        if p.name == f"{slug}.es.md":
            continue
        t = p.read_text(encoding="utf-8")
        out.append(t.split("\n---", 1)[-1] if t.startswith("---") else t)
    return out


# ─────────────────────────── gate ───────────────────────────
def run_gate(subtree):
    """Corre el gate determinista sobre un subárbol. Distingue CRASH (returncode!=0 SIN líneas HARD —
    p.ej. un torn-read concurrente de sources.yaml que rompe el YAML) de FALLO de contenido: ante un crash
    REINTENTA una vez; si persiste, devuelve un issue 'gate_crash:' en vez de un error VACÍO (que haría al
    autor 'corregir' nada y quemar una ronda pagada)."""
    def _run():
        r = subprocess.run([sys.executable, str(TOOLS / "gate_kb.py"), subtree],
                           capture_output=True, text=True, cwd=str(KB.parent))
        return r, [ln.strip() for ln in r.stdout.splitlines() if "HARD:" in ln]
    r, errs = _run()
    if r.returncode != 0 and not errs:
        r, errs = _run()                      # posible torn-read de sources.yaml → un reintento
        if r.returncode != 0 and not errs:
            tail = ((r.stderr or r.stdout).strip().splitlines() or ["sin salida"])[-1][:160]
            return False, [f"gate_crash: {tail}"]
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
    """Filtra falsos positivos del juez (a veces lista en wrong_facts cifras que en realidad CONFIRMA),
    SIN tragarse errores reales. Regla endurecida (eval 2026-06-21): suprime SOLO con evidencia POSITIVA
    de no-error; NUNCA por `actual_value` en blanco (eso convertía falsos-positivos en falsos-NEGATIVOS).
      · dict: suprime si AMBOS valores existen y COINCIDEN (doc==correcto). Si el juez aporta un
        correct_value (discrepa), se CONSERVA aunque haya frase de confirmación (señal real de error).
      · str: suprime solo si es claramente una frase de confirmación (sin número que sugiera discrepancia)."""
    out = []
    for w in (wrong or []):
        if isinstance(w, dict):
            actual = str(w.get("actual_value", w.get("doc_value", ""))).strip().lstrip("$").replace(",", "")
            correct = str(w.get("expected_value", w.get("correct_value", ""))).strip().lstrip("$").replace(",", "")
            if actual and correct and values_match(actual, correct):
                continue  # ambos presentes y coinciden → confirmación dura, no es error
            txt = " ".join(str(v) for v in w.values())
            # confirmación pura: frase de OK y NINGÚN valor correcto aportado (no hay discrepancia que reportar)
            if _CONFIRM_RE.search(txt) and not correct:
                continue
        elif isinstance(w, str):
            # string con frase de confirmación pero SIN dígitos → es comentario de "está bien", no un error
            if _CONFIRM_RE.search(w) and not re.search(r"\d", w):
                continue
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
    # v4 RAG-to-write: evidencia recuperada POR-TEMA (no el blob por-dominio) → el autor escribe DESDE
    # fuentes reales y el verificador atómico tiene contra-qué medir. Fallback al blob si rag_to_write=off.
    _gb = POLICY["run"]["grounding_backend"] in ("hybrid", "notebooklm")
    if _gb and POLICY["run"].get("rag_to_write", True):
        from evidence_rag import retrieve_for_topic
        _tt = f"{topic.get('title_es','')} {topic.get('title_en','')} {topic.get('angle','')}".strip()
        evidence = retrieve_for_topic(country, domain, _tt or slug,
                                      top_k=int(POLICY["run"].get("evidence_top_k", 8)))
    else:
        evidence = load_evidence(country, domain) if _gb else ""
    existing_es = _existing_es_bodies(subdir, slug)   # para el gate de dedup near-dup
    u0 = qw.usage_snapshot()
    for attempt in range(bar["max_revise_rounds"] + 1):
        # El autor va GUARDADO (como el juez): una respuesta malformada/transitoria (JSON inválido, error de
        # red tras reintentos) cuesta SOLO este doc — antes propagaba y mataba la CELDA entera (hasta 37 temas).
        try:
            payload = q_author(qw, country, domain, subdomain, topic, feedback, evidence=evidence)
        except Exception as e:
            feedback = ("Tu respuesta anterior no fue JSON válido o falló. Devuelve EXCLUSIVAMENTE un objeto "
                        "JSON COMPLETO y bien formado (sin texto fuera del JSON); sé más conciso si hace falta.")
            last_issue = f"author_error:{type(e).__name__}:{str(e)[:80]}"
            continue
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
        gm = grounding_meta(payload, evidence_used=bool(evidence))
        es_doc = assemble_doc(country, domain, subdomain, slug, "es", payload, src_ids, fact_src, grounding=gm)
        en_doc = assemble_doc(country, domain, subdomain, slug, "en", payload, src_ids, fact_src, grounding=gm)
        # Gate de dedup: no escribir near-duplicates (escala = conocimiento único, no relleno).
        if existing_es and is_near_dup(es_doc, existing_es):
            feedback = ("Tu contenido DUPLICA otro documento de este subdominio. Dale un ÁNGULO claramente "
                        "DISTINTO (otro caso, tipo, procedimiento o nivel); no repitas lo ya cubierto.")
            last_issue = "near_duplicate"
            continue
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
            break  # gate pasó pero el juez falló → sale del loop y se DEGRADA a draft (revisión humana)
        sc = judged.get("scores", {})
        wrong = _real_wrong(judged.get("wrong_facts"))
        hard = judged.get("hard_fails") or []
        # Una dimensión REQUERIDA ausente en la respuesta del juez = FALLO, no skip: un juez que omite
        # worked_example/completeness/citation_quality no debe colar un doc deficiente (la barra se 'gana').
        below = [f"{k}={sc.get(k, 'falta')}<{bar[k]}" for k in
                 ("factual_accuracy", "country_correctness", "pedagogical_scaffolding",
                  "translation_fidelity", "engagement", "completeness", "worked_example",
                  "citation_quality") if k in bar and (k not in sc or sc[k] < bar[k])]
        # Piso de PROFUNDIDAD determinista (no solo el juez subjetivo): un doc por debajo de
        # min_words_per_doc se regenera (más cerca del estándar enciclopedia Investopedia/IRS).
        words = len((payload.get("body_es") or "").split())
        min_words = int(POLICY["depth"].get("min_words_per_doc", 0) or 0)
        too_short = min_words > 0 and words < min_words
        if wrong or hard or judged.get("verdict") == "revise" or below or too_short:
            extra = f" DOC CORTO: {words}<{min_words} palabras (expande con más detalle/ejemplos)." if too_short else ""
            feedback = ("Revisa y REGENERA. Verifica cada cifra contra fuente PRIMARIA ACTUAL (2026). "
                        f"HECHOS ERRÓNEOS: {wrong}. FALLAS DURAS: {hard}. DIMENSIONES BAJAS: {below}.{extra}")
            last_issue = f"judge wrong={wrong[:2]} below={below} short={too_short}"
            continue
        # v4: VERIFICACIÓN ATÓMICA — la prosa debe estar FUNDAMENTADA en la evidencia (anti-lavado). Cada
        # afirmación se verifica por NLI contra la evidencia recuperada. Se evalúa el CUERPO ENSAMBLADO (con
        # los @fact ya sustituidos, sin placeholders [[fact:]]) = la prosa que de verdad se sirve, vía un
        # cliente VERIFICADOR propio (su gasto cuenta al presupuesto; ver _verifier_client/_role_clients).
        # CALIBRACIÓN (Fase 1): el ÚNICO disparo DURO por defecto es `contradicted>0` (señal fiable: la
        # evidencia dice OTRA cosa). factscore y la tasa de no-verificables son RUIDOSAS sobre evidencia top-k
        # léxica (una paráfrasis pedagógica fiel sale 'unverifiable' aunque sea correcta), así que sólo bloquean
        # con señal suficiente (checkable>=min) y con sus flags activos — si no, el gate degradaría TODO el
        # corpus a draft antes de calibrar con datos reales (ver RUNBOOK_V4 Fase 1).
        if bar.get("atomic_verify") and evidence:
            try:
                from atomic_verify import score_text
                shipped_es = replace_facts(payload.get("body_es", ""), payload.get("facts", []), fact_src)
                fs = score_text(shipped_es, evidence, mode="llm",
                                model=MODELS.get("verifier", MODELS["judge"]), client=_verifier_client())
            except Exception as e:
                last_issue = f"atomic_error:{type(e).__name__}:{str(e)[:80]}"
                break   # infra del verificador falló (gate+juez ya pasaron) → DEGRADA a draft (revisión humana)
            min_fs = float(bar.get("min_factscore", 0.0) or 0.0)
            max_unv = float(bar.get("max_unverifiable_rate", 1.0) or 1.0)
            min_checkable = int(bar.get("min_checkable_for_factscore", 4) or 0)
            unv_block = bool(bar.get("atomic_unverifiable_blocking", False))
            fs_block = bool(bar.get("atomic_factscore_blocking", True))
            pertinent = fs.get("pertinent", fs["claims"]) or 0
            unv_rate = (fs["unverifiable"] / pertinent) if pertinent else 0.0
            # factscore sólo es fiable con denominador suficiente (checkable>=min); si no, NO bloquea.
            bad_fs = (fs_block and fs["checkable"] >= min_checkable
                      and fs["factscore"] is not None and fs["factscore"] < min_fs)
            bad_unv = unv_block and pertinent > 0 and unv_rate > max_unv
            if fs["contradicted"] > 0 or bad_fs or bad_unv:
                feedback = ("FUNDAMENTA cada afirmación en la EVIDENCIA dada (no de memoria). CONTRADICHAS por "
                            f"la evidencia: {fs['contradicted_claims']}. factscore={fs['factscore']} (min {min_fs}, "
                            f"checkable={fs['checkable']}); no-verificables={unv_rate:.0%}. Reescribe para que "
                            "cada afirmación se siga de la evidencia, o elimínala.")
                last_issue = f"atomic fs={fs['factscore']} contra={fs['contradicted']} unv={unv_rate:.0%}"
                continue
        u1 = qw.usage_snapshot()
        spent = {k: u1.get(k, 0) - u0.get(k, 0) for k in u0}
        did = f"{country}-{domain}-{subdomain}-{slug}"
        # Grounding mínimo: un doc de ALTA volatilidad SIN ninguna cifra anclada es sospechoso (una cifra
        # que cambia cada trimestre DEBERÍA estar taggeada) → a revisión humana en vez de publicarse review.
        if (gm["cited_facts"] == 0 and topic.get("volatility") == "high"
                and POLICY["depth"].get("require_fact_when_high_volatility", True)):
            for p in (es_path, en_path):
                if p.exists():
                    write_atomic(p, set_status(p.read_text(encoding="utf-8"), "draft"))
            _log({"doc_id": did, "status": "draft", "issue": "high_volatility_no_fact", "scores": sc})
            save_state(did, "draft")
            return "needs_review(high_volatility_no_fact)"
        _log({"doc_id": did, "status": "review", "scores": sc, "spent": spent,
              "grounding": gm["grounding_tier"], "canonical_facts": gm["canonical_facts"]})
        save_state(did, "review")
        return f"built_ok(scores={sc} grounding={gm['grounding_tier']})"

    # rondas agotadas con problemas → DEGRADAR a draft + registrar (única válvula de revisión humana)
    for p in (es_path, en_path):
        if p.exists():
            write_atomic(p, set_status(p.read_text(encoding="utf-8"), "draft"))
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
    topics, from_map = _cell_topics(qw, country, domain, subdomain)
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
        if from_map:
            break   # el concept_map ya es la fuente EXHAUSTIVA de temas: no se expande con el crítico
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


def _build_log_summary() -> dict:
    """Resumen del build_log.jsonl (última entrada por doc): distribución de grounding + causas de draft.
    Hace visible el monitor de juez (judge_error) y qué tan anclado quedó el corpus."""
    f = KB / "index" / "build_log.jsonl"
    if not f.exists():
        return {}
    latest = {}
    for line in f.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("doc_id"):
            latest[e["doc_id"]] = e
    grounding, issues = {}, {}
    for e in latest.values():
        if e.get("status") == "review":
            g = e.get("grounding", "?")
            grounding[g] = grounding.get(g, 0) + 1
        elif e.get("status") == "draft":
            iss = (str(e.get("issue", "?")) or "?").split(":")[0]
            issues[iss] = issues.get(iss, 0) + 1
    return {"grounding": grounding, "draft_issues": issues}


def status():
    target = POLICY["targets"]["total_size_mb"]
    print(f"Tamaño corpus: {corpus_size_mb():.2f} MB / meta {target} MB")
    review = draft = published = total = 0
    for c in ("shared", "mx", "us"):
        base = KB / c
        if not base.exists():
            continue
        for p in base.rglob("*.es.md"):
            total += 1
            st = doc_status(p.read_text(encoding="utf-8"))
            if st == "draft":
                draft += 1
            elif st == "review":
                review += 1
            elif st == "published":
                published += 1
    print(f"Docs (.es): {total}  |  review: {review}  draft(revisión humana): {draft}  published: {published}")
    bl = _build_log_summary()
    if bl.get("grounding"):
        print(f"Grounding (review): {bl['grounding']}")
    if bl.get("draft_issues"):
        print(f"Drafts por causa (incl. judge_error): {bl['draft_issues']}")
    jobs = all_jobs()
    covered = sum(1 for (c, d, s) in jobs
                  if (KB / c / d / s).exists() and any((KB / c / d / s).glob("*.es.md")))
    print(f"Amplitud (breadth): {covered}/{len(jobs)} celdas país×dominio×subdominio con ≥1 doc")
    if CONCEPT_MAP:
        map_total = sum(len(c.get("topics", [])) for c in CONCEPT_MAP.values())
        pct = 100 * total / map_total if map_total else 0
        print(f"Cobertura del MAPA (enciclopedia): {total} docs / {map_total} temas "
              f"({pct:.0f}%) · {len(CONCEPT_MAP)}/{len(jobs)} celdas mapeadas")
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
    ap.add_argument("--i-accept-unbounded-author", action="store_true",
                    help="permitir --run con el autor (qwen) SIN tope de USD/tokens (riesgo de gasto en tarjeta)")
    ap.add_argument("--i-accept-underbudget", action="store_true",
                    help="permitir la corrida MASIVA aunque los caps NO cubran la corrida completa proyectada "
                         "(corte LIMPIO y reanudable al agotar el cap; por defecto se rehúsa)")
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
        _guard_author_budget(args.i_accept_unbounded_author)
        if not args.max_docs:                       # corrida MASIVA (no un slice acotado) → GO-para-TERMINAR
            _guard_cost_projection(args.i_accept_underbudget)
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


# ─────────────────────── cobertura vs concept_map (STOP real) ───────────────────────
def _max_cell_topics() -> int:
    return max((len(c.get("topics", [])) for c in CONCEPT_MAP.values()), default=0)


def map_coverage() -> dict:
    """Cobertura MEDIBLE contra el concept_map: temas con doc en disco / temas del mapa, y celdas con
    baseline / completas. '' si no hay mapa (planner en vivo). Esta es la base del STOP por cobertura."""
    if not CONCEPT_MAP:
        return {}
    total = covered = cells_baseline = cells_full = 0
    for key, cell in CONCEPT_MAP.items():
        c, d, s = key.split("/")
        subdir = KB / c / d / s
        topics = cell.get("topics", [])
        total += len(topics)
        # Cobertura = temas con doc VERIFICADO (review/published). Un draft (falló verificación) NO
        # cuenta como cubierto, si no el STOP-por-cobertura se satisfaría con docs no verificados.
        have = ({p.name[:-6] for p in subdir.glob("*.es.md") if not _is_draft(p)}
                if subdir.exists() else set())
        cov = sum(1 for t in topics if t.get("slug") in have)
        covered += cov
        if have:
            cells_baseline += 1
        if topics and cov >= len(topics):
            cells_full += 1
    return {"covered": covered, "total": total,
            "pct": (100.0 * covered / total) if total else 0.0,
            "cells_total": len(CONCEPT_MAP), "cells_baseline": cells_baseline, "cells_full": cells_full}


def coverage_complete() -> bool:
    """True cuando STOP_ON=='coverage' y el concept_map está 100% cubierto (todo tema tiene doc). Si
    require_full_breadth, además exige que toda celda tenga baseline (subsumido por cobertura total)."""
    if STOP_ON != "coverage" or not CONCEPT_MAP:
        return False
    st = map_coverage()
    if not st or st["total"] <= 0:
        return False
    full = st["covered"] >= st["total"]
    if POLICY["targets"].get("require_full_breadth", False):
        full = full and st["cells_baseline"] >= st["cells_total"]
    return full


def _effective_passes(raw_passes):
    """Expande un cap 0 (=todo el mapa) en INCREMENTOS ACOTADOS para checkpointear cobertura/budget
    entre pasadas (un resume-tras-recarga avanza contra el mapa, no re-camina un único pase gigante).
    Sin concept_map, 0 → None (sin tope) = comportamiento de planner en vivo."""
    if not CONCEPT_MAP:
        return [(c or None) for c in raw_passes]
    ceil = _max_cell_topics()
    step = int(POLICY.get("breadth", {}).get("full_step", 8)) or 8
    finite = [c for c in raw_passes if c and c > 0]
    out = []
    for cap in raw_passes:
        if cap and cap > 0:
            out.append(cap)
            continue
        nxt = (max(finite, default=0)) + step
        while nxt < ceil:
            out.append(nxt)
            nxt += step
        out.append(ceil)        # último incremento = cap >= celda más grande ⇒ cobertura total garantizada
    seen, dedup = set(), []
    for c in out:               # dedup preservando orden
        if c not in seen:
            seen.add(c)
            dedup.append(c)
    return dedup


def run_all(qw, reg, workers, max_docs):
    """Orquestación BREADTH-FIRST con STOP por COBERTURA real. La pasada 1 cubre TODO el espectro a un
    baseline; las siguientes profundizan. El cap 'todo el mapa' se expande en incrementos acotados para
    checkpointear cobertura/budget. Para cuando el concept_map está 100% cubierto, o por budget/tamaño
    (corte LIMPIO y reanudable: re-ejecutar recomputa cobertura desde disco y continúa)."""
    jobs = all_jobs()
    br = POLICY.get("breadth", {})
    if max_docs:                                   # --max-docs fuerza una sola pasada con ese cap
        raw_passes = [max_docs]
    elif br.get("enabled"):
        raw_passes = br.get("passes") or [br.get("baseline_docs_per_subdomain", 2)]
    else:
        raw_passes = [POLICY["depth"]["min_docs_per_subdomain"]]
    passes = _effective_passes(raw_passes)
    stopdesc = "COBERTURA total del concept_map" if STOP_ON != "size" else f"tamaño {SIZE_TARGET} MB"
    cov0 = map_coverage()
    covmsg = (f" · cobertura inicial {cov0['pct']:.0f}% ({cov0['covered']}/{cov0['total']} temas)"
              if cov0 else "")
    print(f"Cobertura: {len(jobs)} subdominios · STOP por {stopdesc} · workers={workers} · "
          f"BREADTH-FIRST caps(docs/subdominio)={passes}{covmsg}", flush=True)

    def work(job, cap):
        if size_stop() or budget_exceeded():
            return
        budget_alert()
        c, d, s = job
        try:
            build_subdomain(qw, reg, c, d, s, max_docs=(cap or None))   # cap 0 = sin tope (todo el mapa)
        except Exception as e:                       # un subdominio que falle NO tumba la corrida
            print(f"  !! error en {c}/{d}/{s}: {e}", flush=True)

    for pi, cap in enumerate(passes, 1):
        if coverage_complete():
            print("✅ COBERTURA COMPLETA del concept_map — STOP.", flush=True)
            break
        if size_stop():
            print("TOPE DE TAMAÑO DE SEGURIDAD ALCANZADO.", flush=True)
            break
        if budget_exceeded():
            print("PRESUPUESTO ALCANZADO (USD/tokens) — corte LIMPIO y reanudable.", flush=True)
            break
        cov = map_coverage()
        capdesc = "TODO el mapa" if not cap else f"cap {cap} docs/subdominio"
        covdesc = f" · cobertura {cov['pct']:.0f}%" if cov else ""
        print(f"\n=== PASADA {pi}/{len(passes)} · {capdesc} (amplitud→profundidad){covdesc} ===", flush=True)
        if workers <= 1:
            for j in jobs:
                if size_stop() or budget_exceeded():
                    break
                work(j, cap)
        else:
            with ThreadPoolExecutor(max_workers=workers) as ex:
                list(ex.map(lambda j, _c=cap: work(j, _c), jobs))
    status()
    covf = map_coverage()
    if covf:
        print(f"COBERTURA FINAL del mapa: {covf['pct']:.0f}% ({covf['covered']}/{covf['total']} temas · "
              f"{covf['cells_full']}/{covf['cells_total']} celdas completas)", flush=True)
    print(f"usage autor={qw.usage_snapshot()}", flush=True)
    if _JUDGE_CLIENT:
        print(f"usage juez={_JUDGE_CLIENT.usage_snapshot()}", flush=True)
    if _VERIFIER_CLIENT:
        print(f"usage verificador={_VERIFIER_CLIENT.usage_snapshot()}", flush=True)
    if _PLANNER_CLIENT:
        print(f"usage planner={_PLANNER_CLIENT.usage_snapshot()}", flush=True)
    by = {k: round(v, 3) for k, v in estimated_cost_by_provider().items()}
    print(f"COSTO ESTIMADO ~${estimated_cost_usd():.2f} USD · por proveedor: {by}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
