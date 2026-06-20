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
from llm_qwen import Qwen  # noqa: E402

TAXO = yaml.safe_load((META / "taxonomy.yaml").read_text())
POLICY = yaml.safe_load((META / "build_policy.yaml").read_text())
SOURCES_FILE = META / "sources.yaml"
STATE_FILE = KB / "index" / "build_state.json"
DATE = POLICY["content_conventions"]["date_anchor"]
MODELS = POLICY["models"]

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
            block = (f"\n  {sid}:\n    title: {json.dumps(title or url)[:200]}\n"
                     f"    publisher: {json.dumps(publisher or '')}\n"
                     f"    url: {json.dumps(url)}\n    tier: {tier}\n"
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
        # sanear el valor: una sola línea y sin '-->' (que cerraría el comentario prematuramente)
        val = str(f["value"]).replace("\n", " ").replace("-->", "→").strip()
        return (f'<!-- @fact id={fid} value={val} verified={DATE} '
                f'src={sid} volatility={f.get("volatility","medium")} -->')
    return re.sub(r"\[\[fact:([a-zA-Z0-9_.]+)\]\]", repl, body)


# ─────────────────────────── Qwen roles ───────────────────────────
def q_planner(qw, country, domain, subdomain):
    band_rules = json.dumps(TAXO["age_bands"], ensure_ascii=False)
    msg = [{"role": "system", "content":
            "Eres un arquitecto curricular experto en finanzas/impuestos/negocios MX y US. Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"País={country} dominio={domain} subdominio={subdomain}. "
            f"{POLICY['completeness']['critic_prompt_hint']} "
            f"Propón una lista EXHAUSTIVA y PROFUNDA de documentos (mínimo {POLICY['depth']['min_docs_per_subdomain']}) "
            f"para cubrir este subdominio a nivel experto, cada uno con un ángulo distinto "
            f"(básico, mecánica, casos borde, trámites paso a paso, errores comunes, comparativa, cambios 2026). "
            f"Tiers de edad disponibles (techo Piaget): {band_rules}. "
            'Devuelve {"topics":[{"slug":"kebab-case","title_es":"...","title_en":"...","angle":"...",'
            '"age_bands":["tier3","tier4","tier5"],"depth_tier":"intro|intermediate|advanced",'
            '"volatility":"static|low|medium|high","concept_id":"dotted.id"}]}'}]
    return qw.json(msg, model=MODELS["planner"], temperature=0.5).get("topics", [])


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
    ev_block = (
        "EVIDENCIA CURADA (extraída por NotebookLM de FUENTES PRIMARIAS oficiales). Fundamenta tu "
        "redacción y tus @fact PRIORITARIAMENTE en esta evidencia y cita esas URLs como fuentes. "
        f"Si un punto no está aquí, búscalo en la web:\n\n{evidence}\n\n===\n\n"
    ) if evidence else ""
    msg = [{"role": "system", "content":
            "Eres autor experto de contenido educativo bilingüe (ES canónico, EN fiel) de finanzas/impuestos, "
            "edades 5-18+, fundamentado en FUENTES PRIMARIAS (.gov/leyes) y actual a 2026-06-20. Devuelve SOLO JSON."},
           {"role": "user", "content":
            ev_block +
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
            "- NO mezcles jurisdicciones: nada de instrumentos del otro país como si aplicaran aquí.\n"
            f"- Usa fuentes REALES y ACTUALES (busca en la web); incluye >= 1 fuente PRIMARIA (.gov/ley) para hechos volátiles.{fix}\n\n"
            'Devuelve {"title_es":"...","title_en":"...","concept_ids":["..."],"age_bands":[...],'
            '"depth_tier":"...","volatility":"...",'
            '"sources":[{"url":"https://...","title":"...","publisher":"...","jurisdiction":"MX-FED|US-FED|NONE"}],'
            '"facts":[{"id":"dotted.id","value":"16%","volatility":"medium","source_index":0}],'
            '"body_es":"## For future Claude\\n...","body_en":"## For future Claude\\n..."}'}]
    return qw.json(msg, model=MODELS["author"], enable_search=MODELS["grounding_search"],
                   temperature=0.4, max_tokens=4000, timeout=180)


def q_judge(qw, country, es_text):
    bar = POLICY["quality_bar"]
    msg = [{"role": "system", "content":
            "Eres revisor crítico (no sello de goma) de contenido educativo financiero. Verifica hechos vs fuentes "
            "primarias (busca en la web). Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"País={country}. Evalúa este documento (1-5 por dimensión) y verifica sus cifras/reglas:\n\n{es_text[:6000]}\n\n"
            'Devuelve {"scores":{"factual_accuracy":n,"pedagogical_scaffolding":n,"country_correctness":n,'
            '"translation_fidelity":n,"engagement":n},"hard_fails":[...],"wrong_facts":[...],"verdict":"publish|revise"}'}]
    return qw.json(msg, model=MODELS["judge"], enable_search=MODELS["grounding_search"],
                   temperature=0.2, timeout=150)


def q_critic(qw, country, domain, subdomain, existing_slugs):
    msg = [{"role": "system", "content": "Eres crítico de completitud. Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"País={country} dominio={domain} subdominio={subdomain}. Ya existen estos documentos: {existing_slugs}.\n"
            f"{POLICY['completeness']['critic_prompt_hint']}\n"
            'Lista SOLO los temas que FALTAN (no repitas los existentes). '
            'Devuelve {"missing":[{"slug":"...","title_es":"...","title_en":"...","angle":"...",'
            '"age_bands":[...],"depth_tier":"...","volatility":"...","concept_id":"..."}]}'}]
    return qw.json(msg, model=MODELS["planner"], temperature=0.6).get("missing", [])


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


def _real_wrong(wrong):
    """Filtra falsos positivos del juez (Qwen-Flash a veces lista en wrong_facts hechos cuyo
    valor del doc COINCIDE con el correcto). Solo cuenta los que realmente difieren."""
    out = []
    for w in (wrong or []):
        if isinstance(w, dict):
            actual = str(w.get("actual_value", w.get("doc_value", ""))).strip().lstrip("$").replace(",", "")
            correct = str(w.get("expected_value", w.get("correct_value", ""))).strip().lstrip("$").replace(",", "")
            if actual and correct and actual == correct:
                continue  # coinciden → no es error
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
    if es_path.exists():
        return "exists"

    bar = POLICY["quality_bar"]
    feedback, last_issue = "", ""
    evidence = load_evidence(country, domain) if POLICY["run"]["grounding_backend"] in ("hybrid", "notebooklm") else ""
    u0 = dict(qw.usage)
    for attempt in range(bar["max_revise_rounds"] + 1):
        payload = q_author(qw, country, domain, subdomain, topic, feedback, evidence=evidence)
        src_ids, fact_src = _register_payload_sources(reg, payload, country)
        if not src_ids:
            feedback = "No devolviste fuentes. Incluye fuentes REALES (>=1 primaria .gov) y regenera."
            last_issue = "no_sources"
            continue
        es_path.write_text(assemble_doc(country, domain, subdomain, slug, "es", payload, src_ids, fact_src), encoding="utf-8")
        en_doc = assemble_doc(country, domain, subdomain, slug, "en", payload, src_ids, fact_src)
        en_path.write_text(en_doc, encoding="utf-8")
        es_doc = es_path.read_text(encoding="utf-8")

        ok, errs = run_gate(f"{country}/{domain}/{subdomain}")
        if not ok:
            feedback = "Corrige estos errores del GATE y regenera: " + " | ".join(errs)[:600]
            last_issue = "gate:" + (errs[0] if errs else "")[:80]
            continue

        try:
            judged = q_judge(qw, country, es_doc)
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
        _log({"doc_id": f"{country}-{domain}-{subdomain}-{slug}", "status": "review",
              "scores": sc, "spent": spent})
        return f"built_ok(scores={sc})"

    # rondas agotadas con problemas → conservar como draft + registrar
    if es_path.exists():
        for p in (es_path, en_path):
            p.write_text(p.read_text(encoding="utf-8").replace("status: review", "status: draft", 1), encoding="utf-8")
    _log({"doc_id": f"{country}-{domain}-{subdomain}-{slug}", "status": "draft", "issue": last_issue})
    return f"needs_review({last_issue[:140]})"


# ─────────────────────── build one subdomain ───────────────────────
def build_subdomain(qw, reg, country, domain, subdomain, max_docs=None):
    if corpus_size_mb() >= POLICY["targets"]["total_size_mb"]:
        return {}
    subdir = KB / country / domain / subdomain
    existing = sorted(p.name[:-6] for p in subdir.glob("*.es.md")) if subdir.exists() else []
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
            if max_docs and produced >= max_docs:
                return results
            results[t["slug"]] = build_topic(qw, reg, country, domain, subdomain, t)
            print(f"  [{country}/{domain}/{subdomain}] {t['slug']}: {results[t['slug']]}", flush=True)
        rounds += 1
        have = existing + list(results.keys())
        if len(have) < POLICY["depth"]["min_docs_per_subdomain"] or dry < POLICY["completeness"]["dry_rounds_to_stop"]:
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
    print(f"Tamaño corpus: {corpus_size_mb():.2f} MB / meta {POLICY['targets']['total_size_mb']} MB")
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
    args = ap.parse_args()

    if args.status:
        status(); return 0

    qw = Qwen()
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
    jobs = []
    for c in POLICY["coverage"]["countries"]:
        domains = POLICY["coverage"]["shared_domains"] if c == "shared" else list(TAXO["domains"].keys())
        for d in domains:
            if d not in TAXO["domains"]:
                continue
            for s in TAXO["domains"][d]["subdomains"]:
                jobs.append((c, d, s))
    return jobs


def run_all(qw, reg, workers, max_docs):
    jobs = all_jobs()
    target = POLICY["targets"]["total_size_mb"]
    print(f"Cobertura: {len(jobs)} subdominios · meta {target} MB · workers={workers}", flush=True)

    def work(job):
        if corpus_size_mb() >= target:
            return
        c, d, s = job
        print(f"== {c}/{d}/{s} ==", flush=True)
        try:
            build_subdomain(qw, reg, c, d, s, max_docs=max_docs)
        except Exception as e:                       # un subdominio que falle NO tumba la corrida
            print(f"  !! error en {c}/{d}/{s}: {e}", flush=True)

    if workers <= 1:
        for j in jobs:
            if corpus_size_mb() >= target:
                print("META DE TAMAÑO ALCANZADA.", flush=True)
                break
            work(j)
    else:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(work, jobs))
    status()
    print(f"usage total={qw.usage}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
