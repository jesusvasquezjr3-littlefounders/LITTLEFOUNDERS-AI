#!/usr/bin/env python3
"""
LittleFounders Lesson Factory — Esquema v2 (fuente única de verdad)
===================================================================

Modelo Pydantic v2 que define el contrato del Lesson Engine. Reemplaza las TRES
definiciones divergentes (currículo ~6 tipos / validate.py 40 / frontend ~56) por
UNA sola, anclada al registro `exercise_registry.json`.

Principios:
  - El SOBRE se conserva verbatim (las 2,461 lecciones del corpus deben seguir validando).
  - Los campos v2 (concept_ids, depth_tier, bloom_level, scaffold_level, engagement_role,
    feedback.per_option, ...) son ADITIVOS y opcionales/nullable.
  - Validación ESTRUCTURAL estricta (sobre, paridad ES/EN, tipo conocido) → criterio de
    salida de la Fase 0. Las señales de calidad (gradable-sin-respuesta, tipo deprecado,
    clave de respuesta no canónica) son ADVISORY y NO rompen la validación estructural.

Uso:
  python3 schema/lesson_v2.py --export-schema [out.json]   # exporta JSON Schema
  python3 schema/lesson_v2.py --validate <ruta_lesson.json>
  python3 schema/lesson_v2.py --validate-corpus            # valida las 2,461 + advisories
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

BASE_DIR = Path(__file__).resolve().parent
REGISTRY_FILE = BASE_DIR / "exercise_registry.json"
CORPUS_DIR = BASE_DIR.parent.parent / "lesson_engine" / "littlefounders_lessons"

with open(REGISTRY_FILE, encoding="utf-8") as _f:
    REGISTRY = json.load(_f)

CANONICAL_TYPES: dict[str, dict] = REGISTRY["canonical_types"]
DEPRECATED_TYPES: dict[str, str] = REGISTRY["deprecated_types"]
KNOWN_TYPES: set[str] = set(CANONICAL_TYPES) | set(DEPRECATED_TYPES)
ANSWER_OPTIONAL: set[str] = set(REGISTRY["answer_optional_types"])

BLOOM_LEVELS = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
SCAFFOLD_LEVELS = {"modeled", "guided", "independent"}
ENGAGEMENT_ROLES = {"hook", "learn", "apply", "connect"}

# PHASES: vocabulario controlado de fases. Es la UNIÓN de las fases base (bandas 1-2)
# + las required_phases_coverage de TODAS las bandas en pedagogy_rules.json. Las bandas
# 3-6 usan fases expandidas (por_que_importa, que_es, como_se_usa, que_error_evitar,
# aplicar, con_que_se_relaciona, caso_real, sintesis) que también deben ser válidas.
# El corpus legado deja phase=None, así que solo el contenido v2-generado lo dispara.
PHASES = {"conectar", "ensenar", "practicar", "reforzar", "aplicar_variante", "cerrar"}
try:
    _PED = json.loads((BASE_DIR.parent / "pedagogy_rules.json").read_text(encoding="utf-8"))["adventures"]
    for _adv in _PED.values():
        PHASES.update(_adv.get("activity_constraints", {}).get("required_phases_coverage", []))
except Exception:  # fallback explícito si el archivo no está disponible
    PHASES |= {"por_que_importa", "que_es", "como_se_usa", "que_error_evitar",
               "aplicar", "con_que_se_relaciona", "caso_real", "sintesis"}


def canonical_type(t: str) -> str:
    """Resuelve un tipo (posiblemente deprecado) a su forma canónica."""
    return DEPRECATED_TYPES.get(t, t)


# ─── Sub-modelos ───────────────────────────────────────────────────────────────

class Feedback(BaseModel):
    model_config = ConfigDict(extra="allow")
    success: Optional[str] = None
    error: Optional[str] = None
    # v2 aditivo: diagnóstico por distractor (id de opción -> texto). Forward-looking.
    per_option: Optional[dict[str, str]] = None


class ExerciseV2(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str
    character_code: Optional[str] = None
    content: dict[str, Any]
    correct_answer: Optional[dict[str, Any]] = None
    feedback: Optional[Feedback] = None

    # ── Campos v2 aditivos (todos opcionales; el corpus legado los deja en None) ──
    id: Optional[str] = None
    concept_ids: Optional[list[str]] = None
    prerequisite_concept_ids: Optional[list[str]] = None
    depth_tier: Optional[int] = Field(default=None, ge=1, le=5)
    bloom_level: Optional[str] = None
    scaffold_level: Optional[str] = None
    review_of: Optional[list[str]] = None
    engagement_role: Optional[str] = None
    phase: Optional[str] = None
    narrative_weight: Optional[float] = None
    stakes_realism: Optional[float] = None
    alt_explanation: Optional[dict[str, Any]] = None
    reassess_item: Optional[dict[str, Any]] = None

    @field_validator("type")
    @classmethod
    def _type_known(cls, v: str) -> str:
        if v not in KNOWN_TYPES:
            raise ValueError(f"tipo de ejercicio desconocido: '{v}' (no está en el registro)")
        return v

    @field_validator("content")
    @classmethod
    def _content_is_dict(cls, v: Any) -> dict:
        if not isinstance(v, dict) or len(v) == 0:
            raise ValueError("content debe ser un objeto no vacío")
        return v

    @field_validator("bloom_level")
    @classmethod
    def _bloom_ok(cls, v):
        if v is not None and v not in BLOOM_LEVELS:
            raise ValueError(f"bloom_level inválido: {v}")
        return v

    @field_validator("scaffold_level")
    @classmethod
    def _scaffold_ok(cls, v):
        if v is not None and v not in SCAFFOLD_LEVELS:
            raise ValueError(f"scaffold_level inválido: {v}")
        return v

    @field_validator("engagement_role")
    @classmethod
    def _role_ok(cls, v):
        if v is not None and v not in ENGAGEMENT_ROLES:
            raise ValueError(f"engagement_role inválido: {v}")
        return v

    @field_validator("phase")
    @classmethod
    def _phase_ok(cls, v):
        if v is not None and v not in PHASES:
            raise ValueError(f"phase inválida: {v}")
        return v


class LessonV2(BaseModel):
    """El sobre canónico. Estricto en estructura; aditivo en metadata v2."""

    model_config = ConfigDict(extra="allow")

    lesson_code: str
    title_es: str
    title_en: str
    description_es: str
    description_en: str
    duration: int
    age_rate: str
    points_reward: int
    adventure_level: int
    saga_level: int
    topic_level: int
    lesson_number: int
    content_es: list[ExerciseV2]
    content_en: list[ExerciseV2]

    # v2 aditivo a nivel lección
    lf_meta: Optional[dict[str, Any]] = None

    @field_validator("lesson_code")
    @classmethod
    def _code_shape(cls, v: str) -> str:
        parts = v.split("-")
        if len(parts) != 4 or not all(p.isdigit() for p in parts):
            raise ValueError(f"lesson_code debe ser 'A-S-T-L' con enteros: {v}")
        return v

    @model_validator(mode="after")
    def _structural_checks(self):
        # lesson_code coincide con los niveles
        a, s, t, l = (int(x) for x in self.lesson_code.split("-"))
        if (a, s, t, l) != (self.adventure_level, self.saga_level, self.topic_level, self.lesson_number):
            raise ValueError(
                f"lesson_code {self.lesson_code} no coincide con niveles "
                f"({self.adventure_level}-{self.saga_level}-{self.topic_level}-{self.lesson_number})"
            )
        # paridad bilingüe: mismo número de ejercicios y mismos tipos por índice
        if len(self.content_es) == 0 or len(self.content_en) == 0:
            raise ValueError("content_es y content_en no pueden estar vacíos")
        if len(self.content_es) != len(self.content_en):
            raise ValueError(
                f"paridad ES/EN rota: {len(self.content_es)} vs {len(self.content_en)} ejercicios"
            )
        for i, (e, n) in enumerate(zip(self.content_es, self.content_en)):
            if e.type != n.type:
                raise ValueError(f"tipo distinto en índice {i}: ES={e.type} / EN={n.type}")
        return self


# ─── Validación de corpus + advisories ──────────────────────────────────────────

def advisory_checks(lesson: LessonV2) -> list[str]:
    """Señales de calidad NO bloqueantes (informativas)."""
    issues: list[str] = []
    for lang, exercises in (("es", lesson.content_es), ("en", lesson.content_en)):
        for i, ex in enumerate(exercises):
            ct = canonical_type(ex.type)
            spec = CANONICAL_TYPES.get(ct, {})
            if ex.type in DEPRECATED_TYPES:
                issues.append(f"[{lang}#{i}] tipo deprecado '{ex.type}' → canónico '{ct}'")
            if spec.get("gradable") and ct not in ANSWER_OPTIONAL:
                ca = ex.correct_answer or {}
                if not ca:
                    issues.append(f"[{lang}#{i}] '{ex.type}' es gradable pero sin correct_answer")
                else:
                    accepted = set(spec.get("accepted_answer_keys", []))
                    if accepted and not (set(ca.keys()) & accepted):
                        issues.append(
                            f"[{lang}#{i}] '{ex.type}' usa claves {sorted(ca.keys())} "
                            f"fuera de las aceptadas {sorted(accepted)}"
                        )
    return issues


def validate_corpus() -> int:
    files = sorted(CORPUS_DIR.glob("adventure_*/saga_*/topic_*/lesson_*.json"))
    if not files:
        print(f"❌ No se encontró el corpus en {CORPUS_DIR}")
        return 1
    ok = struct_fail = 0
    advisory_count = 0
    advisory_by_kind: dict[str, int] = {}
    fail_samples: list[str] = []
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            lesson = LessonV2.model_validate(data)
            ok += 1
            for adv in advisory_checks(lesson):
                advisory_count += 1
                kind = adv.split("] ", 1)[-1].split(" ", 3)[0:3]
                key = adv.split("] ", 1)[-1]
                # agrupar por patrón corto
                if "deprecado" in key:
                    advisory_by_kind["tipo deprecado"] = advisory_by_kind.get("tipo deprecado", 0) + 1
                elif "sin correct_answer" in key:
                    advisory_by_kind["gradable sin respuesta"] = advisory_by_kind.get("gradable sin respuesta", 0) + 1
                else:
                    advisory_by_kind["clave no canónica"] = advisory_by_kind.get("clave no canónica", 0) + 1
        except Exception as e:
            struct_fail += 1
            if len(fail_samples) < 10:
                fail_samples.append(f"{path.name}: {str(e).splitlines()[0][:160]}")
    total = ok + struct_fail
    print(f"\n=== Validación estructural LessonV2 contra el corpus ===")
    print(f"Total lecciones: {total}")
    print(f"✅ Pasan estructura: {ok}")
    print(f"❌ Fallan estructura: {struct_fail}")
    if fail_samples:
        print("\nMuestras de fallo:")
        for s in fail_samples:
            print(f"  - {s}")
    print(f"\n--- Advisories (NO bloquean) ---")
    print(f"Total señales: {advisory_count}")
    for k, c in sorted(advisory_by_kind.items(), key=lambda x: -x[1]):
        print(f"  · {k}: {c}")
    print(f"\nCRITERIO DE SALIDA FASE 0: {'✅ CUMPLIDO' if struct_fail == 0 else '❌ NO cumplido'} "
          f"({ok}/{total} validan)")
    return 0 if struct_fail == 0 else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export-schema", nargs="?", const="-", help="exporta JSON Schema (a archivo o stdout)")
    ap.add_argument("--validate", help="valida una lección individual")
    ap.add_argument("--validate-corpus", action="store_true", help="valida todo el corpus")
    args = ap.parse_args()

    if args.export_schema is not None:
        schema = LessonV2.model_json_schema()
        out = json.dumps(schema, ensure_ascii=False, indent=2)
        if args.export_schema == "-":
            print(out)
        else:
            Path(args.export_schema).write_text(out, encoding="utf-8")
            print(f"✅ JSON Schema escrito en {args.export_schema}")
        return 0
    if args.validate:
        data = json.loads(Path(args.validate).read_text(encoding="utf-8"))
        try:
            lesson = LessonV2.model_validate(data)
            print(f"✅ {args.validate} valida estructura")
            for adv in advisory_checks(lesson):
                print(f"  advisory: {adv}")
            return 0
        except Exception as e:
            print(f"❌ {args.validate}:\n{e}")
            return 1
    if args.validate_corpus:
        return validate_corpus()
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
