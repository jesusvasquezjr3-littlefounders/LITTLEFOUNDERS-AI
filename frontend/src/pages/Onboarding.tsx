import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChevronRight, Check, Sparkles, Star, Zap } from "lucide-react";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import { setGuestProfile, getGuestProfile } from "@/lib/guestProfile";
import { trackEvent } from "@/lib/analytics";
import { useSound } from "@/contexts/SoundContext";

const STEP_NAMES: Record<number, string> = {
  0: "welcome",
  1: "name",
  2: "age",
  3: "interests",
  4: "experience",
};

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4;
type Interest = "saving" | "investing" | "entrepreneurship" | "budgeting" | "banking" | "security";
type ExperienceLevel = "beginner" | "some_knowledge" | "experienced";

interface OnboardingData {
  name: string;
  age: number | "";
  interests: Interest[];
  experience_level: ExperienceLevel | "";
}

const TOTAL_STEPS = 4;
const INTERESTS: Interest[] = ["saving", "investing", "entrepreneurship", "budgeting", "banking", "security"];
const EXP_LEVELS: ExperienceLevel[] = ["beginner", "some_knowledge", "experienced"];
const EXP_ICONS: Record<ExperienceLevel, string> = {
  beginner: "🌱",
  some_knowledge: "📚",
  experienced: "🚀",
};

// ─── Per-step design tokens ──────────────────────────────────────────────────

interface StepTheme {
  /** Tailwind bg gradient for light mode */
  lightBg: string;
  /** Tailwind bg gradient for dark mode */
  darkBg: string;
  /** CTA button gradient (inline style) */
  btnGradient: string;
  /** CTA button glow shadow (inline style) */
  btnShadow: string;
  /** Orb colours (light / dark) */
  orb1Light: string;
  orb2Light: string;
  orb1Dark: string;
  orb2Dark: string;
}

const STEP_THEMES: Record<number, StepTheme> = {
  0: {
    lightBg: "from-violet-100 via-indigo-50 to-blue-100",
    darkBg: "dark:from-[#1a0938] dark:via-[#1e0f5c] dark:to-[#0d1b4b]",
    btnGradient: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)",
    btnShadow: "0 12px 32px rgba(124,58,237,0.45)",
    orb1Light: "bg-violet-400",   orb2Light: "bg-indigo-300",
    orb1Dark:  "bg-violet-600",   orb2Dark:  "bg-indigo-500",
  },
  1: {
    lightBg: "from-blue-100 via-indigo-50 to-violet-100",
    darkBg: "dark:from-[#0d1b4b] dark:via-[#162060] dark:to-[#1a0938]",
    btnGradient: "linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)",
    btnShadow: "0 12px 32px rgba(37,99,235,0.42)",
    orb1Light: "bg-blue-400",     orb2Light: "bg-violet-300",
    orb1Dark:  "bg-blue-600",     orb2Dark:  "bg-violet-500",
  },
  2: {
    lightBg: "from-pink-100 via-rose-50 to-fuchsia-100",
    darkBg: "dark:from-[#2a0938] dark:via-[#2d0f5c] dark:to-[#1a0a3d]",
    btnGradient: "linear-gradient(135deg,#ec4899 0%,#a855f7 100%)",
    btnShadow: "0 12px 32px rgba(236,72,153,0.42)",
    orb1Light: "bg-pink-400",     orb2Light: "bg-fuchsia-300",
    orb1Dark:  "bg-pink-600",     orb2Dark:  "bg-fuchsia-500",
  },
  3: {
    lightBg: "from-purple-100 via-indigo-50 to-teal-50",
    darkBg: "dark:from-[#200a4b] dark:via-[#1a1060] dark:to-[#0d1b4b]",
    btnGradient: "linear-gradient(135deg,#9333ea 0%,#d946ef 100%)",
    btnShadow: "0 12px 32px rgba(147,51,234,0.42)",
    orb1Light: "bg-purple-400",   orb2Light: "bg-teal-300",
    orb1Dark:  "bg-purple-600",   orb2Dark:  "bg-teal-500",
  },
  4: {
    lightBg: "from-amber-100 via-orange-50 to-rose-100",
    darkBg: "dark:from-[#2d0a38] dark:via-[#3d0f1a] dark:to-[#200a4b]",
    btnGradient: "linear-gradient(135deg,#f59e0b 0%,#f97316 100%)",
    btnShadow: "0 12px 32px rgba(245,158,11,0.42)",
    orb1Light: "bg-amber-400",    orb2Light: "bg-rose-300",
    orb1Dark:  "bg-amber-600",    orb2Dark:  "bg-rose-500",
  },
  5: {
    lightBg: "from-emerald-100 via-teal-50 to-blue-100",
    darkBg: "dark:from-[#032b1a] dark:via-[#073b28] dark:to-[#0d1b4b]",
    btnGradient: "linear-gradient(135deg,#10b981 0%,#0891b2 100%)",
    btnShadow: "0 12px 32px rgba(16,185,129,0.42)",
    orb1Light: "bg-emerald-400",  orb2Light: "bg-teal-300",
    orb1Dark:  "bg-emerald-600",  orb2Dark:  "bg-teal-500",
  },
};

// ─── Drifting ambient orbs ───────────────────────────────────────────────────

function DriftingOrbs({ step }: { step: Step }) {
  const { orb1Light, orb2Light, orb1Dark, orb2Dark } = STEP_THEMES[step];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Primary orb — lighter in light mode, more visible in dark mode */}
      <div
        className={cn(
          "absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[120px] animate-orb-1 transition-colors duration-[1200ms]",
          orb1Light, "opacity-25",
          orb1Dark && `dark:${orb1Dark}`,
          "dark:opacity-30"
        )}
      />
      {/* Secondary orb */}
      <div
        className={cn(
          "absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full blur-[100px] animate-orb-2 transition-colors duration-[1200ms]",
          orb2Light, "opacity-20",
          orb2Dark && `dark:${orb2Dark}`,
          "dark:opacity-25"
        )}
      />
      {/* Tertiary orb — center */}
      <div
        className={cn(
          "absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full blur-[90px] animate-orb-3",
          "opacity-10 dark:opacity-15",
          orb1Light
        )}
      />
    </div>
  );
}

// ─── Floating sparkle particles (light-adaptive) ─────────────────────────────

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "absolute",
            i % 3 === 0 ? "animate-orb-1" : i % 3 === 1 ? "animate-orb-2" : "animate-orb-3"
          )}
          style={{
            left: `${8 + i * 9}%`,
            top: `${6 + ((i * 47) % 83)}%`,
            animationDelay: `${i * 1.1}s`,
            opacity: 0.18 + (i % 4) * 0.06,
          }}
        >
          {i % 3 === 0 ? (
            <Star className="w-2 h-2 text-violet-400 dark:text-white fill-violet-400 dark:fill-white" />
          ) : i % 3 === 1 ? (
            <Sparkles className="w-2.5 h-2.5 text-indigo-400 dark:text-purple-200" />
          ) : (
            <Zap className="w-2 h-2 text-blue-400 dark:text-blue-200" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Premium progress bar ─────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const { t } = useTranslation("onboarding");
  if (step === 0) return null;

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="w-full flex flex-col gap-2 px-6 pt-7 pb-1 max-w-lg mx-auto">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-white/65">
          {t("progress.step_of", { current: step, total: TOTAL_STEPS })}
        </span>
        <span className="text-[10px] font-black text-gray-500 dark:text-white/65">
          {progress}%
        </span>
      </div>

      {/* Track */}
      <div className="relative w-full h-1.5 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Glow layer */}
        <div
          className="absolute inset-y-0 left-0 rounded-full blur-sm opacity-70 bg-gradient-to-r from-violet-400 to-indigo-400 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-between w-full">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const done = i < step;
          const active = i === step - 1;
          return (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-500",
                active
                  ? "w-6 h-2 bg-violet-500 dark:bg-white shadow-lg shadow-violet-500/50 dark:shadow-white/30"
                  : done
                  ? "w-2 h-2 bg-violet-400 dark:bg-white/60"
                  : "w-2 h-2 bg-gray-300 dark:bg-white/15"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Glass card ───────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden",
        // Light mode: high-opacity frosted white
        "bg-white/70 border border-white/90",
        // Dark mode: suficiente opacidad para que el texto sea legible
        "dark:bg-white/[0.10] dark:border-white/20",
        // Blur + saturation (the liquid glass core)
        "backdrop-blur-2xl saturate-[170%]",
        // Shadows
        "shadow-2xl shadow-black/8 dark:shadow-black/60",
        // Shimmer layer
        "before:absolute before:inset-0 before:rounded-3xl before:pointer-events-none",
        "before:bg-gradient-to-br before:from-white/50 before:via-white/10 before:to-transparent",
        "dark:before:from-white/15 dark:before:via-white/5 dark:before:to-transparent",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Selectable card ──────────────────────────────────────────────────────────

function SelectableCard({
  selected,
  onClick,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "relative rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer border-2",
        "backdrop-blur-xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
        selected
          ? [
              // Light
              "bg-violet-50/90 border-violet-400/70",
              "shadow-lg shadow-violet-200/60",
              // Dark — contraste mejorado
              "dark:bg-violet-500/25 dark:border-white/70",
              "dark:shadow-lg dark:shadow-violet-500/20",
              "scale-[1.04]",
            ]
          : [
              // Light
              "bg-white/55 border-gray-200/80",
              "hover:bg-white/80 hover:border-violet-300/50",
              // Dark — fondo más visible
              "dark:bg-white/[0.08] dark:border-white/18",
              "dark:hover:bg-white/[0.15] dark:hover:border-white/35",
              "hover:scale-[1.02]",
            ],
        className
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-violet-500 dark:bg-white rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-3 h-3 text-white dark:text-violet-600" />
        </span>
      )}
      {children}
    </button>
  );
}

// ─── Character spotlight wrapper ─────────────────────────────────────────────

function Spotlight({
  children,
  color = "rgba(139,92,246,0.15)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="relative flex items-center justify-center drop-shadow-2xl">
      {/* Glow ring behind character */}
      <div
        className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
        style={{ background: color }}
      />
      {children}
    </div>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CtaButton({
  onClick,
  disabled,
  step,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  step: Step;
  children: React.ReactNode;
  className?: string;
}) {
  const { btnGradient, btnShadow } = STEP_THEMES[step];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative group w-full py-4 rounded-2xl font-black text-white text-base",
        "transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
        // Shimmer overlay on hover
        "overflow-hidden",
        className
      )}
      style={{
        background: btnGradient,
        boxShadow: disabled ? "none" : btnShadow,
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {/* Shimmer sweep */}
      <span
        className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
        }}
      />
      <span className="relative flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("onboarding");
  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    age: "",
    interests: [],
    experience_level: "",
  });
  const [nameInput, setNameInput] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  // ── Character bubble states ───────────────────────────────────────────
  const [nameBubble, setNameBubble] = useState("");
  const [ageBubble, setAgeBubble] = useState("");
  const [interestsBubble, setInterestsBubble] = useState("");
  const [experienceBubble, setExperienceBubble] = useState("");
  const [expHovered, setExpHovered] = useState<ExperienceLevel | null>(null);
  const [expSelected, setExpSelected] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { playFile, mute } = useSound();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);

  // ── Onboarding narration audio ────────────────────────────────────────
  useEffect(() => {
    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsNarrationPlaying(false);
    if (mute) return;

    const lang = i18n.language?.startsWith('en') ? 'EN' : 'ES';
    const audioFiles: Record<number, string> = {
      0: `/sounds/onboarding/${lang}/0-step_${lang}.mp3`,
      1: `/sounds/onboarding/${lang}/1-name_${lang}.mp3`,
      2: `/sounds/onboarding/${lang}/2-age_${lang}.mp3`,
      3: `/sounds/onboarding/${lang}/3-learn_${lang}.mp3`,
      4: `/sounds/onboarding/${lang}/4-knowledge_${lang}.mp3`,
    };

    const src = audioFiles[step];
    if (!src) return;

    const audio = new Audio(src);
    audio.volume = 0.7; // Narration volume (higher than SFX)

    const handlePlay = () => setIsNarrationPlaying(true);
    const handleEnded = () => setIsNarrationPlaying(false);
    const handlePause = () => setIsNarrationPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);

    audio.play().catch(() => { /* ignore autoplay errors */ });
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [step, i18n.language, mute]);

  // ── Guard: redirect if session already exists ─────────────────────────
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) { navigate("/learn"); return; }
    const guest = getGuestProfile();
    if (guest?.onboarding_completed) {
      navigate(guest.placement ? "/learn" : "/placement");
      return;
    }

    // Restore in-progress from sessionStorage
    const saved = sessionStorage.getItem("onboarding_progress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        if (parsed.nameInput) setNameInput(parsed.nameInput);
        if (parsed.ageInput) setAgeInput(parsed.ageInput);
        if (parsed.step && parsed.step > 0) setStep(parsed.step as Step);
      } catch { /* ignore */ }
    }
  }, [navigate]);

  // ── Persist in-progress ───────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem(
      "onboarding_progress",
      JSON.stringify({ step, data, nameInput, ageInput })
    );
  }, [step, data, nameInput, ageInput]);

  // ── Auto-focus inputs ─────────────────────────────────────────────────
  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 420);
    if (step === 2) setTimeout(() => ageRef.current?.focus(), 420);
  }, [step]);

  // ── Character bubble logic ────────────────────────────────────────────

  // Step 1: Name bubble
  useEffect(() => {
    if (step !== 1) { setNameBubble(""); return; }
    const trimmed = nameInput.trim();
    if (error === t("errors.name_required")) {
      setNameBubble(t("name.liruf_error_empty_bubble"));
    } else if (error === t("errors.name_invalid")) {
      setNameBubble(t("name.liruf_error_invalid_bubble"));
    } else if (trimmed.length > 0) {
      setNameBubble(t("name.liruf_done", { name: trimmed }));
    } else {
      setNameBubble(t("name.liruf_bubble"));
    }
  }, [step, nameInput, error, t]);

  // Step 1: Typing bubble (debounced)
  useEffect(() => {
    if (step !== 1) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const trimmed = nameInput.trim();
    if (trimmed.length > 0 && !error) {
      typingTimerRef.current = setTimeout(() => {
        setNameBubble(t("name.liruf_typing_bubble"));
      }, 1800);
    }
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [nameInput, step, error, t]);

  // Step 2: Age bubble
  useEffect(() => {
    if (step !== 2) { setAgeBubble(""); return; }
    const trimmed = ageInput.trim();
    const parsed = parseInt(trimmed, 10);
    if (error === t("errors.age_required")) {
      setAgeBubble(t("age.dina_error_empty_bubble", { name: data.name || t("name.placeholder") }));
    } else if (error === t("errors.age_range")) {
      setAgeBubble(t("age.dina_error_range_bubble", { age: trimmed }));
    } else if (!isNaN(parsed) && parsed >= 6 && parsed <= 100) {
      setAgeBubble(t("age.dina_done", { age: trimmed }));
    } else if (trimmed.length > 0 && !error) {
      setAgeBubble(t("age.dina_typing_bubble"));
    } else {
      setAgeBubble(t("age.dina_bubble", { name: data.name || t("name.placeholder") }));
    }
  }, [step, ageInput, error, data.name, t]);

  // Step 3: Interests bubble
  useEffect(() => {
    if (step !== 3) { setInterestsBubble(""); return; }
    if (error === t("errors.interest_required")) {
      setInterestsBubble(t("interests.rho_error_bubble", { name: data.name || t("name.placeholder") }));
    } else if (data.interests.length === 1) {
      setInterestsBubble(t("interests.rho_first_selection_bubble"));
    } else if (data.interests.length >= 2) {
      setInterestsBubble(t("interests.rho_multiple_bubble"));
    } else {
      setInterestsBubble(t("interests.rho_bubble", { name: data.name || t("name.placeholder") }));
    }
  }, [step, data.interests.length, error, data.name, t]);

  // Step 4: Experience bubble
  useEffect(() => {
    if (step !== 4) { setExperienceBubble(""); setExpSelected(false); return; }
    if (expSelected) {
      setExperienceBubble(t("experience.zara_selected_bubble"));
    } else if (expHovered === "beginner") {
      setExperienceBubble(t("experience.zara_hover_beginner"));
    } else if (expHovered === "some_knowledge") {
      setExperienceBubble(t("experience.zara_hover_some"));
    } else if (expHovered === "experienced") {
      setExperienceBubble(t("experience.zara_hover_expert"));
    } else {
      setExperienceBubble(t("experience.zara_bubble", { name: data.name || t("name.placeholder") }));
    }
  }, [step, expHovered, expSelected, data.name, t]);

  // ── Track step views (GA4 custom event) ───────────────────────────────
  useEffect(() => {
    trackEvent("onboarding_step_viewed", {
      step_index: step,
      step_name: STEP_NAMES[step] ?? `step_${step}`,
    });
  }, [step]);

  // ── Navigation ────────────────────────────────────────────────────────
  const goNext = () => setStep((s) => Math.min(s + 1, 4) as Step);

  const handleStartFromWelcome = () => {
    trackEvent("onboarding_started", { source: "welcome_cta" });
    goNext();
  };

  // ── Step handlers ─────────────────────────────────────────────────────
  const handleNameContinue = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError(t("errors.name_required"));
      trackEvent("onboarding_name_submitted", { success: false, error: "required" });
      return;
    }

    // Check for valid characters: letters, spaces, hyphens, and apostrophes (plus accents) to prevent script injection
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;
    if (!nameRegex.test(trimmed)) {
      setError(t("errors.name_invalid"));
      trackEvent("onboarding_name_submitted", { success: false, error: "invalid" });
      return;
    }

    setError("");
    setData((d) => ({ ...d, name: trimmed }));
    trackEvent("onboarding_name_submitted", { success: true, name_length: trimmed.length });
    goNext();
  };

  const handleAgeContinue = () => {
    const trimmedAge = ageInput.trim();
    if (!trimmedAge) {
      setError(t("errors.age_required"));
      trackEvent("onboarding_age_submitted", { success: false, error: "required" });
      return;
    }

    // Ensure only digits are passed to prevent "12e3" or similar inputs that technically parse to numbers
    if (!/^\d+$/.test(trimmedAge)) {
      setError(t("errors.age_invalid"));
      trackEvent("onboarding_age_submitted", { success: false, error: "invalid" });
      return;
    }

    const parsed = parseInt(trimmedAge, 10);
    if (isNaN(parsed)) {
      setError(t("errors.age_required"));
      trackEvent("onboarding_age_submitted", { success: false, error: "nan" });
      return;
    }
    if (parsed < 6 || parsed > 100) {
      setError(t("errors.age_range"));
      trackEvent("onboarding_age_submitted", { success: false, error: "out_of_range", age: parsed });
      return;
    }

    setError("");
    setData((d) => ({ ...d, age: parsed }));
    trackEvent("onboarding_age_submitted", { success: true, age: parsed });
    goNext();
  };

  const toggleInterest = (interest: Interest) => {
    const wasSelected = data.interests.includes(interest);
    setData((d) => ({
      ...d,
      interests: d.interests.includes(interest)
        ? d.interests.filter((i) => i !== interest)
        : [...d.interests, interest],
    }));
    setError("");
    trackEvent("onboarding_interest_toggled", {
      interest,
      action: wasSelected ? "removed" : "added",
      total_after: wasSelected ? data.interests.length - 1 : data.interests.length + 1,
    });
  };

  const handleInterestContinue = () => {
    if (data.interests.length === 0) {
      setError(t("errors.interest_required"));
      trackEvent("onboarding_interests_submitted", { success: false, error: "none_selected" });
      return;
    }
    setError("");
    trackEvent("onboarding_interests_submitted", {
      success: true,
      count: data.interests.length,
      interests: data.interests,
    });
    goNext();
  };

  const handleExperienceSelect = (level: ExperienceLevel) => {
    // Capture values NOW before any state update (stale closure prevention)
    const finalName = data.name;
    const finalAge = typeof data.age === "number" ? data.age : parseInt(ageInput.trim(), 10) || 0;
    const finalInterests = [...data.interests];
    const lang = i18n.language?.split("-")[0] === "en" ? "en" : "es";

    trackEvent("onboarding_experience_selected", {
      experience_level: level,
      age: finalAge,
      interests_count: finalInterests.length,
      preferred_language: lang,
    });
    trackEvent("onboarding_completed", {
      experience_level: level,
      age: finalAge,
      interests: finalInterests,
      preferred_language: lang,
    });

    setData((d) => ({ ...d, experience_level: level }));
    setTimeout(() => {
      setGuestProfile({
        name: finalName,
        age: finalAge,
        interests: finalInterests,
        experience_level: level,
        preferred_language: lang,
        xp: 0,
        current_streak: 1,
        max_streak: 1,
        lessons_completed: 0,
        games_played: 0,
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_lesson_codes: [],
        next_lesson_code: null,
        last_activity_date: null,
        placement: null,
        placement_adventure: null,
      });
      sessionStorage.removeItem("onboarding_progress");
      navigate("/placement");
    }, 300);
  };

  // ── Render ────────────────────────────────────────────────────────────
  const { lightBg, darkBg } = STEP_THEMES[step];

  return (
    <>
      <div
        className={cn(
          "min-h-screen flex flex-col items-center relative overflow-hidden",
          "bg-gradient-to-br transition-all duration-[1100ms]",
          lightBg,
          darkBg
        )}
      >
        {/* Ambient layers */}
        <DriftingOrbs step={step} />
        <FloatingParticles />

        {/* Extra refraction rim — top */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg,transparent,rgba(255,255,255,0.5) 40%,rgba(255,255,255,0.7) 60%,transparent)",
          }}
        />

        {/* Progress bar */}
        <ProgressBar step={step} />

        {/* ── Step content ──────────────────────────────────────────────── */}
        <div className="flex-1 w-full flex flex-col items-center justify-center px-4 py-8 gap-6 max-w-lg mx-auto">

          {/* ── STEP 0: Welcome ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-700">
              {/* Characters cluster */}
              <div className="relative w-72 h-80 mb-3">
                {/* Central glow ring */}
                <div
                  className="absolute left-1/2 bottom-[18%] -translate-x-1/2 w-44 h-44 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle,rgba(139,92,246,0.22) 0%,transparent 70%)",
                    filter: "blur(24px)",
                  }}
                />
                {/* Liruf — center, lowered to make room for bubble */}
                <div className="absolute left-1/2 bottom-4 -translate-x-1/2 w-44 h-44 drop-shadow-2xl z-10">
                  <DinoCharacter mood="excited" showBubble currentText={t("welcome.liruf_bubble")} bubblePosition="standard" isTalking={isNarrationPlaying} />
                </div>
                {/* Dina — bottom-left */}
                <div className="absolute bottom-4 left-2 w-20 h-20 drop-shadow-xl z-0 opacity-85">
                  <DinaCharacter expression="happy" showBubble={false} />
                </div>
                {/* Dr. Rho — bottom-right */}
                <div className="absolute bottom-4 right-2 w-20 h-20 drop-shadow-xl z-0 opacity-85">
                  <DrRhoCharacter mood="explaining" showBubble={false} />
                </div>
                {/* Zara — top-right */}
                <div className="absolute top-2 right-6 w-16 h-16 drop-shadow-xl z-0 opacity-75">
                  <ZaraVexCharacter mood="excited" showBubble={false} />
                </div>
              </div>

              {/* Speech bubble */}
              <GlassCard className="mb-6 max-w-xs px-6 py-5">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2 drop-shadow-sm">
                  {t("welcome.liruf_greeting")}
                </h1>
                <p className="text-gray-600 dark:text-white/80 text-sm leading-relaxed">
                  {t("welcome.liruf_intro")}
                </p>
                <p className="text-gray-500 dark:text-white/55 text-xs mt-3 border-t border-black/8 dark:border-white/15 pt-3">
                  {t("welcome.characters_intro")}
                </p>
              </GlassCard>

              {/* Start CTA */}
              <CtaButton onClick={handleStartFromWelcome} step={step} className="max-w-xs w-full py-5 text-lg">
                {t("welcome.start_button")}
                <Sparkles className="w-5 h-5 group-hover:rotate-12 group-hover:scale-110 transition-transform" />
              </CtaButton>
            </div>
          )}

          {/* ── STEP 1: Name ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in slide-in-from-right-6 duration-500">
              <Spotlight color="rgba(37,99,235,0.15)">
                <div className="w-36 h-48 mb-2 relative z-10">
                  <DinoCharacter
                    mood={nameInput.trim().length > 0 ? "excited" : "happy"}
                    showBubble={!!nameBubble}
                    currentText={nameBubble}
                    bubblePosition="standard"
                    isTalking={isNarrationPlaying}
                  />
                </div>
              </Spotlight>

              {nameInput.trim().length > 0 && (
                <p className="text-sm font-semibold mb-3 animate-in fade-in duration-300 text-blue-600 dark:text-blue-300">
                  {t("name.liruf_done", { name: nameInput.trim() })} 🎉
                </p>
              )}

              <GlassCard className="w-full p-7">
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                  {t("name.question")}
                </h2>
                <p className="text-gray-500 dark:text-white/70 text-sm mb-6">
                  {t("name.subtitle")}
                </p>

                <input
                  ref={nameRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleNameContinue()}
                  placeholder={t("name.placeholder")}
                  maxLength={50}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3.5 text-center text-lg font-bold outline-none transition-all duration-200",
                    // Light
                    "bg-black/5 placeholder-gray-400 text-gray-900",
                    // Dark
                    "dark:bg-white/10 dark:placeholder-white/30 dark:text-white",
                    "border-2",
                    error
                      ? "border-red-400"
                      : [
                          "border-black/10 dark:border-white/15",
                          "focus:border-blue-400 dark:focus:border-white/55",
                          "focus:bg-white/80 dark:focus:bg-white/15",
                        ]
                  )}
                />
                {error && (
                  <p className="text-red-500 text-xs mt-2 font-semibold">{error}</p>
                )}

                <CtaButton onClick={handleNameContinue} step={step} className="mt-5">
                  {t("name.continue")}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </CtaButton>
              </GlassCard>
            </div>
          )}

          {/* ── STEP 2: Age ─────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in slide-in-from-right-6 duration-500">
              <Spotlight color="rgba(236,72,153,0.15)">
                <div className="w-36 h-48 mb-2 relative z-10">
                  <DinaCharacter
                    expression="happy"
                    showBubble={!!ageBubble}
                    currentText={ageBubble}
                    bubblePosition="standard"
                    isTalking={isNarrationPlaying}
                  />
                </div>
              </Spotlight>

              {(() => {
                const parsedAge = parseInt(ageInput.trim(), 10);
                const isValidAge = ageInput.trim() !== "" && !isNaN(parsedAge) && parsedAge >= 6 && parsedAge <= 100;
                const isInvalidAge = ageInput.trim() !== "" && !isNaN(parsedAge) && (parsedAge < 6 || parsedAge > 100);
                if (isValidAge) {
                  return (
                    <p className="text-sm font-semibold mb-3 animate-in fade-in duration-300 text-pink-600 dark:text-pink-300">
                      {t("age.dina_done", { age: ageInput.trim() })} 🎂
                    </p>
                  );
                }
                if (isInvalidAge) {
                  return (
                    <p className="text-sm font-semibold mb-3 animate-in fade-in duration-300 text-red-500 dark:text-red-400">
                      {t("errors.age_range")}
                    </p>
                  );
                }
                return null;
              })()}

              <GlassCard className="w-full p-7">
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                  {t("age.question")}
                </h2>
                <p className="text-gray-500 dark:text-white/70 text-sm mb-6">
                  {t("age.subtitle")}
                </p>

                <input
                  ref={ageRef}
                  type="number"
                  inputMode="numeric"
                  min={6}
                  max={100}
                  value={ageInput}
                  onChange={(e) => { setAgeInput(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAgeContinue()}
                  placeholder={t("age.placeholder")}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3.5 text-center text-lg font-bold outline-none transition-all duration-200",
                    "bg-black/5 placeholder-gray-400 text-gray-900",
                    "dark:bg-white/10 dark:placeholder-white/30 dark:text-white",
                    "border-2",
                    error
                      ? "border-red-400"
                      : [
                          "border-black/10 dark:border-white/15",
                          "focus:border-pink-400 dark:focus:border-white/55",
                          "focus:bg-white/80 dark:focus:bg-white/15",
                        ],
                    // Hide native number spinners
                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  )}
                />
                {error && (
                  <p className="text-red-500 text-xs mt-2 font-semibold">{error}</p>
                )}

                <CtaButton onClick={handleAgeContinue} step={step} className="mt-5">
                  {t("age.continue")}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </CtaButton>
              </GlassCard>
            </div>
          )}

          {/* ── STEP 3: Interests ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-6 duration-500">
              <Spotlight color="rgba(147,51,234,0.15)">
                <div className="w-28 h-40 mb-2 relative z-10">
                  <DrRhoCharacter
                    mood="explaining"
                    showBubble={!!interestsBubble}
                    currentText={interestsBubble}
                    bubblePosition="top"
                    isTalking={isNarrationPlaying}
                  />
                </div>
              </Spotlight>

              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1 text-center">
                {t("interests.title")}
              </h2>
              <p className="text-gray-500 dark:text-white/70 text-sm mb-5 text-center">
                {t("interests.subtitle")}
              </p>

              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {INTERESTS.map((interest) => (
                  <SelectableCard
                    key={interest}
                    selected={data.interests.includes(interest)}
                    onClick={() => toggleInterest(interest)}
                  >
                    <div className="text-3xl mb-2">
                      {t(`interests.options.${interest}.icon`)}
                    </div>
                    <p className="text-gray-800 dark:text-white font-bold text-sm">
                      {t(`interests.options.${interest}.title`)}
                    </p>
                  </SelectableCard>
                ))}
              </div>

              {error && (
                <p className="text-red-500 text-xs mb-3 font-semibold">{error}</p>
              )}

              <CtaButton
                onClick={handleInterestContinue}
                disabled={data.interests.length === 0}
                step={step}
                className="max-w-xs w-full"
              >
                {t("common:buttons.continue")}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </CtaButton>
            </div>
          )}

          {/* ── STEP 4: Experience ──────────────────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-6 duration-500">
              <Spotlight color="rgba(245,158,11,0.15)">
                <div className="w-28 h-40 mb-2 relative z-10">
                  <ZaraVexCharacter
                    mood={expSelected ? "flirty" : "excited"}
                    showBubble={!!experienceBubble}
                    currentText={experienceBubble}
                    bubblePosition="top"
                    isTalking={isNarrationPlaying}
                  />
                </div>
              </Spotlight>

              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1 text-center">
                {t("experience.title")}
              </h2>
              <p className="text-gray-500 dark:text-white/70 text-sm mb-5 text-center">
                {t("experience.subtitle")}
              </p>

              <div className="w-full flex flex-col gap-3">
                {EXP_LEVELS.map((level) => (
                  <SelectableCard
                    key={level}
                    selected={data.experience_level === level}
                    onClick={() => { setExpSelected(true); handleExperienceSelect(level); }}
                    className="!text-left flex flex-row items-center gap-4 p-4"
                    onMouseEnter={() => setExpHovered(level)}
                    onMouseLeave={() => setExpHovered(null)}
                  >
                    <span className="text-3xl shrink-0">{EXP_ICONS[level]}</span>
                    <div>
                      <p className="text-gray-900 dark:text-white font-black text-base text-left">
                        {t(`experience.${level}.title`)}
                      </p>
                      <p className="text-gray-500 dark:text-white/70 text-sm mt-0.5 text-left leading-snug">
                        {t(`experience.${level}.description`)}
                      </p>
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Bottom safe-area spacer */}
        <div className="h-6 shrink-0" />
      </div>
    </>
  );
}
