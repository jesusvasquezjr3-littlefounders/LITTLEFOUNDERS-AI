#!/usr/bin/env python3
"""
gate_kb.py — Gate DETERMINISTA del cerebro de conocimiento (Fase 3).

Valida cada doc markdown del corpus contra el contrato `_meta/` y las reglas duras:
  · frontmatter completo + enums válidos (schema.json + taxonomy.yaml)
  · doc_id == path; language == sufijo de archivo; pareja es/en consistente
  · country/jurisdiction/currency coherentes con la carpeta
  · domain/subdomain en el vocabulario cerrado
  · cada source citado existe; volatility>=medium exige >=1 fuente tier:primary
  · last_verified_date no futura; review_due presente para no-static
  · @fact sentinels bien formados; su `src` coincide en jurisdicción con el doc (anti-fuga)
  · vocabulario PROHIBIDO por tier en secciones de edad temprana (techo Piaget = HARD-FAIL)

Uso:
  python3 tools/gate_kb.py                 # valida todo el corpus
  python3 tools/gate_kb.py mx/taxes        # valida un subárbol
  python3 tools/gate_kb.py --warnings      # trata advisories como fallo también

Salida: exit 0 si verde; 1 si algún HARD-FAIL. Las advisories no rompen (salvo --warnings).
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent           # .../knowledge
META = KB / "_meta"
CORPUS_DIRS = ("shared", "mx", "us")


def _anchor():
    try:
        bp = yaml.safe_load((KB / "_meta" / "build_policy.yaml").read_text())
        return dt.date.fromisoformat(bp["content_conventions"]["date_anchor"])
    except Exception:
        return dt.date(2026, 6, 20)


TODAY = _anchor()                                      # ancla "as of" (= build_policy date_anchor)

TAXO = yaml.safe_load((META / "taxonomy.yaml").read_text(encoding="utf-8"))


def _load_sources() -> dict:
    """Carga sources.yaml tolerando un TORN-READ concurrente: durante el build, 8 workers hacen append a
    este archivo mientras cada gate corre como subproceso y lo re-parsea. Si lo lee a mitad de un append el
    YAML queda inválido; reintentamos brevemente en vez de reventar (el orquestador interpretaría el crash
    como 'fallo de contenido' y quemaría una ronda pagada del autor). Ver build_dataset.run_gate."""
    import time as _t
    last = None
    for _ in range(5):
        try:
            return (yaml.safe_load((META / "sources.yaml").read_text(encoding="utf-8")) or {}).get("sources", {}) or {}
        except Exception as e:                 # YAML truncado a media escritura → reintentar
            last = e
            _t.sleep(0.15)
    raise last


SOURCES = _load_sources()
VPOL = yaml.safe_load((META / "volatility_policy.yaml").read_text(encoding="utf-8"))["cadences"]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from facts_table import load_facts, values_match  # noqa: E402
# Tabla CANÓNICA: solo hechos verificados Y enforce!=false (valores escalares comparables).
# El gate exige que cada @fact cuyo id esté aquí tenga EXACTAMENTE este valor (verdad de base).
CANON = {k: v for k, v in load_facts(verified_only=True).items() if v.get("enforce", True)}
# Universo COMPLETO de ids declarados en facts.yaml (incluye enforce:false). Un @fact cuyo id NO
# esté aquí es "off-table": el gate NO puede comparar su valor → es la fuga de #1 (escape de ids).
ALL_FACT_IDS = set(load_facts().keys())

# ── Anti-escape-de-ids (v4): detectar un @fact OFF-TABLE que DUPLICA una cantidad canónica con otro id.
# El autor podía escribir `irs.2025.std_deduction.single=$14,600` (rancio) en vez del canónico
# `us.std_deduction.single=16,100 USD` y pasar sin chequeo. Reducimos cada id a sus tokens de CONCEPTO
# (sin prefijos de jurisdicción/agencia ni años) y, si coincide EXACTO con un canónico de la misma
# jurisdicción, exigimos el id canónico (HARD-FAIL). Conservador: solo colisión exacta → 0 falsos+.
_ID_DROP = {"us", "mx", "shared", "irs", "sat", "ssa", "fed", "dof", "l", "the", "rev", "proc", "pub"}
_YEAR_RE = re.compile(r"^\d{4}$")


def _concept_tokens(fid: str) -> frozenset:
    toks = re.split(r"[._\-]+", str(fid).lower())
    return frozenset(t for t in toks if t and t not in _ID_DROP and not _YEAR_RE.match(t))


# (jurisdicción, tokens-de-concepto) -> [(id_canónico, valor)]  para detectar duplicación de cantidad
CANON_BY_JC: dict = {}
for _cid, _cf in CANON.items():
    CANON_BY_JC.setdefault((_cf.get("jurisdiction"), _concept_tokens(_cid)), []).append((_cid, _cf["value"]))

STRICT_FACTS = False   # --strict-facts: todo @fact volátil OFF-TABLE pasa de advisory a HARD-FAIL
STRICT_NUMERALS = False  # --strict-numerals: numerales oficiales no-anclados en ejemplos → HARD-FAIL (D1)

JURIS_BY_COUNTRY = {"mx": "MX-FED", "us": "US-FED", "shared": "NONE"}
CURRENCY_BY_COUNTRY = {"mx": "MXN", "us": "USD", "shared": None}
REQUIRED = [
    "doc_id", "title_es", "title_en", "language", "translation_of", "country",
    "jurisdiction", "domain", "subdomain", "concept_ids", "age_bands", "depth_tier",
    "volatility", "last_verified_date", "verified_by", "review_due", "sources",
    "status", "currency", "schema_version",
]
FACT_RE = re.compile(r"<!--\s*@fact\s+(.*?)-->", re.S)
SECTION_RE = re.compile(r"<!--\s*age_band:\s*([a-z0-9, ]+?)\s*-->")

# ── D1: numerales oficiales NO-anclados en secciones de ejemplo/cálculo (riesgo H2: tramo/umbral del
# año equivocado que ni el gate (solo @fact) ni el verificador NLI (illustrative/unverifiable) tocan).
_EXAMPLE_HEAD_RE = re.compile(
    r"^(?:#{1,6}\s+|\*\*\s*)?(worked\s+example|ejemplo\s+trabajado|ejemplo\s+ilustrativo|"
    r"illustrative\s+example|how\s+it(?:'s| is)?\s+(?:calculated|work|computed)|"
    r"c[óo]mo\s+(?:se\s+)?calc|c[óo]mo\s+funciona|example\s+calcul|c[áa]lculo\s+del)",
    re.I | re.M,
)
# Numeral "oficial": umbral $ con separador de miles, o tasa %. (Enteros pequeños/round no lo son.)
_NUMERAL_RE = re.compile(r"(\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d{1,2}(?:\.\d{1,2})?\s*%)")
_RATE_CUE_RE = re.compile(r"\b(rate|tasa|marginal|bracket|tramo|grava|taxed\s+at|impuesto)\b", re.I)
_ACTOR_INCOME_RE = re.compile(
    r"\b(earns|gana|reporta|reports|recibe|receives|ingresos?|income|salary|salario|sueldo|"
    r"wages|withheld|retuvo|retenido|retention)\b", re.I)
_DERIVED_BEFORE_RE = re.compile(r"[=→]\s*\$?\s?$")           # numeral precedido por = o → (resultado)
_OPERAND_BEFORE_RE = re.compile(r"[−\-\×\+]\s*\$?$")          # numeral precedido por operador (operando)
_OPERAND_AFTER_RE = re.compile(r"^\s*[−\-\×\+]")              # numeral seguido de operador (operando)


def _num_matches_anchor(numeral: str, anchor_val: str) -> bool:
    """¿El numeral de la prosa coincide con un valor @fact anclado (ya validado por el gate)? Compara
    dígitos + unidad (% vs $/USD/MXN) para no re-reportar lo que el gate ya garantiza."""
    n = re.sub(r"[^\d.]", "", numeral)
    a = re.sub(r"[^\d.]", "", anchor_val)
    if not n or n != a:
        return False
    return ("%" in numeral) == ("%" in anchor_val)


def forbidden_for(tiers: list[str]) -> set[str]:
    out: set[str] = set()
    for t in tiers:
        out |= set(TAXO["age_bands"].get(t, {}).get("forbidden", []) or [])
    return out


def parse_frontmatter(text: str):
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    fm = yaml.safe_load(text[3:end])
    body = text[end + 4:]
    return fm, body


def expected_doc_id(rel: Path) -> str:
    # mx/taxes/consumption_tax/iva-basics.es.md -> mx-taxes-consumption_tax-iva-basics
    stem = rel.name
    for suf in (".es.md", ".en.md"):
        if stem.endswith(suf):
            stem = stem[: -len(suf)]
            break
    parts = list(rel.parent.parts) + [stem]
    return "-".join(parts)


def parse_fact(attrs: str) -> dict:
    out = {}
    for m in re.finditer(r"(\w+)=(\"[^\"]*\"|\S+)", attrs):
        out[m.group(1)] = m.group(2).strip('"')
    return out


def facts_in(body: str) -> dict:
    """{fact_id: value} de los @fact de un cuerpo (para paridad ES/EN)."""
    out = {}
    for m in FACT_RE.finditer(body):
        f = parse_fact(m.group(1))
        if "id" in f and "value" in f:
            out[f["id"]] = f["value"]
    return out


class Doc:
    def __init__(self, path: Path):
        self.path = path
        self.rel = path.relative_to(KB)
        self.errors: list[str] = []
        self.warns: list[str] = []
        self.offtable = 0          # @facts cuyo id no está en facts.yaml (no comparables por el gate)
        self.nunanchored = 0       # numerales oficiales no-anclados en ejemplos (D1)
        text = path.read_text(encoding="utf-8")
        self.fm, self.body = parse_frontmatter(text)

    def err(self, m): self.errors.append(m)
    def warn(self, m): self.warns.append(m)

    def validate(self):
        fm = self.fm
        if fm is None:
            self.err("frontmatter YAML ausente o malformado")
            return
        # 1. claves requeridas
        for k in REQUIRED:
            if k not in fm:
                self.err(f"falta clave requerida: {k}")
        if self.errors:
            return
        # 2. enums
        if fm["schema_version"] != "kb-1.0":
            self.err(f"schema_version inválido: {fm['schema_version']}")
        if fm["country"] not in TAXO["countries"]:
            self.err(f"country inválido: {fm['country']}")
        if fm["language"] not in TAXO["languages"]:
            self.err(f"language inválido: {fm['language']}")
        if fm["depth_tier"] not in TAXO["depth_tiers"]:
            self.err(f"depth_tier inválido: {fm['depth_tier']}")
        if fm["volatility"] not in TAXO["volatility_levels"]:
            self.err(f"volatility inválido: {fm['volatility']}")
        if fm["status"] not in TAXO["statuses"]:
            self.err(f"status inválido: {fm['status']}")
        bands = fm["age_bands"] or []
        for b in bands:
            if b not in TAXO["age_bands"]:
                self.err(f"age_band inválido: {b}")
        # 3. domain / subdomain
        dom = TAXO["domains"].get(fm["domain"])
        if not dom:
            self.err(f"domain fuera de vocabulario: {fm['domain']}")
        elif fm["subdomain"] not in dom["subdomains"]:
            self.err(f"subdomain '{fm['subdomain']}' no pertenece a domain '{fm['domain']}'")
        # 4. country/jurisdiction/currency/path coherentes
        top = self.rel.parts[0]
        if top != fm["country"]:
            self.err(f"carpeta '{top}' no coincide con country '{fm['country']}'")
        if fm["jurisdiction"] != JURIS_BY_COUNTRY[fm["country"]]:
            self.err(f"jurisdiction '{fm['jurisdiction']}' incoherente con country '{fm['country']}' (esperado {JURIS_BY_COUNTRY[fm['country']]})")
        if fm["currency"] != CURRENCY_BY_COUNTRY[fm["country"]]:
            self.err(f"currency '{fm['currency']}' incoherente con country '{fm['country']}'")
        # 5. doc_id == path; language == sufijo
        exp_id = expected_doc_id(self.rel)
        if fm["doc_id"] != exp_id:
            self.err(f"doc_id '{fm['doc_id']}' != esperado por path '{exp_id}'")
        lang_suffix = "es" if self.path.name.endswith(".es.md") else ("en" if self.path.name.endswith(".en.md") else "?")
        if fm["language"] != lang_suffix:
            self.err(f"language '{fm['language']}' != sufijo de archivo '{lang_suffix}'")
        # 6. translation_of
        if fm["language"] == "es" and fm["translation_of"] is not None:
            self.err("doc .es debe tener translation_of: null")
        if fm["language"] == "en" and fm["translation_of"] != exp_id:
            self.err(f"doc .en debe tener translation_of == '{exp_id}' (got {fm['translation_of']})")
        # 7. sources existen + primaria si volátil
        cited = fm["sources"] or []
        tiers = []
        for sid in cited:
            s = SOURCES.get(sid)
            if not s:
                self.err(f"source citado no existe en sources.yaml: {sid}")
            else:
                tiers.append(s["tier"])
        if fm["volatility"] in ("medium", "high") and "primary" not in tiers:
            self.err(f"volatility={fm['volatility']} exige >=1 fuente tier:primary (citadas: {tiers or 'ninguna'})")
        # 8. fechas
        lvd = fm["last_verified_date"]
        lvd_d = lvd if isinstance(lvd, dt.date) else dt.date.fromisoformat(str(lvd))
        if lvd_d > TODAY:
            self.err(f"last_verified_date en el futuro: {lvd_d}")
        cad = VPOL.get(fm["volatility"])
        if cad is None:
            if fm["review_due"] not in (None, "null"):
                self.warn(f"volatility=static normalmente review_due: null (got {fm['review_due']})")
        else:
            if not fm["review_due"]:
                self.err(f"volatility={fm['volatility']} exige review_due (cadencia {cad})")
            else:
                rd = fm["review_due"] if isinstance(fm["review_due"], dt.date) else dt.date.fromisoformat(str(fm["review_due"]))
                if rd <= lvd_d:
                    self.err(f"review_due {rd} debe ser posterior a last_verified_date {lvd_d}")
        # 9. @fact sentinels + anti-fuga de jurisdicción
        doc_juris = fm["jurisdiction"]
        for m in FACT_RE.finditer(self.body):
            f = parse_fact(m.group(1))
            if "src" not in f or "value" not in f:
                self.warn(f"@fact incompleto (falta src/value): {m.group(1)[:60]}")
                continue
            s = SOURCES.get(f["src"])
            if not s:
                self.err(f"@fact cita source inexistente: {f['src']}")
                continue
            if doc_juris != "NONE" and s["jurisdiction"] not in (doc_juris, "NONE"):
                self.err(f"FUGA: @fact en doc {doc_juris} cita fuente {s['jurisdiction']} ({f['src']})")
            if f.get("volatility") == "high" and s["tier"] != "primary":
                self.warn(f"@fact volatility=high debería citar primaria: {f['src']} (tier {s['tier']})")
            # 9b. comparación contra la TABLA CANÓNICA (verdad de base DETERMINISTA)
            fid = f.get("id")
            cf = CANON.get(fid)
            if cf:
                if doc_juris != "NONE" and cf["jurisdiction"] not in (doc_juris, "NONE"):
                    self.err(f"FUGA: @fact {fid} canónico es {cf['jurisdiction']} en doc {doc_juris}")
                if not values_match(f.get("value", ""), cf["value"]):
                    self.err(f"FACT MISMATCH: @fact {fid} value '{f.get('value')}' "
                             f"!= canónico '{cf['value']}' (facts.yaml)")
            # 9c. @fact OFF-TABLE (id no declarado en facts.yaml) — la fuga de #1. El gate NO valida su
            # valor. Si DUPLICA exacto una cantidad canónica de la misma jurisdicción con otro id → HARD.
            elif fid and fid not in ALL_FACT_IDS:
                self.offtable += 1
                shadows = CANON_BY_JC.get((doc_juris, _concept_tokens(fid))) if doc_juris != "NONE" else None
                if shadows and len(shadows) == 1:
                    cid, cval = shadows[0]
                    self.err(f"@fact OFF-TABLE '{fid}'='{f.get('value')}' DUPLICA la cantidad canónica "
                             f"'{cid}'='{cval}' con otro id → usa el id canónico (la tabla no pudo validarlo)")
                elif STRICT_FACTS and f.get("volatility") in ("medium", "high"):
                    self.err(f"@fact OFF-TABLE volátil '{fid}'='{f.get('value')}' sin entrada en facts.yaml "
                             f"(--strict-facts): añádelo a la tabla canónica o usa un id canónico")
                else:
                    self.warn(f"@fact off-table '{fid}'='{f.get('value')}' no está en facts.yaml — "
                              f"el gate NO valida su valor; SME debe verificarlo o anclarlo a la tabla")
        # 10. vocabulario prohibido en secciones de edad temprana
        self._check_forbidden_vocab()
        # 11. D1: numerales oficiales no-anclados en ejemplos trabajados (riesgo H2: año equivocado)
        self._check_unanchored_numerals()

    def _check_forbidden_vocab(self):
        # secciones marcadas con <!-- age_band: tierX,tierY -->
        marks = list(SECTION_RE.finditer(self.body))
        if not marks:
            return
        for i, m in enumerate(marks):
            tiers = [t.strip() for t in m.group(1).split(",") if t.strip()]
            start = m.end()
            end = marks[i + 1].start() if i + 1 < len(marks) else len(self.body)
            section = self.body[start:end].lower()
            for word in forbidden_for(tiers):
                if re.search(rf"\b{re.escape(word.lower())}\b", section):
                    self.err(f"vocabulario PROHIBIDO '{word}' en sección {tiers} (techo Piaget)")

    def _check_unanchored_numerals(self):
        # D1: numerales oficiales (tasas %, umbrales $, tramos) en secciones de ejemplo/cálculo que NO
        # son @fact (el gate ya los validó contra facts.yaml) ni resultados derivados (=, →). Cierra H2:
        # un tramo del año equivocado en un ejemplo trabajado se cuela porque ni el gate (solo @fact) ni
        # el verificador NLI (lo marca illustrative/unverifiable y no cuenta en el factscore) lo alcanzan.
        marks = list(_EXAMPLE_HEAD_RE.finditer(self.body))
        if not marks:
            return
        anchored = set()
        for m in FACT_RE.finditer(self.body):
            f = parse_fact(m.group(1))
            if "value" in f and f.get("id") in ALL_FACT_IDS:
                anchored.add(f["value"].strip())
        seen = set()
        for i, mk in enumerate(marks):
            start = mk.end()
            end = marks[i + 1].start() if i + 1 < len(marks) else len(self.body)
            for line in self.body[start:end].split("\n"):
                actor_line = bool(_ACTOR_INCOME_RE.search(line))
                for nm in _NUMERAL_RE.finditer(line):
                    numeral = nm.group(1).strip()
                    if any(_num_matches_anchor(numeral, v) for v in anchored):
                        continue
                    before = re.sub(r"[*_]", "", line[max(0, nm.start() - 6):nm.start()])
                    after = re.sub(r"[*_]", "", line[nm.end():nm.end() + 4])
                    if _DERIVED_BEFORE_RE.search(before):       # resultado de un cálculo (=, →)
                        continue
                    is_rate = "%" in numeral
                    if is_rate:
                        if not _RATE_CUE_RE.search(line):       # tasa sin contexto de tasa = ruido
                            continue
                    else:
                        if actor_line:                          # ingreso hipotético del actor
                            continue
                        if _OPERAND_BEFORE_RE.search(before) or _OPERAND_AFTER_RE.search(after):
                            continue                            # operando aritmético (no cifra oficial)
                    key = (numeral, is_rate)
                    if key in seen:
                        continue
                    seen.add(key)
                    self.nunanchored += 1
                    msg = (f"numeral oficial NO-anclado en ejemplo: '{numeral}' "
                           f"(no es @fact → el gate NO valida su valor/año). "
                           f"Línea: {line.strip()[:80]}")
                    if STRICT_NUMERALS:
                        self.err(msg)
                    else:
                        self.warn(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subtree", nargs="?", default="", help="subárbol a validar (ej. mx/taxes)")
    ap.add_argument("--warnings", action="store_true", help="advisories también rompen")
    ap.add_argument("--strict-facts", action="store_true",
                    help="todo @fact volátil OFF-TABLE (id no en facts.yaml) es HARD-FAIL, no advisory")
    ap.add_argument("--strict-numerals", action="store_true",
                    help="numerales oficiales no-anclados en ejemplos (D1) son HARD-FAIL, no advisory")
    args = ap.parse_args()
    global STRICT_FACTS, STRICT_NUMERALS
    STRICT_FACTS = args.strict_facts
    STRICT_NUMERALS = args.strict_numerals

    roots = [KB / args.subtree] if args.subtree else [KB / d for d in CORPUS_DIRS]
    files = sorted(p for r in roots if r.exists() for p in r.rglob("*.md")
                   if not p.name.startswith("_") and p.name != "README.md")
    if not files:
        print("⚠️  No se encontraron docs markdown en el corpus.")
        return 0

    docs = [Doc(p) for p in files]
    n_err = n_warn = 0
    # pareja es/en: cada doc_id debe tener exactamente un .es
    es_ids: dict[str, int] = {}
    for d in docs:
        d.validate()
        if d.fm and d.fm.get("language") == "es":
            es_ids[d.fm.get("doc_id", str(d.rel))] = es_ids.get(d.fm.get("doc_id", ""), 0) + 1
    for d in docs:
        if d.fm and d.fm.get("language") == "en":
            did = d.fm.get("doc_id")
            if did not in es_ids:
                d.err(f"doc .en sin par .es canónico (doc_id {did})")

    # paridad de @fact ES/EN: una cifra no debe divergir entre idiomas (modo de fallo crítico bilingüe)
    en_by_id = {d.fm["doc_id"]: d for d in docs
                if d.fm and d.fm.get("language") == "en" and "doc_id" in d.fm}
    for d in docs:
        if d.fm and d.fm.get("language") == "es":
            en = en_by_id.get(d.fm.get("doc_id"))
            if not en:
                continue
            es_facts, en_facts = facts_in(d.body), facts_in(en.body)
            # PARIDAD de PRESENCIA: un @fact tagueado en un idioma DEBE estarlo en el otro. Sin esto, un
            # número volátil/rancio podía vivir SÓLO en la prosa EN (canónica para US) sin que el gate lo
            # comparara contra facts.yaml (chequeo vacuo). La paridad de VALOR ya estaba; faltaba la de SET.
            missing_en = sorted(set(es_facts) - set(en_facts))
            missing_es = sorted(set(en_facts) - set(es_facts))
            if missing_en:
                en.err(f"paridad @fact: ids presentes en ES ausentes en EN: {missing_en}")
            if missing_es:
                en.err(f"paridad @fact: ids presentes en EN ausentes en ES: {missing_es}")
            for fid, ves in es_facts.items():
                ven = en_facts.get(fid)
                if ven is not None and not values_match(ves, ven):
                    en.err(f"@fact {fid} difiere ES('{ves}') vs EN('{ven}')")

    for d in docs:
        if d.errors:
            n_err += len(d.errors)
            print(f"\n✗ {d.rel}")
            for e in d.errors:
                print(f"    HARD: {e}")
        for w in d.warns:
            n_warn += 1
            print(f"  ~ {d.rel}: {w}")

    n_offtable = sum(d.offtable for d in docs)
    n_unanchored = sum(d.nunanchored for d in docs)
    n_facts_total = n_offtable + sum(
        1 for d in docs for m in FACT_RE.finditer(d.body)
        if (parse_fact(m.group(1)).get("id") in ALL_FACT_IDS))
    print(f"\n{'='*60}")
    print(f"Docs: {len(docs)} | HARD-FAILs: {n_err} | advisories: {n_warn}")
    if n_facts_total:
        anchored = n_facts_total - n_offtable
        print(f"@fact anclados a facts.yaml: {anchored}/{n_facts_total} "
              f"({100*anchored//n_facts_total}%) | OFF-TABLE (sin validar): {n_offtable}")
    if n_unanchored:
        print(f"Numerales oficiales NO-anclados en ejemplos (D1): {n_unanchored} "
              f"(advisory; --strict-numerals los hace HARD)")
    failed = n_err > 0 or (args.warnings and n_warn > 0)
    print("GATE: " + ("❌ FALLÓ" if failed else "✅ VERDE"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
