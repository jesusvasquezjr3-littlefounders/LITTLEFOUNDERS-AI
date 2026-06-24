import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

export function GamifiedLearningSection() {
  const { t } = useTranslation("landing");

  const benefits = [
    t("solution.benefit1"),
    t("solution.benefit2"),
    t("solution.benefit3"),
  ];
  return (
    <section className="relative py-20 md:py-28 bg-white dark:bg-[#070b14] overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

          <div className="flex-1 space-y-6 text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {t("solution.title_part1")}
              <br />
              {t("solution.title_part2")}{" "}
              <span className="text-indigo-600 dark:text-indigo-400">
                {t("solution.title_highlight")}
              </span>
            </h2>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto md:mx-0">
              {t("solution.subtitle")}
            </p>

            <ul className="space-y-3 text-left max-w-xl mx-auto md:mx-0">
              {benefits.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 w-full relative flex items-center justify-center">
            <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]">
              <video
                src="/video/8747232-sd_960_540_25fps.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default GamifiedLearningSection;
