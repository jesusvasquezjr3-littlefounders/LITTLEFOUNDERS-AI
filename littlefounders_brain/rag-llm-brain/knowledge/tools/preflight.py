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

    # 1. credenciales — la clave del PROVEEDOR de CADA rol (planner DeepSeek / autor Qwen / juez GLM).
    #    (antes faltaba DEEPSEEK_API_KEY del planner → fallaba a mitad de corrida.)
    KEY_BY_PROV = {"qwen": "QWEN_API_KEY", "glm": "ZAI_API_KEY", "deepseek": "DEEPSEEK_API_KEY"}
    provs = {role: provider_for(MODELS[role]) for role in ("planner", "author", "judge")}
    for role, prov in provs.items():
        kn = KEY_BY_PROV.get(prov, "?")
        hard(f".env {kn} ({role}={prov})", bool(env.get(kn)))
    if "qwen" in provs.values():
        hard(".env QWEN_BASE_URL", bool(env.get("QWEN_BASE_URL")))

    # 2. archivos de contrato
    for f in ("taxonomy.yaml", "build_policy.yaml", "volatility_policy.yaml", "sources.yaml", "facts.yaml"):
        try:
            yaml.safe_load((META / f).read_text(encoding="utf-8"))
            hard(f"_meta/{f} carga", True)
        except Exception as e:
            hard(f"_meta/{f} carga", False, str(e))
    hard("_meta/schema.json existe", (META / "schema.json").exists())

    # 2b. concept_map: DEBE cargar y tener celdas. Si carga vacío, build_dataset cae a planner en vivo y
    #     coverage_complete() NUNCA para por cobertura (regresión silenciosa a stop-solo-por-budget).
    try:
        cm = yaml.safe_load((META / "concept_map.yaml").read_text(encoding="utf-8")) or {}
        ncells = len(cm.get("cells", {}))
        ntop = sum(len(c.get("topics", [])) for c in cm.get("cells", {}).values())
        hard("_meta/concept_map.yaml con celdas (STOP por cobertura)", ncells > 0, f"{ncells} celdas / {ntop} temas")
    except Exception as e:
        hard("_meta/concept_map.yaml con celdas (STOP por cobertura)", False, str(e)[:160])

    # 3. facts.yaml: nada PENDING entre los enforced/verified
    facts = load_facts(verified_only=True)
    enforced = {k: v for k, v in facts.items() if v.get("enforce", True)}
    pend = [k for k, v in enforced.items() if str(v.get("value", "")).strip().upper() == "PENDING"]
    hard("facts.yaml verified+enforce sin PENDING", not pend, f"PENDING: {pend}" if pend else f"{len(enforced)} cifras canónicas")
    novalue = [k for k, v in enforced.items() if not str(v.get("value", "")).strip()]
    hard("facts.yaml enforce con valor", not novalue, f"sin valor: {novalue}" if novalue else "")

    # 3b. presupuesto del AUTOR (Qwen pay-as-you-go) acotado — un --run sin tope factura a tarjeta.
    wu = POLICY.get("wise_use", {})
    bud = wu.get("budget_usd") or {}
    aprov = provs["author"]
    capped = (isinstance(bud, dict) and bud.get(aprov) not in (None, "null", "")) or bool(wu.get("budget_output_tokens"))
    warn(f"autor ({aprov}) con tope de presupuesto", capped,
         f"USD {bud.get(aprov) if isinstance(bud, dict) else bud}" if capped
         else f"define wise_use.budget_usd['{aprov}'] o lanza --run con --i-accept-unbounded-author")

    # 3c. PROYECCIÓN DE COSTO — riesgo #1 de la corrida masiva: que el budget muera a mitad (STOP-por-budget
    #     disfrazado de STOP-por-cobertura). Compara los caps contra el costo de la corrida COMPLETA.
    try:
        from cost_projection import map_topics, project
        proj = project(map_topics(), safety=1.3, atomic=True)
        capsd = bud if isinstance(bud, dict) else {}
        short = []
        for prov, pv in proj["by_provider"].items():
            cap = capsd.get(prov)
            capf = float(cap) if cap not in (None, "null", "") else None
            if capf is not None and capf < pv:
                short.append(f"{prov} ${capf:.0f}<${pv:.0f}")
        total = sum(proj["by_provider"].values())
        warn("presupuesto cubre la corrida COMPLETA (GO-para-terminar)", not short,
             (f"FALTA: {'; '.join(short)} · total ~${total:.0f} (sube los caps; ver cost_projection.py)"
              if short else f"caps cubren ~${total:.0f} proyectado"))
    except Exception as e:
        warn("proyección de costo", False, str(e)[:140])

    # 4. conectividad real (autor Qwen + juez GLM + smoke búsqueda)
    if not args.no_net:
        try:
            qp = Qwen(provider=provider_for(MODELS["planner"]))
            qp.ping(MODELS["planner"])
            hard(f"ping PLANNER {MODELS['planner']} ({qp.provider})", True)
        except Exception as e:
            hard(f"ping PLANNER {MODELS['planner']}", False, str(e)[:160])
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

    # 5. gate verde sobre el corpus SERVIBLE (review/published). Los drafts están en cuarentena por
    #    definición → no bloquean el GO (se regeneran con --retry-drafts). El gate completo (CI) valida todo.
    r = subprocess.run([sys.executable, str(TOOLS / "gate_kb.py"), "--exclude-drafts"],
                       capture_output=True, text=True, cwd=str(KB.parent))
    tail = (r.stdout.strip().splitlines() or ["(sin salida)"])[-1]
    hard("gate VERDE en corpus SERVIBLE (review/published; drafts excluidos)", r.returncode == 0, tail)
    # 5b. avisar (no bloquear) si hay drafts pendientes de regenerar
    rd = subprocess.run([sys.executable, str(TOOLS / "gate_kb.py")],
                        capture_output=True, text=True, cwd=str(KB.parent))
    warn("gate completo (incl. drafts en cuarentena)", rd.returncode == 0,
         (rd.stdout.strip().splitlines() or ["(sin salida)"])[-1])

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
