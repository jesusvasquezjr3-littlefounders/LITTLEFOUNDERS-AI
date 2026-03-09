import React, { useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTranslation } from "react-i18next";
import {
    DemoShowreelComposition,
    TOTAL_FRAMES_SHOWREEL,
    type DemoShowreelProps,
} from "./DemoShowreelComposition";

// 1920x1080 cinematic canvas
const COMP_W = 1920;
const COMP_H = 1080;
const FPS = 30;

/**
 * Memoized Remotion Player wrapper for the Demo Showreel.
 */
const DemoShowreelPlayer = React.memo(function DemoShowreelPlayer() {
    const playerRef = useRef<PlayerRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation("demo");

    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    setIsDark(document.documentElement.classList.contains("dark"));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    try { playerRef.current?.play(); } catch (_) { }
                    obs.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const inputProps: DemoShowreelProps = {
        isDarkMode: isDark,
        isMobile: isMobile,
        s_hook_title: t("showreel.hook_title"),
        s_hook_subtitle: t("showreel.hook_subtitle"),
        s_lesson_title: t("showreel.lesson_title"),
        s_lesson_question: t("showreel.lesson_question"),
        s_lesson_opt_a: t("showreel.lesson_opt_a"),
        s_lesson_opt_b: t("showreel.lesson_opt_b"),
        s_lesson_opt_c: t("showreel.lesson_opt_c"),
        s_lesson_opt_d: t("showreel.lesson_opt_d"),
        s_lesson_badge_xp: t("showreel.lesson_badge_xp"),
        s_lesson_badge_level: t("showreel.lesson_badge_level"),
        s_games_title: t("showreel.games_title"),
        s_games_badge_1: t("showreel.games_badge_1"),
        s_games_badge_2: t("showreel.games_badge_2"),
        s_games_badge_3: t("showreel.games_badge_3"),
        s_bank_title: t("showreel.bank_title"),
        s_bank_balance_label: t("showreel.bank_balance_label"),
        s_bank_limit_1: t("showreel.bank_limit_1"),
        s_bank_limit_2: t("showreel.bank_limit_2"),
        s_bank_badge: t("showreel.bank_badge"),
        s_ai_title: t("showreel.ai_title"),
        s_ai_user_msg: t("showreel.ai_user_msg"),
        s_ai_bot_msg: t("showreel.ai_bot_msg"),
        s_char_liruf: t("showreel.char_liruf"),
        s_char_dina: t("showreel.char_dina"),
        s_char_rho: t("showreel.char_rho"),
        s_char_zara: t("showreel.char_zara"),
        s_cta_headline: t("showreel.cta_headline"),
        s_cta_sub: t("showreel.cta_sub"),
        s_cta_button: t("showreel.cta_button"),
        s_stat_lessons: t("showreel.stat_lessons"),
        s_stat_games: t("showreel.stat_games"),
        s_stat_ai: t("showreel.stat_ai"),
        s_stat_bank: t("showreel.stat_bank"),
        s_ai_typing: t("showreel.ai_typing"),
        s_game_lemonade: t("showreel.game_lemonade"),
        s_game_market: t("showreel.game_market"),
        s_game_stocks: t("showreel.game_stocks"),
        s_game_factory: t("showreel.game_factory"),
        s_game_farm: t("showreel.game_farm"),
        s_game_risk: t("showreel.game_risk"),
        s_badge_win: t("showreel.badge_win"),
        s_badge_money: t("showreel.badge_money"),
        s_badge_parental: t("showreel.badge_parental"),
        s_card_name: t("showreel.card_name"),
        s_card_number: t("showreel.card_number"),
        s_social_title: t("showreel.social_title"),
        s_social_streak: t("showreel.social_streak"),
        s_social_incentive: t("showreel.social_incentive"),
        s_social_privacy: t("showreel.social_privacy"),
        s_dash_lessons: t("showreel.dash_lessons"),
        s_dash_minutes: t("showreel.dash_minutes"),
        s_dash_points: t("showreel.dash_points"),
        s_dash_streak: t("showreel.dash_streak"),
    };

    return (
        <div ref={wrapperRef} className="absolute inset-0 w-full h-full overflow-hidden">
            <Player
                ref={playerRef}
                component={DemoShowreelComposition}
                durationInFrames={TOTAL_FRAMES_SHOWREEL}
                fps={FPS}
                compositionWidth={COMP_W}
                compositionHeight={COMP_H}
                inputProps={inputProps}
                loop
                controls={false}
                clickToPlay={false}
                allowFullscreen={false}
                style={{
                    width: "100%",
                    height: "100%",
                    // OVERRIDE: cover ensures the 3D space bleeds off the edges continuously
                    // rather than creating "empty" letterboxes that look like a video player.
                    objectFit: "cover",
                    position: "absolute",
                }}
                acknowledgeRemotionLicense
            />
        </div>
    );
});

export { DemoShowreelPlayer };
