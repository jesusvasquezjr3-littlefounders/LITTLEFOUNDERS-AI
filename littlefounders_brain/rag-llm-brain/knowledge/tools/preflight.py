#!/usr/bin/env python3
"""
preflight.py — AUDITORÍA GO/NO-GO antes de ejecutar el pipeline v3.

Verifica que todo esté listo para que `build_dataset.py --run` NO falle a mitad de camino:
  1. .env con todas las credenciales (Qwen autor + z.ai juez).
  2. Archivos de contrato (_meta/*) cargan y son coherentes.
  3. facts.yaml: los hechos verified+enforce NO tienen valores PENDING.
  4. Conectividad real (1 token) con el AUTOR (Qwen) y el JUEZ (GLM), + smoke de búsqueda web GLM.
  5. El gate corre VERDE sobre el corpus actual.
  6. Avisos: evidencia curada presente, caché LLM, espacio en disco.

Uso:
  python3 tools/preflight.py            # auditoría completa (incluye pings de red)
  python3 tools/preflight.py --no-net   # solo checks locales (sin llamar a las APIs)

Salida: exit 0 si GO (sin fallos duros); 1 si NO-GO. Los avisos no bloquean.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
META = KB / "_meta"
sys.path.insert(0, str(TOOLS))
from facts_table import load_facts  # noqa: E402
from llm_qwen import Qwen, _load_env, provider_for  # noqa: E402

HARD: list[tuple[str, bool, str]] = []
WARN: list[tuple[str, bool, str]] = []


def hard(name, ok, detail=""):
    HARD.append((name, ok, detail))


def warn(name, ok, detail=""):
    WARN.append((name, ok, detail))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-net", action="store_true", help="omite los pings de red (solo checks locales)")
    args = ap.parse_args()

    env = _load_env()
    try:
        POLICY = yaml.safe_load((META / "build_policy.yaml").read_text(encoding="utf-8"))
        MODELS = POLICY["models"]
    except Exception as e:
        hard("build_policy.yaml carga", False, str(e))
        return _report()

    # 1. credenciales
    hard(".env QWEN_API_KEY", bool(env.get("QWEN_API_KEY")))
    hard(".env QWEN_BASE_URL", bool(env.get("QWEN_BASE_URL")))
    hard(".env ZAI_API_KEY (juez GLM)", bool(env.get("ZAI_API_KEY")))

    # 2. archivos de contrato
    for f in ("taxonomy.yaml", "build_policy.yaml", "volatility_policy.yaml", "sources.yaml", "facts.yaml"):
        try:
            yaml.safe_load((META / f).read_text(encoding="utf-8"))
            hard(f"_meta/{f} carga", True)
        except Exception as e:
            hard(f"_meta/{f} carga", False, str(e))
    hard("_meta/schema.json existe", (META / "schema.json").exists())

    # 3. facts.yaml: nada PENDING entre los enforced/verified
    facts = load_facts(verified_only=True)
    enforced = {k: v for k, v in facts.items() if v.get("enforce", True)}
    pend = [k for k, v in enforced.items() if str(v.get("value", "")).strip().upper() == "PENDING"]
    hard("facts.yaml verified+enforce sin PENDING", not pend, f"PENDING: {pend}" if pend else f"{len(enforced)} cifras canónicas")
    novalue = [k for k, v in enforced.items() if not str(v.get("value", "")).strip()]
    hard("facts.yaml enforce con valor", not novalue, f"sin valor: {novalue}" if novalue else "")

    # 4. conectividad real (autor Qwen + juez GLM + smoke búsqueda)
    if not args.no_net:
        try:
            qa = Qwen(provider=provider_for(MODELS["author"]))
            qa.ping(MODELS["author"])
            hard(f"ping AUTOR {MODELS['author']} ({qa.provider})", True)
        except Exception as e:
            hard(f"ping AUTOR {MODELS['author']}", False, str(e)[:160])
        try:
            qj = Qwen(provider=provider_for(MODELS["judge"]))
            qj.ping(MODELS["judge"])
            hard(f"ping JUEZ {MODELS['judge']} ({qj.provider})", True)
            # smoke de búsqueda web del juez (lo crítico del v3)
            try:
                out = qj.chat([{"role": "user", "content": "Usa búsqueda web y responde en ≤8 palabras: ¿tasa general del IVA en México?"}],
                              model=MODELS["judge"], enable_search=True, max_tokens=200, timeout=90)
                warn("juez búsqueda web responde", bool(out and "16" in out), out[:80] if out else "vacío")
            except Exception as e:
                warn("juez búsqueda web responde", False, str(e)[:160])
        except Exception as e:
            hard(f"ping JUEZ {MODELS['judge']}", False, str(e)[:160])
    else:
        warn("pings de red", True, "omitidos (--no-net)")

    # 5. gate verde
    r = subprocess.run([sys.executable, str(TOOLS / "gate_kb.py")],
                       capture_output=True, text=True, cwd=str(KB.parent))
    tail = (r.stdout.strip().splitlines() or ["(sin salida)"])[-1]
    hard("gate VERDE en corpus actual", r.returncode == 0, tail)

    # 6. avisos
    ev = KB / "evidence"
    n_ev = len(list(ev.rglob("*.md"))) if ev.exists() else 0
    warn("evidencia curada presente (NotebookLM)", n_ev > 0, f"{n_ev} archivos en evidence/ (opcional; si 0, el autor busca en web)")
    warn("caché LLM activada", bool(POLICY.get("wise_use", {}).get("cache_llm")), "wise_use.cache_llm")
    return _report()


def _report() -> int:
    print("\n" + "=" * 64)
    print("PREFLIGHT — auditoría de readiness del pipeline v3")
    print("=" * 64)
    print("\nDUROS (bloquean la ejecución):")
    for name, ok, detail in HARD:
        print(f"  [{'✓' if ok else '✗'}] {name}{('  — ' + detail) if detail else ''}")
    if WARN:
        print("\nAVISOS (no bloquean):")
        for name, ok, detail in WARN:
            print(f"  [{'✓' if ok else '!'}] {name}{('  — ' + detail) if detail else ''}")
    failed = [n for n, ok, _ in HARD if not ok]
    print("\n" + "-" * 64)
    if failed:
        print(f"NO-GO ❌ — {len(failed)} check(s) duros fallaron: {failed}")
        return 1
    print("GO ✅ — listo para `build_dataset.py --run`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
