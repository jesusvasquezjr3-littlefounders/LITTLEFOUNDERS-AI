#!/usr/bin/env python3
"""
build_evidence.py — capa de GROUNDING CURADO (NotebookLM) del pipeline híbrido.

Por cada (país, dominio): crea/reusa un notebook de NotebookLM, siembra las fuentes
autoritativas (.gov/leyes de _meta/sources.yaml por jurisdicción) + investigación profunda
opcional, espera a que indexen, y extrae el `fulltext` a un CACHÉ LOCAL de evidencia:

    knowledge/evidence/<country>/<domain>/<src_id>.md

Ese caché es lo que el AUTOR (Qwen-Flash, en build_dataset.py) usa para fundamentar la
redacción y los @fact — máxima fidelidad a fuente primaria, sin que NotebookLM esté en la
ruta crítica de CADA documento (solo se usa una vez por dominio).

· Idempotente: si ya hay evidencia para (país,dominio), no la regenera.
· Tolerante a fallos: si NotebookLM falla, registra y continúa (el autor cae a qwen_search).
· La evidencia es texto fuente con copyright → gitignored (`evidence/`), NO se publica.

Requiere venv recreado con notebooklm-py[browser] + auth válida (ver skills/notebooklm-py/SKILL.md).

Uso:
  python3 tools/build_evidence.py --auth                       # verifica credenciales
  python3 tools/build_evidence.py --only mx/taxes              # un (país,dominio)
  python3 tools/build_evidence.py --all                        # todos (lento, horas)
  python3 tools/build_evidence.py --only mx/taxes --no-research  # solo fuentes sembradas
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent
BRAIN = KB.parent                                  # rag-llm-brain/
NB_BIN = BRAIN / ".venv" / "bin" / "notebooklm"
STORAGE = BRAIN / ".notebooklm" / "storage_state.json"
META = KB / "_meta"
EVIDENCE = KB / "evidence"
TAXO = yaml.safe_load((META / "taxonomy.yaml").read_text())
SOURCES = yaml.safe_load((META / "sources.yaml").read_text())["sources"]
JURIS = {"mx": "MX-FED", "us": "US-FED", "shared": "NONE"}


def nb(*args, timeout=600, json_out=False):
    cmd = [str(NB_BIN), "--storage", str(STORAGE), *args]
    if json_out:
        cmd.append("--json")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        sys.exit(f"❌ No existe {NB_BIN}. Recrea el venv con notebooklm-py[browser].")
    except subprocess.TimeoutExpired:
        print(f"⚠️  timeout: notebooklm {' '.join(args[:3])}", file=sys.stderr)
        return None
    if r.returncode != 0:
        print(f"⚠️  fallo notebooklm {' '.join(args[:3])}: {r.stderr.strip()[:200]}", file=sys.stderr)
        return None
    if json_out:
        try:
            return json.loads(r.stdout)
        except json.JSONDecodeError:
            return None
    return r.stdout.strip()


def check_auth() -> bool:
    out = nb("auth", "check", "--test", json_out=True, timeout=120)
    ok = bool(out and out.get("status") == "ok" and out.get("checks", {}).get("token_fetch"))
    print("✅ NotebookLM auth OK" if ok else
          "❌ auth inválida → ./.venv/bin/notebooklm login --browser chrome --storage .notebooklm/storage_state.json")
    return ok


def seed_urls(country):
    juris = JURIS[country]
    return [(sid, s) for sid, s in SOURCES.items()
            if s.get("url") and s["tier"] == "primary" and s["jurisdiction"] in (juris, "NONE")]


def research_query(country, domain):
    label = TAXO["domains"].get(domain, {}).get("label", domain)
    place = {"mx": "México", "us": "Estados Unidos", "shared": "(conceptos universales)"}[country]
    return (f"Fuentes oficiales y autoritativas sobre {label} en {place}, actualizadas a 2026: "
            f"leyes, reguladores, guías de gobierno, tasas y procedimientos vigentes.")


def ingest(country, domain, do_research=True):
    out_dir = EVIDENCE / country / domain
    if out_dir.exists() and any(out_dir.glob("*.md")):
        print(f"  ✓ evidencia ya existe: {country}/{domain} ({len(list(out_dir.glob('*.md')))} archivos)")
        return "exists"
    out_dir.mkdir(parents=True, exist_ok=True)

    created = nb("create", f"ev-{country}-{domain}", json_out=True)
    if not created:
        return "nb_create_failed"
    nbid = created["notebook"]["id"]

    # 1) sembrar fuentes primarias curadas  (-n/--notebook va DESPUÉS del subcomando)
    for sid, s in seed_urls(country):
        nb("source", "add", s["url"], "-n", nbid, json_out=True, timeout=120)
    # 2) investigación profunda (descubre fuentes adicionales)
    if do_research:
        nb("source", "add-research", research_query(country, domain),
           "--mode", "deep", "--no-wait", "-n", nbid, timeout=120)
        nb("research", "wait", "-n", nbid, "--import-all", "--timeout", "1800", timeout=1900)

    # 3) esperar indexado (poll a source list) y extraer fulltext → caché
    srcs, waited = [], 0
    while waited < 600:
        listing = nb("source", "list", "-n", nbid, json_out=True, timeout=120) or {}
        srcs = listing.get("sources", [])
        if srcs and all(s.get("status") in ("ready", "error") for s in srcs):
            break
        time.sleep(20)
        waited += 20
    n = 0
    for src in srcs:
        if src.get("status") != "ready":
            continue
        ft = nb("source", "fulltext", src["id"], "-n", nbid, json_out=True, timeout=180)
        if ft and ft.get("content"):
            h = hashlib.md5((ft.get("url") or src["id"]).encode()).hexdigest()[:8]
            (out_dir / f"src_{h}.md").write_text(
                f"# {ft.get('title','')}\nURL: {ft.get('url','')}\n\n{ft['content'][:20000]}",
                encoding="utf-8")
            n += 1
    print(f"  → {country}/{domain}: {n} fuentes en caché (notebook {nbid})")
    return f"cached:{n}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--auth", action="store_true")
    ap.add_argument("--only", metavar="country/domain")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--no-research", action="store_true")
    args = ap.parse_args()

    if args.auth:
        return 0 if check_auth() else 1
    if not check_auth():
        return 1

    do_research = not args.no_research
    if args.only:
        c, d = args.only.split("/")
        print(ingest(c, d, do_research))
        return 0
    if args.all:
        for c in ("shared", "mx", "us"):
            doms = (["taxes", "personal_finance", "accounting", "economics", "investing", "entrepreneurship"]
                    if c == "shared" else list(TAXO["domains"].keys()))
            for d in doms:
                print(f"== {c}/{d} ==", flush=True)
                ingest(c, d, do_research)
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
