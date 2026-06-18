/**
 * LessonPreview — DEV-ONLY. Renderiza una lección (JSON LessonV2) en el LessonRunner
 * REAL —con sus componentes de actividad y el grading real (validateAnswer)— SIN backend
 * ni BD. Transforma content_es/content_en → timeline con transformToTimeline (el mismo
 * shape que produce /play) y lo pasa como dataOverride.
 *
 * Para evaluar lecciones generadas (test_lessons/) antes de publicarlas a producción.
 * Ruta: /dev/lesson-preview (gated a import.meta.env.DEV en App.tsx).
 */
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LessonRunner } from "@/components/lessons/engine";
import { transformToTimeline } from "@/components/admin/utils/transformToTimeline";
import type { LessonData } from "@/components/lessons/engine/hooks/useLessonData";

// Carga todos los fixtures de lecciones (Vite glob, sin necesidad de resolveJsonModule)
const FIXTURE_MODULES = import.meta.glob("./fixtures/*.json", { eager: true }) as Record<string, { default: any }>;
const FIXTURES = Object.entries(FIXTURE_MODULES)
  .map(([path, mod]) => ({
    name: path.split("/").pop()!.replace(".json", ""),
    json: (mod as any).default ?? mod,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function LessonPreview() {
  const [selected, setSelected] = useState<any | null>(null);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [runKey, setRunKey] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const data = useMemo<LessonData | null>(() => {
    if (!selected) return null;
    try {
      return transformToTimeline(selected, lang) as unknown as LessonData;
    } catch {
      return null;
    }
  }, [selected, lang, runKey]);

  if (selected && data) {
    return (
      <div className="relative">
        <div className="fixed top-2 left-2 z-50 flex gap-2">
          <button
            onClick={() => setSelected(null)}
            className="corp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Lecciones
          </button>
          <button
            onClick={() => { setLang(lang === "es" ? "en" : "es"); setRunKey((k) => k + 1); }}
            className="corp-btn-secondary px-3 py-1.5 text-sm shadow-lg"
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={() => setRunKey((k) => k + 1)}
            className="corp-btn-secondary px-3 py-1.5 text-sm shadow-lg"
          >
            ↻ Reiniciar
          </button>
        </div>
        <LessonRunner key={`${selected.lesson_code}-${lang}-${runKey}`} dataOverride={data} />
      </div>
    );
  }

  return (
    <div className="corp-grid-bg min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="corp-h1 mb-2">Lesson Preview (dev)</h1>
        <p className="corp-body-muted mb-6">
          Renderiza una lección en el motor REAL (sin backend). Elige un fixture o pega un JSON de lección.
          Idioma actual: <strong>{lang.toUpperCase()}</strong>{" "}
          <button className="underline" onClick={() => setLang(lang === "es" ? "en" : "es")}>cambiar</button>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {FIXTURES.map((f) => (
            <button
              key={f.name}
              onClick={() => { setSelected(f.json); setRunKey((k) => k + 1); }}
              className="corp-card text-left p-4 hover:shadow-md transition-shadow"
            >
              <div className="font-semibold">{f.json.title_es || f.name}</div>
              <div className="corp-body-muted text-sm mt-1">
                {f.name} · banda {f.json.adventure_level} · {f.json.content_es?.length ?? 0} ej
              </div>
            </button>
          ))}
        </div>

        <button className="underline text-sm mb-2" onClick={() => setPasteOpen((o) => !o)}>
          {pasteOpen ? "− ocultar" : "+ pegar un JSON de lección personalizado"}
        </button>
        {pasteOpen && (
          <div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='{ "lesson_code": "...", "content_es": [...], "content_en": [...] }'
              className="w-full h-40 font-mono text-xs p-3 rounded-lg border"
            />
            {pasteError && <p className="text-sm mt-1" style={{ color: "var(--lp-coral, #c0392b)" }}>{pasteError}</p>}
            <button
              className="corp-btn-primary mt-2 px-4 py-2"
              onClick={() => {
                try {
                  const parsed = JSON.parse(pasteText);
                  setPasteError(null);
                  setSelected(parsed);
                  setRunKey((k) => k + 1);
                } catch (e) {
                  setPasteError("JSON inválido: " + (e as Error).message);
                }
              }}
            >
              Renderizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
