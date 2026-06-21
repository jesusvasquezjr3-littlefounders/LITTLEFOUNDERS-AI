#!/usr/bin/env python3
"""
build_concept_map.py — EL ESPINAZO DE CONOCIMIENTO (knowledge spine) para cobertura ENCICLOPEDIA.

Deriva, por celda (país/dominio/subdominio), el espacio EXHAUSTIVO de temas que una enciclopedia
completa tendría — la definición operativa de "TODO el conocimiento". Lo persiste en
`_meta/concept_map.yaml` como ARTEFACTO medible y versionado (no efímero como el planner en runtime).

Por qué importa: convierte "capturar absolutamente todo" en algo CONCRETO y MEDIBLE:
  · el orquestador genera CONTRA el mapa (determinista, completo, reanudable),
  · la cobertura = docs generados / temas del mapa (medible, no por conteo ciego),
  · el STOP por cobertura = "100% del mapa cubierto".

Motor: DeepSeek V4 (el planner del pipeline) con un prompt de ENUMERACIÓN EXHAUSTIVA + un crítico de
completitud agresivo (loop-until-dry). No consume tokens de Claude. Barato (planner = rol más barato).

Uso:
  python3 tools/build_concept_map.py --only mx/taxes/income_tax   # una celda (prueba)
  python3 tools/build_concept_map.py --all --workers 8            # mapa completo (resumible)
  python3 tools/build_concept_map.py --status                     # tamaño del mapa por celda
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import yaml

# Los temas son objetos planos (sin llaves anidadas: age_bands es lista [...]). Esto permite EXTRAER
# cada tema completo aunque el array JSON venga TRUNCADO (DeepSeek razona y a veces corta la salida).
_OBJ_RE = re.compile(r"\{[^{}]*\}")


def _extract_topics(raw: str) -> list[dict]:
    out = []
    for m in _OBJ_RE.finditer(raw or ""):
        try:
            o = json.loads(m.group(0))
        except Exception:
            continue
        if isinstance(o, dict) and o.get("slug"):
            out.append(o)
    return out

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
META = KB / "_meta"
sys.path.insert(0, str(TOOLS))
import build_dataset as bd  # noqa: E402  (reusa planner client, all_jobs, TAXO, POLICY, write_atomic)

MAP_FILE = META / "concept_map.yaml"
MAX_TOPICS = 60          # techo por celda (evita runaway; una enciclopedia raramente excede esto por subtema)
MAX_CRITIC_ROUNDS = 5    # rondas de expansión del crítico de completitud
_LOCK = threading.Lock()

_AGE = ""
try:
    _AGE = yaml.safe_dump(bd.TAXO["age_bands"], allow_unicode=True)
except Exception:
    pass


def _enumerate(country, domain, subdomain) -> list[dict]:
    """Enumeración EXHAUSTIVA de temas para una celda (DeepSeek). Devuelve lista de dicts de tema."""
    neutral = ("REGLA: 'shared' es NEUTRO — SOLO conceptos universales (qué es, principios, matemática); "
               "NADA de instrumentos, leyes, cifras o nombres de un país (ni IVA/SAT/IRS/etc.). "
               if country == "shared" else "")
    sys_msg = ("Eres arquitecto ENCICLOPÉDICO experto en finanzas, negocios, economía, administración, "
               "contaduría e impuestos de México y EE.UU. Tu meta es COBERTURA TOTAL: enumerar "
               "EXHAUSTIVAMENTE todos los temas enseñables de un subdominio, como una enciclopedia o un "
               "'almacenamiento de conocimiento ante catástrofe' (que no falte NADA importante). Devuelve SOLO JSON.")
    user = (
        f"País={country} dominio={domain} subdominio={subdomain}.\n{neutral}"
        "Enumera TODOS los temas/documentos que una ENCICLOPEDIA COMPLETA tendría para este subdominio. "
        "Cubre EXHAUSTIVAMENTE: definiciones y fundamentos, mecánica y fórmulas, procedimientos paso a paso, "
        "marco legal/regulatorio, casos borde, errores comunes y mitos, comparativas, variantes/tipos, "
        "ejemplos numéricos, preguntas frecuentes, y cambios/tendencias recientes. NO te limites a lo básico: "
        "apunta a EXHAUSTIVIDAD enciclopédica (típicamente 15-40 temas según el subdominio; no inventes "
        "relleno trivial ni micro-nichos sin valor educativo).\n"
        f"Tiers de edad disponibles (techo Piaget):\n{_AGE}\n"
        'Devuelve {"topics":[{"slug":"kebab-case-unico","title_es":"...","title_en":"...","angle":"...",'
        '"age_bands":["tier3","tier4","tier5"],"depth_tier":"intro|intermediate|advanced",'
        '"volatility":"static|low|medium|high","concept_id":"dotted.id"}]}'
    )
    raw = bd._planner_client().chat(
        [{"role": "system", "content": sys_msg}, {"role": "user", "content": user}],
        model=bd.MODELS["planner"], json_mode=True, temperature=0.5, max_tokens=16000, timeout=300)
    return _extract_topics(raw)   # salvamento: recupera temas completos aunque el JSON venga truncado


def _critic(country, domain, subdomain, have_slugs) -> list[dict]:
    """Crítico de completitud: ¿qué temas IMPORTANTES faltan todavía? (para loop-until-dry)."""
    sys_msg = ("Eres crítico de completitud enciclopédica. Tu trabajo es encontrar HUECOS. Devuelve SOLO JSON.")
    user = (
        f"País={country} dominio={domain} subdominio={subdomain}. Ya tenemos estos temas: {sorted(have_slugs)}.\n"
        "¿Qué temas IMPORTANTES y enseñables FALTAN para cobertura ENCICLOPÉDICA TOTAL (no repitas los "
        "existentes; nada de relleno trivial)? Si no falta nada importante, devuelve {\"missing\":[]}.\n"
        'Devuelve {"missing":[{"slug":"...","title_es":"...","title_en":"...","angle":"...",'
        '"age_bands":[...],"depth_tier":"...","volatility":"...","concept_id":"..."}]}'
    )
    raw = bd._planner_client().chat(
        [{"role": "system", "content": sys_msg}, {"role": "user", "content": user}],
        model=bd.MODELS["planner"], json_mode=True, temperature=0.6, max_tokens=12000, timeout=300)
    return _extract_topics(raw)   # 'missing' son objetos-tema con slug → mismo salvamento


def build_cell(country, domain, subdomain) -> list[dict]:
    """Enumera + expande (loop-until-dry) los temas de una celda hasta agotar o tope."""
    topics: dict[str, dict] = {}
    for t in _enumerate(country, domain, subdomain):
        if t.get("slug"):
            topics[t["slug"]] = t
    dry = 0
    for _ in range(MAX_CRITIC_ROUNDS):
        if len(topics) >= MAX_TOPICS:
            break
        missing = _critic(country, domain, subdomain, set(topics))
        fresh = [t for t in missing if t.get("slug") and t["slug"] not in topics]
        if not fresh:
            dry += 1
            if dry >= 2:
                break
            continue
        dry = 0
        for t in fresh:
            topics[t["slug"]] = t
            if len(topics) >= MAX_TOPICS:
                break
    return list(topics.values())


def load_map() -> dict:
    if MAP_FILE.exists():
        return yaml.safe_load(MAP_FILE.read_text(encoding="utf-8")) or {}
    return {"schema_version": "kb-conceptmap-1.0", "cells": {}}


def save_map(m: dict):
    bd.write_atomic(MAP_FILE, yaml.safe_dump(m, allow_unicode=True, sort_keys=True, width=120))


def cmd_status(m: dict):
    cells = m.get("cells", {})
    total = sum(len(c.get("topics", [])) for c in cells.values())
    jobs = bd.all_jobs()
    done = sum(1 for (c, d, s) in jobs if f"{c}/{d}/{s}" in cells)
    print(f"Concept map: {done}/{len(jobs)} celdas mapeadas · {total} temas totales "
          f"(~{total/max(done,1):.1f} temas/celda)")
    for key in sorted(cells):
        print(f"  {key}: {len(cells[key].get('topics', []))} temas")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", metavar="C/D/S")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    m = load_map()
    m.setdefault("cells", {})

    if args.status:
        cmd_status(m); return 0

    if args.only:
        c, d, s = args.only.split("/")
        topics = build_cell(c, d, s)
        m["cells"][f"{c}/{d}/{s}"] = {"topics": topics}
        save_map(m)
        print(f"{args.only}: {len(topics)} temas → {MAP_FILE.relative_to(KB.parent)}")
        print(f"planner usage={bd._planner_client().usage}")
        return 0

    if args.all:
        jobs = [(c, d, s) for (c, d, s) in bd.all_jobs() if f"{c}/{d}/{s}" not in m["cells"]]
        print(f"Generando mapa para {len(jobs)} celdas faltantes (workers={args.workers})…", flush=True)

        def work(job):
            c, d, s = job
            try:
                topics = build_cell(c, d, s)
                with _LOCK:
                    m["cells"][f"{c}/{d}/{s}"] = {"topics": topics}
                    save_map(m)          # persistencia incremental (resumible)
                print(f"  {c}/{d}/{s}: {len(topics)} temas", flush=True)
            except Exception as e:
                print(f"  !! error en {c}/{d}/{s}: {e}", flush=True)

        if args.workers <= 1:
            for j in jobs:
                work(j)
        else:
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                list(ex.map(work, jobs))
        cmd_status(m)
        print(f"planner usage={bd._planner_client().usage}", flush=True)
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
