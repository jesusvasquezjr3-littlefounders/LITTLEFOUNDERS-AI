#!/usr/bin/env python3
"""
Genera tipos TypeScript del frontend DESDE exercise_registry.json (fuente única).
Así la unión de tipos y el mapa de claves de respuesta del grader del frontend derivan
del mismo origen que el validador del backend y NO pueden re-divergir.

Uso:
  python3 schema/gen_frontend_types.py            # escribe al destino por defecto
  python3 schema/gen_frontend_types.py --stdout   # imprime sin escribir
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
REGISTRY_FILE = BASE / "exercise_registry.json"
DEFAULT_OUT = (
    BASE.parent.parent.parent
    / "frontend" / "src" / "components" / "lessons" / "engine"
    / "generated" / "exerciseTypes.generated.ts"
)


def gen() -> str:
    reg = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    canonical = list(reg["canonical_types"].keys())
    deprecated = reg["deprecated_types"]
    version = reg["registry_version"]

    def union(names):
        return " | ".join(f"'{n}'" for n in names) if names else "never"

    answer_keys = {t: spec.get("accepted_answer_keys", []) for t, spec in reg["canonical_types"].items()}
    gradable = {t: bool(spec.get("gradable")) for t, spec in reg["canonical_types"].items()}

    lines = []
    lines.append("// ⚠️  ARCHIVO AUTOGENERADO — NO EDITAR A MANO.")
    lines.append("// Fuente: littlefounders_brain/lesson_factory/schema/exercise_registry.json")
    lines.append("// Regenerar: python3 littlefounders_brain/lesson_factory/schema/gen_frontend_types.py")
    lines.append(f"// registry_version: {version}")
    lines.append("")
    lines.append(f"export type CanonicalExerciseType = {union(canonical)};")
    lines.append("")
    lines.append(f"export type DeprecatedExerciseType = {union(list(deprecated.keys()))};")
    lines.append("")
    lines.append("export type ExerciseType = CanonicalExerciseType | DeprecatedExerciseType;")
    lines.append("")
    lines.append("/** Mapa de tipo deprecado → tipo canónico (a plegar en regeneración). */")
    lines.append("export const DEPRECATED_TYPE_MAP: Record<DeprecatedExerciseType, CanonicalExerciseType> = {")
    for d, c in deprecated.items():
        lines.append(f"  '{d}': '{c}',")
    lines.append("};")
    lines.append("")
    lines.append("/** Claves de correct_answer aceptadas por tipo (back-compat con el corpus). */")
    lines.append("export const ANSWER_KEYS_BY_TYPE: Record<CanonicalExerciseType, string[]> = {")
    for t, keys in answer_keys.items():
        arr = ", ".join(f"'{k}'" for k in keys)
        lines.append(f"  '{t}': [{arr}],")
    lines.append("};")
    lines.append("")
    lines.append("/** Tipos que califican respuesta (vs. narrativos/no graduables). */")
    lines.append("export const GRADABLE_BY_TYPE: Record<CanonicalExerciseType, boolean> = {")
    for t, g in gradable.items():
        lines.append(f"  '{t}': {str(g).lower()},")
    lines.append("};")
    lines.append("")
    lines.append("export const ALL_CANONICAL_TYPES: CanonicalExerciseType[] = [")
    lines.append("  " + ", ".join(f"'{t}'" for t in canonical))
    lines.append("];")
    lines.append("")
    lines.append("/** Resuelve un tipo (posiblemente deprecado) a su canónico. */")
    lines.append("export function canonicalType(t: string): string {")
    lines.append("  return (DEPRECATED_TYPE_MAP as Record<string, string>)[t] ?? t;")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stdout", action="store_true")
    args = ap.parse_args()
    out = gen()
    if args.stdout:
        print(out)
        return
    DEFAULT_OUT.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_OUT.write_text(out, encoding="utf-8")
    print(f"✅ Tipos TS escritos en {DEFAULT_OUT}")


if __name__ == "__main__":
    main()
