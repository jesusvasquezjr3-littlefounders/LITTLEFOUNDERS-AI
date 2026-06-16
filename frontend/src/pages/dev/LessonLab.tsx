/**
 * LessonLab — DEV-ONLY reference harness for the Playful DS v2 ("Founder's Quest").
 *
 * Renders the redesigned lesson experience (shell + exercises + reward) with
 * MOCK data so the new UX/UI bar can be reviewed without the backend. This is
 * the approval reference; once the direction is signed off, these patterns get
 * ported into the real LessonRunner + the 43 activity components.
 *
 * Route: /dev/lesson-lab (gated to import.meta.env.DEV in App.tsx).
 */
import { useState } from "react";
import { Check, X, ArrowRight, Trophy, RotateCcw, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { QuestProgress } from "@/components/lessons/engine/ui/QuestProgress";
import { OptionCard, type OptionState } from "@/components/lessons/engine/ui/OptionCard";
import { QuestButton } from "@/components/lessons/engine/ui/QuestButton";
import { CoinBurst } from "@/components/lessons/engine/ui/CoinBurst";

type Step =
  | { kind: "mc"; eyebrow: string; question: string; options: { id: string; text: string }[]; correct: string; explain: string }
  | { kind: "tf"; eyebrow: string; question: string; statement: string; correct: boolean; explain: string };

const LESSON: Step[] = [
  {
    kind: "mc",
    eyebrow: "Misión 1 · Ahorro",
    question: "Si ahorras $10 cada semana, ¿cuánto tendrás en 4 semanas?",
    options: [{ id: "a", text: "$40" }, { id: "b", text: "$14" }, { id: "c", text: "$4" }, { id: "d", text: "$400" }],
    correct: "a",
    explain: "10 × 4 = 40. ¡Pequeños hábitos, gran tesoro!",
  },
  {
    kind: "tf",
    eyebrow: "Misión 2 · Presupuesto",
    question: "¿Verdadero o falso?",
    statement: "Un presupuesto te ayuda a decidir en qué gastar tu dinero antes de gastarlo.",
    correct: true,
    explain: "Exacto: un buen fundador planea su dinero antes de gastarlo.",
  },
];

const COINS_PER_WIN = 10;

export default function LessonLab() {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coins, setCoins] = useState(30);
  const [hearts, setHearts] = useState(3);
  const [burstKey, setBurstKey] = useState(0);
  const [done, setDone] = useState(false);

  const step = LESSON[idx];
  const progress = done ? 1 : idx / LESSON.length;

  const reset = () => { setSelected(null); setChecked(false); setIsCorrect(false); };

  const check = () => {
    if (!selected) return;
    const correct = step.kind === "mc" ? selected === step.correct : selected === String(step.correct);
    setChecked(true);
    setIsCorrect(correct);
    if (correct) {
      setCoins((c) => c + COINS_PER_WIN);
      setBurstKey((k) => k + 1);
    } else {
      setHearts((h) => Math.max(0, h - 1));
    }
  };

  const advance = () => {
    if (!isCorrect) { reset(); return; }
    if (idx + 1 >= LESSON.length) { setDone(true); setBurstKey((k) => k + 1); return; }
    setIdx((i) => i + 1);
    reset();
  };

  const restart = () => { setIdx(0); setCoins(30); setHearts(3); setDone(false); reset(); };

  // Build the option list (TF maps to two big options)
  const options = step.kind === "mc"
    ? step.options.map((o) => ({ id: o.id, text: o.text }))
    : [{ id: "true", text: "Verdadero" }, { id: "false", text: "Falso" }];
  const correctId = step.kind === "mc" ? step.correct : String(step.correct);

  const optionState = (id: string): OptionState => {
    if (!checked) return selected === id ? "selected" : "idle";
    if (id === correctId) return "correct";
    if (id === selected) return "wrong";
    return "dimmed";
  };

  return (
    <div className="lp lp-bg min-h-screen flex flex-col">
      <QuestProgress value={progress} coins={coins} hearts={hearts} onClose={restart} />

      {done ? (
        <RewardScreen coins={coins} onAgain={restart} burstKey={burstKey} />
      ) : (
        <>
          <div className="relative flex-1 overflow-y-auto px-4 pb-40 pt-3">
            <CoinBurst burstKey={burstKey} />
            <div key={idx} className="max-w-2xl mx-auto">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                <span
                  className="lp-chip inline-flex items-center h-8 px-3.5 text-xs"
                  style={{ color: "var(--lp-indigo-ink)" }}
                >
                  {step.eyebrow}
                </span>
                <div className="flex items-start gap-3.5 mt-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 lp-bob">
                    <DinoCharacter mood={checked ? (isCorrect ? "excited" : "happy") : "happy"} showBubble={false} />
                  </div>
                  <h1 className="lp-display text-[1.6rem] sm:text-3xl leading-tight pt-1" style={{ color: "var(--lp-ink)" }}>
                    {step.question}
                  </h1>
                </div>
                {step.kind === "tf" && (
                  <div className="lp-card p-4 sm:p-5 mt-4">
                    <p className="text-base sm:text-lg font-semibold leading-relaxed" style={{ color: "var(--lp-ink)" }}>
                      {step.statement}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  step.kind === "tf" ? "grid grid-cols-2 gap-3 mt-6" : "grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6",
                  checked && !isCorrect && "lp-shake",
                )}
              >
                {options.map((o, i) => (
                  <OptionCard
                    key={o.id}
                    index={i}
                    text={o.text}
                    state={optionState(o.id)}
                    showLetter={step.kind === "mc"}
                    onClick={() => !checked && setSelected(o.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer: verify OR result sheet */}
          {!checked ? (
              <div className="sticky bottom-0 px-4 pb-5 pt-3 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
                <div className="max-w-2xl mx-auto">
                  <QuestButton variant="gold" disabled={!selected} onClick={check}>
                    Comprobar
                  </QuestButton>
                </div>
              </div>
            ) : (
              <div
                className="sticky bottom-0 px-4 pb-5 pt-5 border-t-2 animate-in slide-in-from-bottom-6 duration-300 fill-mode-both"
                style={{
                  background: isCorrect ? "var(--lp-emerald-soft)" : "var(--lp-coral-soft)",
                  borderColor: isCorrect ? "var(--lp-emerald)" : "var(--lp-coral)",
                }}
              >
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: isCorrect ? "var(--lp-emerald)" : "var(--lp-coral)", color: "#fff" }}
                    >
                      {isCorrect ? <Check className="w-6 h-6" strokeWidth={3.5} /> : <X className="w-6 h-6" strokeWidth={3.5} />}
                    </div>
                    <div className="min-w-0">
                      <p className="lp-display text-lg leading-none" style={{ color: isCorrect ? "var(--lp-emerald-ink)" : "var(--lp-coral-ink)" }}>
                        {isCorrect ? "¡Tesoro encontrado!" : "¡Casi! Inténtalo otra vez"}
                      </p>
                      <p className="text-sm mt-1 leading-snug" style={{ color: "var(--lp-ink)" }}>
                        {isCorrect ? step.explain : "Revisa las pistas y vuelve a intentarlo."}
                      </p>
                    </div>
                    {isCorrect && (
                      <span className="lp-chip ml-auto shrink-0 h-9 px-3 flex items-center gap-1.5" style={{ color: "var(--lp-amber-ink)" }}>
                        <Coins className="w-4 h-4" style={{ color: "var(--lp-amber)" }} /> +{COINS_PER_WIN}
                      </span>
                    )}
                  </div>
                  <QuestButton variant={isCorrect ? "go" : "retry"} onClick={advance}>
                    {isCorrect ? <>Continuar <ArrowRight className="w-5 h-5" /></> : <>Reintentar <RotateCcw className="w-5 h-5" /></>}
                  </QuestButton>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}

function RewardScreen({ coins, onAgain, burstKey }: { coins: number; onAgain: () => void; burstKey: number }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center overflow-hidden">
      <CoinBurst burstKey={burstKey} />
      <div className="w-44 h-44 lp-bob animate-in zoom-in-75 fade-in duration-500 fill-mode-both">
        <DinoCharacter mood="excited" showBubble={false} />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <div className="inline-flex items-center gap-2 lp-chip h-9 px-4 mb-4" style={{ color: "var(--lp-amber-ink)" }}>
          <Trophy className="w-4 h-4" style={{ color: "var(--lp-amber)" }} /> Misión cumplida
        </div>
        <h1 className="lp-display text-3xl sm:text-4xl" style={{ color: "var(--lp-ink)" }}>¡Eres todo un fundador!</h1>
        <p className="mt-3 text-base" style={{ color: "var(--lp-muted)" }}>Completaste la misión y tu tesoro creció.</p>
        <div className="mt-6 inline-flex items-center gap-2.5 lp-card px-6 py-4">
          <Coins className="w-7 h-7" style={{ color: "var(--lp-amber)" }} />
          <span className="lp-display text-3xl tabular-nums" style={{ color: "var(--lp-amber-ink)" }}>{coins}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--lp-muted)" }}>monedas</span>
        </div>
      </div>
      <div className="w-full max-w-sm mt-9">
        <QuestButton variant="brand" onClick={onAgain}>
          <RotateCcw className="w-5 h-5" /> Jugar de nuevo
        </QuestButton>
      </div>
    </div>
  );
}
