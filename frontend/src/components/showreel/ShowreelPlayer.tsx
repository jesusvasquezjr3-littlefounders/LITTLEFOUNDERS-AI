import React, { useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
    ShowreelComposition,
    TOTAL_FRAMES_SHOWREEL,
    type ShowreelProps,
} from "./ShowreelComposition";

// 1920x1080 cinematic canvas
const COMP_W = 1920;
const COMP_H = 1080;
const FPS_DESKTOP = 30;
const FPS_MOBILE = 15;

/**
 * Memoized Remotion Player wrapper for the Demo Showreel.
 * Optimizations:
 *  - Dynamic FPS: 15fps on mobile (<768px), 30fps on desktop
 *  - Offscreen Pause: Player pauses entirely when scrolled out of viewport
 *  - Adjusts durationInFrames proportionally so animation speed stays constant
 */
const ShowreelPlayer = React.memo(function ShowreelPlayer({ playerRef: externalRef }: { playerRef?: React.RefObject<any> }) {
    const playerRef = useRef<PlayerRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation("landing");
    const navigate = useNavigate();

    // Sync internal playerRef to external so parent can poll getCurrentFrame
    useEffect(() => {
        if (externalRef) {
            (externalRef as React.MutableRefObject<any>).current = playerRef.current;
        }
    });

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

    // Scroll Pause/Play features removed: The component now acts as an interactive video
    const fps = isMobile ? FPS_MOBILE : FPS_DESKTOP;
    // Scale duration proportionally so animation plays at same real-time speed
    const scaledFrames = isMobile
        ? Math.round(TOTAL_FRAMES_SHOWREEL * (FPS_MOBILE / FPS_DESKTOP))
        : TOTAL_FRAMES_SHOWREEL;

    const inputProps: ShowreelProps = {
        isDarkMode: isDark,
        isMobile: isMobile,
        // Phase 1
        s_phase1_q1: t("showreel.phase1_q1"),
        s_phase1_q2: t("showreel.phase1_q2"),
        s_phase1_q3: t("showreel.phase1_q3"),
        s_phase1_glitch: t("showreel.phase1_glitch"),
        // Phase 2
        s_phase2_line1: t("showreel.phase2_line1"),
        s_phase2_line2: t("showreel.phase2_line2"),
        s_phase2_highlight2: t("showreel.phase2_highlight2"),
        s_phase2_line3: t("showreel.showPhase2Line3") || t("showreel.phase2_line3"),
        s_phase2_line4: t("showreel.showPhase2Line4") || t("showreel.phase2_line4"),
        s_phase2_highlight4: t("showreel.phase2_highlight4"),
        s_phase2_line4b: t("showreel.phase2_line4b"),
        // Phase 3
        s_phase3_line1: t("showreel.phase3_line1"),
        s_phase3_line2: t("showreel.phase3_line2"),
        s_phase3_highlight2: t("showreel.phase3_highlight2"),
        s_phase3_line3: t("showreel.phase3_line3"),
        s_phase3_highlight3: t("showreel.phase3_highlight3"),
        s_phase3_line4: t("showreel.phase3_line4"),
        s_phase3_line5: t("showreel.phase3_line5"),
        s_phase3_highlight5: t("showreel.phase3_highlight5"),
        // Phase 4
        s_phase4_line1: t("showreel.phase4_line1"),
        s_phase4_line2: t("showreel.phase4_line2"),
        s_phase4_highlight2: t("showreel.phase4_highlight2"),
        s_phase4_line3: t("showreel.phase4_line3"),
        s_phase4_line4: t("showreel.phase4_line4"),
        s_phase4_brand: t("showreel.phase4_brand"),
        // CTA
        s_cta_button: t("showreel.cta_button"),
        s_cta_headline: t("showreel.cta_headline"),
        s_cta_sub: t("showreel.cta_sub"),
        onCtaClick: () => navigate("/signup"),
    };

    return (
        <div
            ref={wrapperRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            className="rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-white/10"
        >
            <Player
                ref={playerRef}
                component={ShowreelComposition}
                durationInFrames={scaledFrames}
                fps={fps}
                compositionWidth={COMP_W}
                compositionHeight={COMP_H}
                inputProps={inputProps}
                loop
                controls={true}
                clickToPlay={true}
                allowFullscreen={true}
                style={{
                    width: "100%",
                    height: "100%",
                    pointerEvents: "auto",
                }}
                acknowledgeRemotionLicense
            />
        </div>
    );
});

export { ShowreelPlayer };
