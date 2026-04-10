import React, { useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
    DemoShowreelComposition,
    TOTAL_FRAMES_SHOWREEL,
    type DemoShowreelProps,
} from "./DemoShowreelComposition";

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
const DemoShowreelPlayer = React.memo(function DemoShowreelPlayer({ playerRef: externalRef }: { playerRef?: React.RefObject<any> }) {
    const playerRef = useRef<PlayerRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation("demo");
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

    // Offscreen Pause/Resume: stop ALL computation when not visible
    const isVisibleRef = useRef(false);
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                isVisibleRef.current = entry.isIntersecting;
                try {
                    if (entry.isIntersecting) {
                        playerRef.current?.play();
                    } else {
                        playerRef.current?.pause();
                    }
                } catch (_) { }
            },
            { threshold: 0.05 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Scroll Pause: pause rendering while the user is actively scrolling
    useEffect(() => {
        let scrollTimeout: NodeJS.Timeout;
        const handleScroll = () => {
            if (!isVisibleRef.current) return;
            try { playerRef.current?.pause(); } catch (_) { }

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (isVisibleRef.current) {
                    try { playerRef.current?.play(); } catch (_) { }
                }
            }, 150); // Resume 150ms after scroll stops
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, []);

    const fps = isMobile ? FPS_MOBILE : FPS_DESKTOP;
    // Scale duration proportionally so animation plays at same real-time speed
    const scaledFrames = isMobile
        ? Math.round(TOTAL_FRAMES_SHOWREEL * (FPS_MOBILE / FPS_DESKTOP))
        : TOTAL_FRAMES_SHOWREEL;

    const inputProps: DemoShowreelProps = {
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
        s_phase2_line3: t("showreel.phase2_line3"),
        s_phase2_line4: t("showreel.phase2_line4"),
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
        onCtaClick: () => navigate("/register"),
    };

    return (
        <div
            ref={wrapperRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
            <Player
                ref={playerRef}
                component={DemoShowreelComposition}
                durationInFrames={scaledFrames}
                fps={fps}
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
                    pointerEvents: "auto",
                }}
                acknowledgeRemotionLicense
            />
        </div>
    );
});

export { DemoShowreelPlayer };
