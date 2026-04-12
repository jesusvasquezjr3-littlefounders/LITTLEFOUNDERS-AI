import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Img,
} from "remotion";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import { DrRhoCharacter } from "@/components/characters/DrRhoCharacter";
import { ZaraVexCharacter } from "@/components/characters/ZaraVexCharacter";

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ShowreelProps {
    isDarkMode: boolean;
    isMobile?: boolean;
    s_phase1_q1: string; s_phase1_q2: string; s_phase1_q3: string; s_phase1_glitch: string;
    s_phase2_line1: string; s_phase2_line2: string; s_phase2_highlight2: string;
    s_phase2_line3: string; s_phase2_line4: string; s_phase2_highlight4: string; s_phase2_line4b: string;
    s_phase3_line1: string; s_phase3_line2: string; s_phase3_highlight2: string;
    s_phase3_line3: string; s_phase3_highlight3: string;
    s_phase3_line4: string; s_phase3_line5: string; s_phase3_highlight5: string;
    s_phase4_line1: string; s_phase4_line2: string; s_phase4_highlight2: string;
    s_phase4_line3: string; s_phase4_line4: string; s_phase4_brand: string;
    s_cta_button: string; s_cta_headline: string; s_cta_sub: string;
    onCtaClick?: () => void;
}

// 5 phases × 300 frames each = 1500 total @ 30fps = 50s
export const TOTAL_FRAMES_SHOWREEL = 1500;

// ─── Phase boundaries (global frames) ─────────────────────────────────────────
const P1 = 0;
const P2 = 300;
const P3 = 600;
const P4 = 900;
const P5 = 1200;

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const LF = {
    primary:  "#5b6cf8",
    purple:   "#9333ea",
    pink:     "#ec4899",
    green:    "#22c55e",
    gold:     "#f59e0b",
    cyan:     "#06b6d4",
};
const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function tc(dark: boolean) { return dark ? "#f1f5f9" : "#1e1b4b"; }

// Highlight span with gradient text
function HL({ text, g }: { text: string; g: [string, string] }) {
    return (
        <span style={{
            background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 900, fontStyle: "italic",
        }}>{text}</span>
    );
}

// ─── Ambient Color Blob — provides color for backdrop-filter to blur ───────────
const Blob: React.FC<{
    x: number; y: number; w: number; h: number;
    color: string; blur?: number; opacity?: number; z?: number;
}> = ({ x, y, w, h, color, blur = 120, opacity = 1, z = 0 }) => (
    <div style={{
        position: "absolute",
        left: x, top: y, width: w, height: h,
        background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: "none",
        zIndex: z,
    }} />
);

// ─── Ultra Premium Liquid Glass Card ─────────────────────────────────────────
// NOTE: all startFrame values passed here MUST be global (absolute) frame numbers.
const GlassCard: React.FC<{
    children: React.ReactNode;
    globalStart: number;     // ← global frame at which this card enters
    dark: boolean;
    accent: string;          // hex color for left bar
    accentRgb: string;       // "r,g,b" for glow
}> = ({ children, globalStart, dark, accent, accentRgb }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // localT is frame distance FROM this card's own start — always correct
    const localT = frame - globalStart;
    if (localT < 0) return null;

    const spr = spring({ frame: localT, fps, config: { damping: 24, stiffness: 220, mass: 0.8 } });
    const yIn  = interpolate(spr, [0, 1], [32, 0]);
    const opIn = interpolate(localT, [0, 10], [0, 1], C);
    const sc   = interpolate(spr, [0, 1], [0.96, 1]);

    // Dark mode: near-opaque dark glass, light mode: semi-transparent white
    const bg = dark
        ? "linear-gradient(135deg, rgba(20,14,50,0.6) 0%, rgba(30,20,70,0.45) 100%)"
        : "linear-gradient(135deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.48) 100%)";

    const shadow = dark
        ? `
            0 0 0 1px rgba(255,255,255,0.06),
            0 1px 2px rgba(0,0,0,0.5),
            0 6px 16px rgba(0,0,0,0.5),
            0 20px 40px rgba(0,0,0,0.45),
            0 0 60px rgba(${accentRgb},0.18),
            inset 0 1px 0 rgba(255,255,255,0.14),
            inset 0 -1px 0 rgba(0,0,0,0.3)
          `
        : `
            0 0 0 1px rgba(255,255,255,0.55),
            0 1px 2px rgba(0,0,0,0.05),
            0 6px 16px rgba(0,0,0,0.07),
            0 20px 40px rgba(0,0,0,0.09),
            0 0 50px rgba(${accentRgb},0.1),
            inset 0 1px 0 rgba(255,255,255,0.95),
            inset 0 -1px 0 rgba(0,0,0,0.05)
          `;

    return (
        <div style={{
            transform: `translateY(${yIn}px) scale(${sc})`,
            opacity: opIn,
            width: "100%",
            willChange: "transform, opacity",
        }}>
            <div style={{
                position: "relative",
                borderRadius: 18,
                padding: "18px 28px 18px 32px",
                background: bg,
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderTop: dark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.9)",
                borderLeft: `3px solid ${accent}`,
                boxShadow: shadow,
                overflow: "hidden",
            }}>
                {/* Top specular reflection line */}
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 1,
                    background: dark
                        ? `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.12) 70%, transparent 100%)`
                        : `linear-gradient(90deg, transparent 0%, rgba(255,255,255,1) 40%, rgba(255,255,255,0.8) 70%, transparent 100%)`,
                    pointerEvents: "none",
                }} />
                {/* Diagonal shimmer overlay  */}
                <div style={{
                    position: "absolute", inset: 0, borderRadius: 18,
                    background: dark
                        ? "linear-gradient(115deg, rgba(255,255,255,0.05) 0%, transparent 45%, rgba(255,255,255,0.03) 100%)"
                        : "linear-gradient(115deg, rgba(255,255,255,0.55) 0%, transparent 45%, rgba(255,255,255,0.25) 100%)",
                    pointerEvents: "none",
                }} />
                {/* Colored left glow */}
                <div style={{
                    position: "absolute", left: -40, top: "50%", transform: "translateY(-50%)",
                    width: 100, height: 140, borderRadius: "50%",
                    background: `radial-gradient(ellipse, ${accent}50 0%, transparent 70%)`,
                    filter: "blur(18px)", pointerEvents: "none",
                }} />
                {/* Content */}
                <div style={{ position: "relative", zIndex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// ─── Glitch Card ──────────────────────────────────────────────────────────────
const GlitchCard: React.FC<{ text: string; globalStart: number; dark: boolean }> = ({ text, globalStart, dark }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const localT = frame - globalStart;
    if (localT < 0) return null;

    const spr = spring({ frame: localT, fps, config: { damping: 10, stiffness: 250, mass: 0.6 } });
    const op = interpolate(localT, [0, 6], [0, 1], C);
    const gx = Math.sin(frame * 2.2) * 4;
    const gy = Math.cos(frame * 2.8) * 2;

    const bg = dark
        ? "linear-gradient(135deg, rgba(20,10,60,0.7) 0%, rgba(10,5,40,0.55) 100%)"
        : "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.45) 100%)";

    return (
        <div style={{ transform: `scale(${interpolate(spr, [0, 1], [0.9, 1])})`, opacity: op, width: "100%" }}>
            <div style={{
                position: "relative", borderRadius: 18, padding: "20px 28px",
                background: bg,
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                border: `1.5px solid ${LF.primary}55`,
                borderTop: `1.5px solid ${LF.primary}99`,
                boxShadow: `
                    0 0 0 1px rgba(91,108,248,0.15),
                    0 8px 24px rgba(91,108,248,0.25),
                    0 20px 40px rgba(0,0,0,0.35),
                    0 0 80px rgba(91,108,248,0.2),
                    inset 0 1px 0 rgba(255,255,255,0.15)
                `,
                overflow: "hidden", textAlign: "center",
            }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${LF.primary}cc, transparent)` }} />
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${LF.primary}15 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ position: "relative", height: 50 }}>
                    <p style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,40,100,0.55)", transform: `translate(${gx + 3}px, ${gy}px)` }}>{text}</p>
                    <p style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase", color: "rgba(0,210,255,0.55)", transform: `translate(${-gx - 3}px, ${-gy}px)` }}>{text}</p>
                    <p style={{ position: "relative", margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase", color: dark ? "#ffffff" : "#1e1b4b", lineHeight: "50px" }}>{text}</p>
                </div>
            </div>
        </div>
    );
};

// ─── Floating Character ───────────────────────────────────────────────────────
// ALL frame values here MUST be GLOBAL (absolute) frame numbers — never phase-relative.
const FloatingChar: React.FC<{
    children: React.ReactNode;
    globalStart: number;
    globalExit: number;
    left: string;   // CSS left (px or %)
    top: string;    // CSS top (px or %)
    size: number;
    ampX?: number; ampY?: number; speed?: number; phase?: number;
    glow?: string;
    enterFrom?: "left" | "right" | "top" | "bottom";
    rotate?: number;
    baseOpacity?: number;
}> = ({
    children, globalStart, globalExit, left, top, size,
    ampX = 12, ampY = 18, speed = 0.05, phase = 0,
    glow, enterFrom = "bottom", rotate = 0, baseOpacity = 0.9,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const localT = frame - globalStart;
    const exitT  = Math.max(0, frame - globalExit);

    if (localT < 0 || frame > globalExit + 20) return null;

    const spr   = spring({ frame: localT, fps, config: { damping: 14, stiffness: 85, mass: 1.1 } });
    const opOut = interpolate(exitT, [0, 20], [1, 0], C);

    const d = 350;
    const ex = enterFrom === "left" ? -d : enterFrom === "right" ? d : 0;
    const ey = enterFrom === "top"  ? -d : enterFrom === "bottom" ? d : 0;

    const fx = Math.sin(frame * speed + phase) * ampX;
    const fy = Math.cos(frame * speed * 0.8 + phase) * ampY;

    return (
        <div style={{
            position: "absolute",
            left, top,
            width: size, height: size,
            transform: `
                translate(
                    ${interpolate(spr, [0, 1], [ex, 0]) + fx}px,
                    ${interpolate(spr, [0, 1], [ey, 0]) + fy}px
                )
                scale(${spr})
                rotate(${rotate}deg)
            `,
            opacity: interpolate(spr, [0, 0.4], [0, baseOpacity]) * opOut,
            filter: glow ? `drop-shadow(0 12px 35px ${glow}77)` : "drop-shadow(0 12px 35px rgba(0,0,0,0.5))",
            zIndex: 3,
            willChange: "transform, opacity",
        }}>
            {children}
        </div>
    );
};

// ─── Phase background wrapper with crossfade ──────────────────────────────────
const PhaseWrap: React.FC<{
    globalStart: number;
    globalEnd: number;
    background: string;
    children: React.ReactNode;
}> = ({ globalStart, globalEnd, background, children }) => {
    const frame = useCurrentFrame();
    const fadeIn  = interpolate(frame, [globalStart, globalStart + 22], [0, 1], C);
    const fadeOut = interpolate(frame, [globalEnd - 22, globalEnd],   [1, 0], C);
    if (frame < globalStart || frame > globalEnd) return null;
    return (
        <AbsoluteFill style={{ background, opacity: fadeIn * fadeOut }}>
            {children}
        </AbsoluteFill>
    );
};

// ─── Shared text props ────────────────────────────────────────────────────────
const tp = (dark: boolean, size = 28): React.CSSProperties => ({
    fontSize: size, fontWeight: 700, margin: 0,
    lineHeight: 1.45, color: tc(dark), letterSpacing: -0.5,
});

// ─── Phase 1 — El Gancho (frames 0–300) ──────────────────────────────────────
const Phase1: React.FC<{ p: ShowreelProps }> = ({ p }) => {
    const d = p.isDarkMode;
    return (
        <PhaseWrap globalStart={P1} globalEnd={P1 + 300}
            background={d
                ? "linear-gradient(160deg,#030210 0%,#0c0822 55%,#10081c 100%)"
                : "linear-gradient(160deg,#f1f5f9 0%,#e8eaf6 50%,#f0e8ff 100%)"}>

            {/* Rich color blobs — backdrop-filter will blur these */}
            <Blob x={700}  y={-80}  w={600} h={600} color={`${LF.primary}44`}  blur={120} z={1} />
            <Blob x={1200} y={400}  w={500} h={500} color={`${LF.purple}44`}   blur={100} z={1} />
            <Blob x={100}  y={300}  w={450} h={450} color={`${LF.pink}33`}     blur={110} z={1} />

            {/* Floating Dino — top right */}
            <FloatingChar globalStart={P1 + 20} globalExit={P1 + 285}
                left="1380px" top="80px" size={310}
                ampX={14} ampY={20} phase={0.6} glow={LF.gold} enterFrom="right" rotate={-6}>
                <DinoCharacter mood="excited" showBubble={false} />
            </FloatingChar>

            {/* Text column */}
            <div style={{
                position: "absolute", left: 80, top: 0, bottom: 0, width: 1200,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 18,
            }}>
                <GlassCard globalStart={P1 + 0}   dark={d} accent={LF.primary} accentRgb="91,108,248">
                    <p style={tp(d)}>{p.s_phase1_q1}</p>
                </GlassCard>
                <GlassCard globalStart={P1 + 75}  dark={d} accent={LF.pink}    accentRgb="236,72,153">
                    <p style={tp(d)}>{p.s_phase1_q2}</p>
                </GlassCard>
                <GlassCard globalStart={P1 + 150} dark={d} accent={LF.gold}    accentRgb="245,158,11">
                    <p style={tp(d)}>{p.s_phase1_q3}</p>
                </GlassCard>
                <GlitchCard globalStart={P1 + 222} dark={d} text={p.s_phase1_glitch} />
            </div>
        </PhaseWrap>
    );
};

// ─── Phase 2 — Mini Adulto (frames 300–600) ───────────────────────────────────
const Phase2: React.FC<{ p: ShowreelProps }> = ({ p }) => {
    const d = p.isDarkMode;
    return (
        <PhaseWrap globalStart={P2} globalEnd={P2 + 300}
            background={d
                ? "linear-gradient(160deg,#0f0520 0%,#1e0838 30%,#280a4e 60%,#120620 100%)"
                : "linear-gradient(160deg,#fdf4ff 0%,#f3e8ff 40%,#ede9fe 100%)"}>

            <Blob x={-80}  y={100}  w={700} h={600} color={`${LF.pink}40`}   blur={130} z={1} />
            <Blob x={1400} y={300}  w={550} h={550} color={`${LF.purple}44`} blur={110} z={1} />
            <Blob x={700}  y={500}  w={500} h={500} color={`${LF.cyan}30`}   blur={120} z={1} />

            {/* Floating Zara — top right */}
            <FloatingChar globalStart={P2 + 15} globalExit={P2 + 285}
                left="1380px" top="50px" size={320}
                ampX={12} ampY={22} phase={1.3} glow={LF.purple} enterFrom="right" rotate={-7}>
                <ZaraVexCharacter mood="curious" showBubble={false} />
            </FloatingChar>

            {/* Floating Dino — bottom left */}
            <FloatingChar globalStart={P2 + 35} globalExit={P2 + 285}
                left="60px" top="620px" size={280}
                ampX={14} ampY={16} phase={2.8} glow={LF.pink} enterFrom="left" rotate={8}>
                <DinoCharacter mood="excited" showBubble={false} />
            </FloatingChar>

            <div style={{
                position: "absolute", left: 380, top: 0, bottom: 0, width: 1160,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 18,
            }}>
                <GlassCard globalStart={P2 + 0}   dark={d} accent={LF.purple} accentRgb="147,51,234">
                    <p style={tp(d)}>{p.s_phase2_line1}</p>
                </GlassCard>
                <GlassCard globalStart={P2 + 72}  dark={d} accent={LF.pink}   accentRgb="236,72,153">
                    <p style={tp(d, 28)}>
                        {p.s_phase2_line2} <HL text={p.s_phase2_highlight2} g={[LF.pink, LF.gold]} />
                    </p>
                </GlassCard>
                <GlassCard globalStart={P2 + 150} dark={d} accent={LF.cyan}   accentRgb="6,182,212">
                    <p style={tp(d)}>{p.s_phase2_line3}</p>
                </GlassCard>
                <GlassCard globalStart={P2 + 222} dark={d} accent={LF.primary} accentRgb="91,108,248">
                    <p style={tp(d, 30)}>
                        {p.s_phase2_line4} <HL text={p.s_phase2_highlight4} g={[LF.primary, LF.cyan]} /> {p.s_phase2_line4b}
                    </p>
                </GlassCard>
            </div>
        </PhaseWrap>
    );
};

// ─── Phase 3 — La Solución (frames 600–900) ───────────────────────────────────
const Phase3: React.FC<{ p: ShowreelProps }> = ({ p }) => {
    const d = p.isDarkMode;
    return (
        <PhaseWrap globalStart={P3} globalEnd={P3 + 300}
            background={d
                ? "linear-gradient(160deg,#040c26 0%,#0c185e 30%,#100840 70%,#040a18 100%)"
                : "linear-gradient(160deg,#eff6ff 0%,#edf0ff 40%,#f0eeff 100%)"}>

            <Blob x={1200} y={-60}  w={700} h={600} color={`${LF.primary}48`} blur={130} z={1} />
            <Blob x={-80}  y={420}  w={600} h={600} color={`${LF.cyan}38`}    blur={120} z={1} />
            <Blob x={600}  y={600}  w={500} h={400} color={`${LF.gold}30`}    blur={110} z={1} />

            {/* Floating Dr. Rho — top right */}
            <FloatingChar globalStart={P3 + 10} globalExit={P3 + 285}
                left="1380px" top="60px" size={310}
                ampX={10} ampY={22} phase={0.3} glow={LF.cyan} enterFrom="top" rotate={-5}>
                <DrRhoCharacter mood="wise" showBubble={false} />
            </FloatingChar>

            {/* Floating Dina — bottom left */}
            <FloatingChar globalStart={P3 + 28} globalExit={P3 + 285}
                left="50px" top="600px" size={290}
                ampX={14} ampY={18} phase={3.5} glow={LF.pink} enterFrom="left" rotate={6}>
                <DinaCharacter expression="happy" enableMouseTracking={false} />
            </FloatingChar>

            <div style={{
                position: "absolute", left: 370, top: 0, bottom: 0, width: 1170,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 18,
            }}>
                <GlassCard globalStart={P3 + 0}   dark={d} accent={LF.gold}    accentRgb="245,158,11">
                    <p style={tp(d)}>{p.s_phase3_line1}</p>
                </GlassCard>
                <GlassCard globalStart={P3 + 62}  dark={d} accent={LF.primary} accentRgb="91,108,248">
                    <p style={tp(d, 30)}>
                        {p.s_phase3_line2} <HL text={p.s_phase3_highlight2} g={[LF.primary, LF.cyan]} />
                    </p>
                </GlassCard>
                <GlassCard globalStart={P3 + 130} dark={d} accent={LF.pink}    accentRgb="236,72,153">
                    <p style={tp(d, 30)}>
                        {p.s_phase3_line3} <HL text={p.s_phase3_highlight3} g={[LF.gold, LF.pink]} />
                    </p>
                </GlassCard>
                <GlassCard globalStart={P3 + 200} dark={d} accent={LF.green}   accentRgb="34,197,94">
                    <p style={tp(d)}>{p.s_phase3_line4}</p>
                </GlassCard>
                <GlassCard globalStart={P3 + 258} dark={d} accent={LF.cyan}    accentRgb="6,182,212">
                    <p style={tp(d, 30)}>
                        {p.s_phase3_line5} <HL text={p.s_phase3_highlight5} g={[LF.green, LF.cyan]} />
                    </p>
                </GlassCard>
            </div>
        </PhaseWrap>
    );
};

// ─── Phase 4 — La Promesa (frames 900–1200) ───────────────────────────────────
const Phase4: React.FC<{ p: ShowreelProps }> = ({ p }) => {
    const d = p.isDarkMode;
    return (
        <PhaseWrap globalStart={P4} globalEnd={P4 + 300}
            background={d
                ? "linear-gradient(180deg,#060410 0%,#0e0a20 50%,#080618 100%)"
                : "linear-gradient(180deg,#f8faff 0%,#eef2ff 50%,#f5f0ff 100%)"}>

            <Blob x={200}  y={-80}  w={700} h={600} color={`${LF.primary}40`} blur={130} z={1} />
            <Blob x={1300} y={500}  w={600} h={500} color={`${LF.pink}38`}    blur={110} z={1} />
            <Blob x={600}  y={400}  w={500} h={400} color={`${LF.purple}30`}  blur={120} z={1} />

            {/* Floating Dino — top left */}
            <FloatingChar globalStart={P4 + 10} globalExit={P4 + 285}
                left="60px" top="80px" size={300}
                ampX={12} ampY={20} phase={1.7} glow={LF.gold} enterFrom="left" rotate={-8}>
                <DinoCharacter mood="excited" showBubble={false} />
            </FloatingChar>

            {/* Floating Zara — bottom right */}
            <FloatingChar globalStart={P4 + 30} globalExit={P4 + 285}
                left="1380px" top="640px" size={270}
                ampX={14} ampY={16} phase={0.4} glow={LF.purple} enterFrom="right" rotate={7}>
                <ZaraVexCharacter mood="excited" showBubble={false} />
            </FloatingChar>

            <div style={{
                position: "absolute", left: 380, top: 0, bottom: 0, width: 1160,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 18,
            }}>
                <GlassCard globalStart={P4 + 0}   dark={d} accent={LF.primary} accentRgb="91,108,248">
                    <p style={tp(d)}>{p.s_phase4_line1}</p>
                </GlassCard>
                <GlassCard globalStart={P4 + 72}  dark={d} accent={LF.purple}  accentRgb="147,51,234">
                    <p style={tp(d, 30)}>
                        {p.s_phase4_line2} <HL text={p.s_phase4_highlight2} g={[LF.primary, LF.purple]} />
                    </p>
                </GlassCard>
                <GlassCard globalStart={P4 + 148} dark={d} accent={LF.gold}    accentRgb="245,158,11">
                    <p style={tp(d)}>{p.s_phase4_line3}</p>
                </GlassCard>
                <GlassCard globalStart={P4 + 220} dark={d} accent={LF.green}   accentRgb="34,197,94">
                    <p style={tp(d)}>{p.s_phase4_line4}</p>
                </GlassCard>
            </div>
        </PhaseWrap>
    );
};

// ─── Phase 5 — CTA (frames 1200–1500) ────────────────────────────────────────
const Phase5: React.FC<{ p: ShowreelProps }> = ({ p }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const d = p.isDarkMode;
    const fadeIn  = interpolate(frame, [P5, P5 + 25], [0, 1], C);
    const fadeOut = interpolate(frame, [P5 + 285, P5 + 300], [1, 0], C);
    if (frame < P5 || frame > P5 + 300) return null;

    const logoSpr  = spring({ frame: frame - (P5 + 20),  fps, config: { damping: 22, stiffness: 140 } });
    const brandSpr = spring({ frame: frame - (P5 + 60),  fps, config: { damping: 18, stiffness: 110 } });
    const subSpr   = spring({ frame: frame - (P5 + 100), fps, config: { damping: 20, stiffness: 120 } });
    const ctaSpr   = spring({ frame: frame - (P5 + 145), fps, config: { damping: 14, stiffness: 100 } });
    const ctaPulse = 1 + Math.sin(Math.max(0, frame - (P5 + 160)) * 0.12) * 0.018;

    const bg = d
        ? "linear-gradient(180deg,#060410 0%,#100824 50%,#080618 100%)"
        : "linear-gradient(180deg,#f8faff 0%,#eef2ff 50%,#f5f0ff 100%)";

    return (
        <AbsoluteFill style={{ background: bg, opacity: fadeIn * fadeOut }}>
            <Blob x={500}  y={0}    w={900} h={700} color={`${LF.primary}30`} blur={150} z={1} />
            <Blob x={300}  y={600}  w={700} h={500} color={`${LF.pink}28`}    blur={130} z={1} />
            <Blob x={1200} y={200}  w={600} h={600} color={`${LF.purple}28`}  blur={140} z={1} />

            {/* All 4 characters floating at corners */}
            <FloatingChar globalStart={P5 + 25} globalExit={P5 + 295} left="60px"   top="60px"  size={260} ampX={10} ampY={18} phase={0.3} glow={LF.gold}   enterFrom="left"   rotate={-5} baseOpacity={0.82}>
                <DinoCharacter mood="excited" showBubble={false} />
            </FloatingChar>
            <FloatingChar globalStart={P5 + 35} globalExit={P5 + 295} left="1610px" top="60px"  size={250} ampX={12} ampY={16} phase={2.0} glow={LF.pink}   enterFrom="right"  rotate={6}  baseOpacity={0.78}>
                <DinaCharacter expression="happy" enableMouseTracking={false} />
            </FloatingChar>
            <FloatingChar globalStart={P5 + 45} globalExit={P5 + 295} left="60px"   top="750px" size={250} ampX={10} ampY={20} phase={3.5} glow={LF.cyan}   enterFrom="left"   rotate={8}  baseOpacity={0.75}>
                <DrRhoCharacter mood="wise" showBubble={false} />
            </FloatingChar>
            <FloatingChar globalStart={P5 + 55} globalExit={P5 + 295} left="1610px" top="750px" size={250} ampX={14} ampY={14} phase={1.5} glow={LF.purple} enterFrom="right"  rotate={-8} baseOpacity={0.75}>
                <ZaraVexCharacter mood="excited" showBubble={false} />
            </FloatingChar>

            {/* Center content */}
            <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 28,
                zIndex: 10,
            }}>
                {/* Logo */}
                {frame >= P5 + 20 && (
                    <div style={{
                        transform: `translateY(${interpolate(logoSpr, [0, 1], [28, 0])}px) scale(${logoSpr})`,
                        opacity: interpolate(frame, [P5 + 20, P5 + 38], [0, 1], C),
                    }}>
                        <Img src="/logo-sized.png" style={{ height: 56, filter: `drop-shadow(0 4px 18px ${LF.primary}88)` }} />
                    </div>
                )}

                {/* Subtitle */}
                {frame >= P5 + 100 && (
                    <div style={{
                        transform: `translateY(${interpolate(subSpr, [0, 1], [20, 0])}px)`,
                        opacity: interpolate(frame, [P5 + 100, P5 + 115], [0, 1], C),
                    }}>
                        <p style={{
                            fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: 0.5,
                            color: d ? "rgba(148,163,184,0.9)" : "rgba(100,116,139,0.9)",
                            textAlign: "center",
                        }}>{p.s_cta_sub}</p>
                    </div>
                )}

                {/* CTA Button */}
                {frame >= P5 + 145 && (
                    <div style={{
                        transform: `translateY(${interpolate(ctaSpr, [0, 1], [28, 0])}px) scale(${ctaSpr * ctaPulse})`,
                        opacity: interpolate(frame, [P5 + 145, P5 + 162], [0, 1], C),
                    }}>
                        <button
                            onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                if (p.onCtaClick) p.onCtaClick();
                                else window.location.href = "/register";
                            }}
                            style={{
                                background: `linear-gradient(135deg, ${LF.primary} 0%, ${LF.purple} 100%)`,
                                border: "none", borderRadius: 18, cursor: "pointer",
                                fontSize: 30, fontWeight: 900, color: "white",
                                letterSpacing: 3, textTransform: "uppercase",
                                boxShadow: `
                                    0 0 0 1px ${LF.primary}55,
                                    0 18px 45px ${LF.primary}55,
                                    0 0 80px ${LF.primary}22,
                                    inset 0 1px 0 rgba(255,255,255,0.25)
                                `,
                                padding: "22px 64px", outline: "none",
                                pointerEvents: "auto", fontFamily: "'Inter', sans-serif",
                                position: "relative", overflow: "hidden",
                                backdropFilter: "blur(10px)",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px ${LF.primary}99, 0 24px 55px ${LF.primary}77, 0 0 100px ${LF.primary}44, inset 0 1px 0 rgba(255,255,255,0.3)`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px ${LF.primary}55, 0 18px 45px ${LF.primary}55, 0 0 80px ${LF.primary}22, inset 0 1px 0 rgba(255,255,255,0.25)`; }}
                        >
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)", borderRadius: 18 }} />
                            <span style={{ position: "relative" }}>{p.s_cta_button}</span>
                        </button>
                    </div>
                )}
            </div>
        </AbsoluteFill>
    );
};

// ─── Main Composition ─────────────────────────────────────────────────────────
export const ShowreelComposition: React.FC<ShowreelProps> = (props) => (
    <AbsoluteFill style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", overflow: "hidden" }}>
        <Phase1 p={props} />
        <Phase2 p={props} />
        <Phase3 p={props} />
        <Phase4 p={props} />
        <Phase5 p={props} />
    </AbsoluteFill>
);
