import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChevronRight, Check, Sparkles } from "lucide-react";
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

// ─── Premium progress bar ─────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const { t } = useTranslation("onboarding");
  if (step === 0) return null;

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="w-full flex flex-col gap-2 px-6 pt-7 pb-1 max-w-7xl mx-auto relative z-10">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="corp-caption uppercase tracking-[0.22em]">
          {t("progress.step_of", { current: step, total: TOTAL_STEPS })}
        </span>
        <span className="corp-caption">
          {progress}%
        </span>
      </div>

      {/* Track */}
      <div className="relative w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
              className="w-6 h-2 flex items-center justify-center"
            >
              <div
                  className={cn(
                   "w-2 h-2 rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] origin-left",
                   active
                     ? "bg-indigo-500 dark:bg-indigo-400 scale-x-[3]"
                     : done
                     ? "bg-indigo-400 dark:bg-indigo-500 scale-x-100"
                     : "bg-slate-200 dark:bg-white/15 scale-x-100"
                 )}
              />
            </div>
          );
        })}
      </div>
    </div>
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

  const { playFile, mute, playBGM, stopBGM } = useSound();
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

  // ── Background Music ──────────────────────────────────────────────────
  useEffect(() => {
    playBGM('/sounds/edu/background.mp3', { volume: 0.3 });
    return () => {
      stopBGM({ fade: true, fadeDuration: 1500 });
    };
  }, [playBGM, stopBGM]);

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
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a]">
      
      

      

      {/* Progress bar */}
      <ProgressBar step={step} />

      {/* ── Step content — Lesson Engine grid: character left on desktop ── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 pb-8 pt-4 lg:gap-8 max-w-7xl mx-auto w-full overflow-y-auto min-h-0">

        {/* ── Left column: Character ──────────────────────────────────── */}
        <div className="w-full lg:w-[38%] flex flex-col items-center justify-center flex-shrink-0 lg:sticky lg:top-0 lg:h-full">

          {step === 0 && (
            <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 relative z-10 drop-shadow-xl animate-in fade-in zoom-in-[0.96] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <DinoCharacter mood="happy" showBubble currentText={t("welcome.liruf_bubble")} bubblePosition="standard" isTalking={isNarrationPlaying} />
            </div>
          )}
          {step === 1 && (
            <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 relative z-10 drop-shadow-xl animate-in fade-in duration-300">
              <DinoCharacter mood={nameInput.trim().length > 0 ? "excited" : "happy"} showBubble={!!nameBubble} currentText={nameBubble} bubblePosition="standard" isTalking={isNarrationPlaying} />
            </div>
          )}
          {step === 2 && (
            <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 relative z-10 drop-shadow-xl animate-in fade-in duration-300">
              <DinaCharacter expression={(() => { const p = parseInt(ageInput.trim(), 10); return !isNaN(p) && p >= 6 && p <= 100 ? "surprised" : "wink"; })()} showBubble={!!ageBubble} currentText={ageBubble} bubblePosition="standard" isTalking={isNarrationPlaying} />
            </div>
          )}
          {step === 3 && (
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 relative z-10 drop-shadow-xl animate-in fade-in duration-300">
              <DrRhoCharacter mood="explaining" showBubble={!!interestsBubble} currentText={interestsBubble} bubblePosition="top" isTalking={isNarrationPlaying} />
            </div>
          )}
          {step === 4 && (
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 relative z-10 drop-shadow-xl animate-in fade-in duration-300">
              <ZaraVexCharacter mood={expSelected ? "flirty" : expHovered ? "excited" : "happy"} showBubble={!!experienceBubble} currentText={experienceBubble} bubblePosition="top" isTalking={isNarrationPlaying} />
            </div>
          )}
        </div>

        {/* ── Right column: Content ───────────────────────────────────── */}
        <div className="w-full lg:w-[62%] flex flex-col items-center justify-center lg:min-h-0 max-w-lg mx-auto lg:mx-0">

          {/* ── STEP 0: Welcome ───────────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-[0.96] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] w-full p-7 sm:p-9 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-slate-200/50 dark:border-white/5 space-y-3 text-center">
                <h1 className="corp-h4">
                  {t("welcome.liruf_greeting")}
                </h1>
                <p className="corp-body">
                  {t("welcome.liruf_intro")}
                </p>
                <div className="pt-3 border-t border-slate-200/50 dark:border-white/8">
                  <p className="corp-eyebrow">
                    {t("welcome.characters_intro")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartFromWelcome}
                className="corp-btn-primary w-full h-12 mt-6 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 group"
              >
                {t("welcome.start_button")}
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]" />
              </button>
            </div>
          )}

          {/* ── STEP 1: Name ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-4 duration-300">
              {nameInput.trim().length > 0 && (
                <p className="corp-eyebrow mb-4 animate-in fade-in duration-300">
                  {t("name.liruf_done", { name: nameInput.trim() })}
                </p>
              )}
              <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] w-full p-8 sm:p-10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-slate-200/50 dark:border-white/5 space-y-5">
                <div className="text-center">
                  <h2 className="corp-h4 mb-1">
                    {t("name.question")}
                  </h2>
                  <p className="corp-body-sm">
                    {t("name.subtitle")}
                  </p>
                </div>
                <div className="space-y-2">
                  <input
                    ref={nameRef}
                    type="text"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleNameContinue()}
                    placeholder={t("name.placeholder")}
                    maxLength={50}
                    className={cn(
                      "corp-input h-14 px-4 text-center text-lg font-bold",
                      error && "corp-input--error"
                    )}
                  />
                  {error && <p className="corp-caption text-red-500 font-semibold">{error}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleNameContinue}
                  className="corp-btn-primary w-full h-12 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 group"
                >
                  {t("name.continue")}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Age ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-4 duration-300">
              {(() => {
                const parsedAge = parseInt(ageInput.trim(), 10);
                const isValidAge = ageInput.trim() !== "" && !isNaN(parsedAge) && parsedAge >= 6 && parsedAge <= 100;
                const isInvalidAge = ageInput.trim() !== "" && !isNaN(parsedAge) && (parsedAge < 6 || parsedAge > 100);
                if (isValidAge) return <p className="corp-eyebrow mb-4 animate-in fade-in duration-300">{t("age.dina_done", { age: ageInput.trim() })}</p>;
                if (isInvalidAge) return <p className="corp-caption mb-4 animate-in fade-in duration-300 text-red-500 dark:text-red-400">{t("errors.age_range")}</p>;
                return null;
              })()}
              <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] w-full p-8 sm:p-10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-slate-200/50 dark:border-white/5 space-y-5">
                <div className="text-center">
                  <h2 className="corp-h4 mb-1">{t("age.question")}</h2>
                  <p className="corp-body-sm">{t("age.subtitle")}</p>
                </div>
                <div className="space-y-2">
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
                      "corp-input h-14 px-4 text-center text-lg font-bold",
                      "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      error && "corp-input--error"
                    )}
                  />
                  {error && <p className="corp-caption text-red-500 font-semibold">{error}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleAgeContinue}
                  className="corp-btn-primary w-full h-12 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 group"
                >
                  {t("age.continue")}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Interests ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-5">
                <h2 className="corp-h4 mb-1">{t("interests.title")}</h2>
                <p className="corp-body-sm">{t("interests.subtitle")}</p>
              </div>
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-5">
                {INTERESTS.map((interest) => {
                  const selected = data.interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "relative rounded-xl p-3 sm:p-4 text-center cursor-pointer border-2 bg-white dark:bg-white/5",
                        "transition-[border-color,background-color,transform] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50",
                        "active:scale-[0.97]",
                        selected
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10"
                          : "border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/30 hover:bg-slate-50 dark:hover:bg-white/10"
                      )}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 dark:bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">
                        {t(`interests.options.${interest}.icon`)}
                      </div>
                      <p className="corp-body-sm font-semibold">
                        {t(`interests.options.${interest}.title`)}
                      </p>
                    </button>
                  );
                })}
              </div>
              {error && <p className="corp-caption text-red-500 mb-3 font-semibold">{error}</p>}
              <button
                onClick={handleInterestContinue}
                disabled={data.interests.length === 0}
                className="corp-btn-primary max-w-xs w-full h-12 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common:buttons.continue")}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]" />
              </button>
            </div>
          )}

          {/* ── STEP 4: Experience ────────────────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-5">
                <h2 className="corp-h4 mb-1">{t("experience.title")}</h2>
                <p className="corp-body-sm">{t("experience.subtitle")}</p>
              </div>
              <div className="w-full flex flex-col gap-2.5 sm:gap-3">
                {EXP_LEVELS.map((level) => {
                  const selected = data.experience_level === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => { setExpSelected(true); handleExperienceSelect(level); }}
                      onMouseEnter={() => setExpHovered(level)}
                      onMouseLeave={() => setExpHovered(null)}
                      className={cn(
                        "relative rounded-xl p-3 sm:p-4 text-left flex flex-row items-center gap-3 sm:gap-4 cursor-pointer border-2 bg-white dark:bg-white/5",
                        "transition-[border-color,background-color,transform] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50",
                        "active:scale-[0.97]",
                        selected
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10"
                          : "border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/30 hover:bg-slate-50 dark:hover:bg-white/10"
                      )}
                    >
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 dark:bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <span className="text-3xl shrink-0">{EXP_ICONS[level]}</span>
                      <div>
                        <p className="corp-h4">
                          {t(`experience.${level}.title`)}
                        </p>
                        <p className="corp-body-sm mt-0.5">
                          {t(`experience.${level}.description`)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
