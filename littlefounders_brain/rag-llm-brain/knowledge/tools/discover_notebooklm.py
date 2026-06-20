#!/usr/bin/env python3
"""
discover_notebooklm.py — capa de DESCUBRIMIENTO/GROUNDING vía NotebookLM (fase de escalado).

NotebookLM es el "buscador" desechable del cerebro (BRAIN_STRATEGY.md §1). Este wrapper expone los
TRES verbos que importan, sobre el CLI `notebooklm` (notebooklm-py), con la copia de credenciales
in-folder y manejo de error con degradación elegante:

  1. seed     — crea un notebook por (país,dominio) y siembra las fuentes .gov de _meta/sources.yaml
  2. research — `source add-research --mode deep` para descubrir fuentes adicionales
  3. extract  — `source fulltext` de cada fuente → evidencia cruda (NO se pega al corpus tal cual;
                es insumo de grounding para redactar y verificar @fact)
  4. ask      — `ask --json` respuesta fundamentada con citas

NOTA: NotebookLM es una API NO oficial y frágil. El pipeline es idempotente y reanudable: la unidad
de trabajo es (país,dominio); si un notebook falla, se registra y se continúa. El corpus markdown es
el checkpoint durable; NotebookLM NO se consulta en runtime.

Uso (requiere auth válida — ver skills/notebooklm-py/SKILL.md):
  python3 tools/discover_notebooklm.py auth
  python3 tools/discover_notebooklm.py seed --country mx --domain taxes
  python3 tools/discover_notebooklm.py research --notebook <id> "RESICO límites 2026 SAT"
  python3 tools/discover_notebooklm.py extract --notebook <id> --out evidence/mx-taxes/
  python3 tools/discover_notebooklm.py ask --notebook <id> "¿Tasa general del IVA y excepciones?"
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import yaml

KB = Path(__file__).resolve().parent.parent
BRAIN = KB.parent                                   # littlefounders_brain/
NB_BIN = BRAIN / ".venv" / "bin" / "notebooklm"
STORAGE = BRAIN / ".notebooklm" / "storage_state.json"
SOURCES = yaml.safe_load((KB / "_meta" / "sources.yaml").read_text())["sources"]

JURIS_BY_COUNTRY = {"mx": "MX-FED", "us": "US-FED"}


def nb(*args, timeout=180, json_out=False):
    """Invoca el CLI notebooklm con --storage in-folder. Degrada con gracia."""
    cmd = [str(NB_BIN), "--storage", str(STORAGE), *args]
    if json_out:
        cmd.append("--json")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        sys.exit(f"❌ No existe {NB_BIN}. Recrea el venv: "
                 f"python3.11 -m venv .venv && ./.venv/bin/pip install 'notebooklm-py[browser]'")
    except subprocess.TimeoutExpired:
        print(f"⚠️  timeout en: notebooklm {' '.join(args)}", file=sys.stderr)
        return None
    if r.returncode != 0:
        print(f"⚠️  fallo ({r.returncode}): notebooklm {' '.join(args)}\n{r.stderr.strip()[:300]}",
              file=sys.stderr)
        return None
    if json_out:
        try:
            return json.loads(r.stdout)
        except json.JSONDecodeError:
            return None
    return r.stdout.strip()


def cmd_auth(_):
    out = nb("auth", "check", "--test", json_out=True)
    if out and out.get("status") == "ok" and out.get("checks", {}).get("token_fetch"):
        print("✅ auth OK (token_fetch verificado)")
        return 0
    print("❌ auth inválida. Corre: ./.venv/bin/notebooklm login --browser chrome "
          "--storage .notebooklm/storage_state.json   (ver skills/notebooklm-py/SKILL.md)")
    return 1


def cmd_seed(a):
    juris = JURIS_BY_COUNTRY[a.country]
    seeds = [(sid, s) for sid, s in SOURCES.items()
             if s["jurisdiction"] in (juris, "NONE") and s["tier"] == "primary"]
    title = f"LF brain — {a.country}/{a.domain}"
    created = nb("create", title, json_out=True)
    if not created:
        return 1
    nbid = created["notebook"]["id"]
    print(f"📓 notebook {nbid}  ({title})")
    ok = 0
    for sid, s in seeds:
        res = nb("source", "add", s["url"], "-n", nbid, json_out=True)
        if res:
            ok += 1
            print(f"  + {sid}: {s['url']}")
    print(f"sembradas {ok}/{len(seeds)} fuentes primarias. notebook_id={nbid}")
    print("Siguiente: research / extract / ask con --notebook " + nbid)
    return 0


def cmd_research(a):
    print(f"🔎 deep research en {a.notebook}: {a.query!r} (15-30 min, no bloqueante)")
    nb("source", "add-research", a.query, "--mode", "deep", "--no-wait", "-n", a.notebook)
    print("Lanzado. Espera con: notebooklm research wait -n <id> --import-all --timeout 1800")
    return 0


def cmd_extract(a):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    listing = nb("source", "list", "-n", a.notebook, json_out=True)
    if not listing:
        return 1
    n = 0
    for src in listing.get("sources", []):
        if src.get("status") != "ready":
            continue
        ft = nb("source", "fulltext", src["id"], "-n", a.notebook, json_out=True)
        if ft and ft.get("content"):
            (out / f"{src['id']}.md").write_text(
                f"# {ft.get('title','')}\n\nURL: {ft.get('url','')}\n\n{ft['content']}",
                encoding="utf-8")
            n += 1
    print(f"📄 {n} fuentes extraídas a {out} (evidencia de grounding, NO corpus)")
    return 0


def cmd_ask(a):
    res = nb("ask", a.query, "-n", a.notebook, json_out=True)
    if not res:
        return 1
    print(res.get("answer", ""))
    print("\n— Citas —")
    for ref in res.get("references", []):
        print(f"  [{ref.get('citation_number')}] src={ref.get('source_id')} :: "
              f"{ref.get('cited_text','')[:120]}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth").set_defaults(fn=cmd_auth)
    s = sub.add_parser("seed"); s.add_argument("--country", required=True, choices=["mx", "us"])
    s.add_argument("--domain", required=True); s.set_defaults(fn=cmd_seed)
    s = sub.add_parser("research"); s.add_argument("--notebook", required=True)
    s.add_argument("query"); s.set_defaults(fn=cmd_research)
    s = sub.add_parser("extract"); s.add_argument("--notebook", required=True)
    s.add_argument("--out", required=True); s.set_defaults(fn=cmd_extract)
    s = sub.add_parser("ask"); s.add_argument("--notebook", required=True)
    s.add_argument("query"); s.set_defaults(fn=cmd_ask)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
