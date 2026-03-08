import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Sequence,
} from "remotion";

// ─── Types & Tokens ────────────────────────────────────────────────────────
export interface GamifiedLearningProps {
    step1_label: string;
    step2_label: string;
    step3_label: string;
    step4_label: string;
    step5_label: string;
    challenge: string;
    option_a: string;
    option_b: string;
    option_c: string;
    xp_label: string;
    level_label: string;
    coins_label: string;
    games_title: string;
    sim_title: string;
    ai_title: string;
    bank_title: string;
    ui_timeline: string;
    ui_preview: string;
    ui_engine: string;
}

const LF = {
    primary: "#5b6cf8",
    purple: "#9333ea",
    pink: "#ec4899",
    green: "#22c55e",
    gold: "#f59e0b",
    danger: "#ef4444",
    bgCard: "#1e2333",
    bgDark: "#0f1220",
    border: "rgba(255,255,255,0.12)",
    textPrimary: "#f8fafc",
    textMuted: "rgba(255,255,255,0.6)",
    radius: 16,
};
const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

function sp(frame: number, fps: number, from = 0, damping = 14, stiffness = 160) {
    return spring({ frame: frame - from, fps, config: { damping, stiffness, mass: 1 } });
}

// ─── Shared 3D Panel ────────────────────────────────────────────────────────
const Panel3D: React.FC<{
    children: React.ReactNode;
    width: number | string;
    height: number | string;
    zOffset?: number;
    rx?: number; // extra rotation X
    ry?: number; // extra rotation Y
    rz?: number; // extra rotation Z
    style?: React.CSSProperties;
    delay?: number;
    delayY?: number;
    accent?: string;
}> = ({ children, width, height, zOffset = 0, rx = 0, ry = 0, rz = 0, style, delay = 0, delayY = 0, accent }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Entrance animation
    const scale = interpolate(sp(frame, fps, delay, 12, 140), [0, 1], [0.8, 1]);
    const opacity = interpolate(frame, [delay, delay + 10], [0, 1], C);

    // Continuous floating bob
    const float = Math.sin((frame + delayY * 5) / 30) * 12;

    return (
        <div
            style={{
                position: "absolute",
                width,
                height,
                transformStyle: "preserve-3d",
                transform: `
                    translateZ(${zOffset + float}px) 
                    rotateX(${rx}deg) 
                    rotateY(${ry}deg) 
                    rotateZ(${rz}deg)
                    scale(${scale})
                `,
                opacity,
                background: "rgba(30, 35, 51, 0.85)", // Glassy
                backdropFilter: "blur(12px)",
                border: `1px solid ${LF.border}`,
                borderRadius: LF.radius,
                boxShadow: `
                    -20px 30px 40px rgba(0,0,0,0.5),
                    inset 0 1px 1px rgba(255,255,255,0.1)
                `,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...style,
            }}
        >
            {accent && <div style={{ height: 4, background: accent, width: "100%", flexShrink: 0 }} />}
            {children}
        </div>
    );
};

// ─── Main Editor Window (Center) ──────────────────────────────────────────
const EditorWindow: React.FC<{ props: GamifiedLearningProps }> = ({ props }) => {
    const frame = useCurrentFrame();

    // Cycle through 4 mock "views" to represent the learning journey
    // 900 frames / 225 frames per view
    const cycle = Math.floor(frame / (900 / 4)) % 4;

    const views = [
        {
            icon: "📚", title: props.step1_label, color: LF.primary,
            content: <div style={{ fontSize: 16, fontWeight: "bold", padding: 24, lineHeight: 1.5 }}>{props.challenge}</div>
        },
        {
            icon: "🎮", title: props.games_title, color: LF.green,
            content: <div style={{ display: "flex", gap: 16, padding: 24, flexWrap: "wrap", justifyContent: "center" }}>
                {[1, 2, 3, 4].map(i => <div key={i} style={{ width: 60, height: 60, background: `linear-gradient(135deg, ${LF.green}44, ${LF.green}11)`, borderRadius: 12, border: `1px solid ${LF.green}44` }} />)}
            </div>
        },
        {
            icon: "🚀", title: props.sim_title, color: LF.gold,
            content: <div style={{ padding: 24, width: "100%", height: "100%", display: "flex", alignItems: "flex-end", gap: 8 }}>
                {[40, 60, 30, 80, 50, 90, 100].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(0deg, ${LF.gold}, transparent)`, borderRadius: "4px 4px 0 0" }} />)}
            </div>
        },
        {
            icon: "🏦", title: props.bank_title, color: LF.purple,
            content: <div style={{ padding: 24, fontSize: 42, fontWeight: 900, color: LF.textPrimary, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
                $3,240.50
                <span style={{ fontSize: 16, color: LF.green, marginTop: 10 }}>+12.5% {props.xp_label}</span>
            </div>
        }
    ];

    const current = views[cycle];

    // Animates the inner content fading in and out on view switch
    const viewFrame = frame % (900 / 4);
    const contentOpacity = interpolate(viewFrame, [0, 15, (900 / 4) - 15, 900 / 4], [0, 1, 1, 0]);

    return (
        <Panel3D
            width={520} height={320} zOffset={60} delay={10} delayY={0}
            style={{ left: "50%", top: "40%", marginLeft: -260, marginTop: -160 }}
            accent={`linear-gradient(90deg, ${current.color}, ${LF.pink})`}
        >
            {/* Window header */}
            <div style={{ height: 36, borderBottom: `1px solid ${LF.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 8, background: "rgba(0,0,0,0.2)" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: LF.danger }} />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: LF.gold }} />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: LF.green }} />
                <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: "bold", color: LF.textMuted }}>{props.ui_engine}</div>
            </div>

            {/* Header / Title */}
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 32 }}>{current.icon}</div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: LF.textPrimary, letterSpacing: 0.5 }}>{current.title}</div>
                    <div style={{ fontSize: 12, color: current.color, fontWeight: "bold", marginTop: 4 }}>{props.level_label} 2 · {props.coins_label}: 150</div>
                </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, background: "rgba(0,0,0,0.25)", margin: "0 24px 24px", borderRadius: 12, border: `1px solid ${LF.border}`, overflow: "hidden", position: "relative" }}>
                <div style={{ opacity: contentOpacity, width: "100%", height: "100%" }}>
                    {current.content}
                </div>

                {/* Simulated playhead sweep over the inner content */}
                <div style={{
                    position: "absolute",
                    top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.5)",
                    boxShadow: `0 0 15px rgba(255,255,255,0.8)`,
                    left: `${(viewFrame / (900 / 4)) * 100}%`
                }} />
            </div>
        </Panel3D>
    );
};

// ─── Timeline Panel (Bottom) ──────────────────────────────────────────────
const TimelinePanel: React.FC<{ props: GamifiedLearningProps }> = ({ props }) => {
    const frame = useCurrentFrame();
    const tracks = [
        { color: LF.primary, label: props.step1_label },
        { color: LF.green, label: props.games_title },
        { color: LF.gold, label: props.sim_title },
        { color: LF.purple, label: props.bank_title },
    ];

    return (
        <Panel3D
            width={640} height={180} zOffset={30} delay={25} delayY={15}
            style={{ left: "50%", top: "85%", marginLeft: -320, marginTop: -90 }}
        >
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${LF.border}`, fontSize: 13, fontWeight: 800, color: LF.textMuted, display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.3)" }}>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 16 }}>⏱</span> {props.ui_timeline}</span>
                <span style={{ color: LF.primary, fontFamily: "monospace", fontSize: 14 }}>00:{(Math.floor(frame / 30)).toString().padStart(2, '0')}:{(Math.floor((frame % 30) * 3.33)).toString().padStart(2, '0')}</span>
            </div>

            <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                {/* Playhead line */}
                <div style={{
                    position: "absolute",
                    top: 0, bottom: 0, width: 2, background: LF.pink, zIndex: 10,
                    left: `${15 + ((frame / 900) * 80)}%` // Sweeps slowly across 30 seconds
                }}>
                    <div style={{ position: "absolute", top: 0, left: -4, width: 10, height: 10, background: LF.pink, borderRadius: "50%", boxShadow: `0 0 10px ${LF.pink}` }} />
                </div>

                {tracks.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 90, fontSize: 11, fontWeight: "bold", color: LF.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</div>
                        <div style={{ flex: 1, height: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, position: "relative", border: `1px solid rgba(255,255,255,0.05)` }}>
                            {/* Keyframes/Clips */}
                            <div style={{
                                position: "absolute",
                                left: `${i * 20}%`, width: "40%", height: "100%",
                                background: `linear-gradient(90deg, ${t.color}66, ${t.color})`,
                                borderRadius: 8,
                                border: `1px solid ${t.color}`,
                                boxShadow: `0 0 10px ${t.color}33`,
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </Panel3D>
    );
};

// ─── Floating Toolbar (Left) ──────────────────────────────────────────────
const Toolbar: React.FC = () => {
    const frame = useCurrentFrame();
    const icons = ["✨", "🎨", "🎬", "🎵", "⚙️"];

    return (
        <Panel3D
            width={70} height={300} zOffset={90} delay={40} delayY={30}
            style={{ left: "15%", top: "45%", marginTop: -150, marginLeft: -35 }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center", height: "100%", padding: "12px 0" }}>
                {icons.map((ic, i) => {
                    // Active effect on tools scanning down
                    const isActive = Math.floor(frame / 60) % icons.length === i;
                    return (
                        <div key={i} style={{
                            width: 44, height: 44, borderRadius: 12,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                            background: isActive ? `linear-gradient(135deg, ${LF.primary}, ${LF.purple})` : "rgba(255,255,255,0.05)",
                            boxShadow: isActive ? `0 4px 15px ${LF.purple}66` : "none",
                            border: `1px solid ${isActive ? LF.primary : "transparent"}`,
                            transition: "all 0.3s ease"
                        }}>
                            {ic}
                        </div>
                    );
                })}
            </div>
        </Panel3D>
    );
};

// ─── Playback Controls (Right) ────────────────────────────────────────────
const PlaybackControls: React.FC<{ props: GamifiedLearningProps }> = ({ props }) => {
    return (
        <Panel3D
            width={200} height={140} zOffset={80} delay={55} delayY={45} rx={-5} ry={5}
            style={{ right: "12%", top: "35%", marginRight: -100, marginTop: -70 }}
        >
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", height: "100%", background: "rgba(0,0,0,0.1)" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: LF.textMuted, letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>{props.ui_preview}</div>
                <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `1px solid ${LF.border}` }}>⏮</div>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${LF.green}, #10b981)`, boxShadow: `0 0 25px ${LF.green}88`, border: `2px solid #86efac`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, paddingLeft: 4 }}>▶️</div>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `1px solid ${LF.border}` }}>⏭</div>
                </div>
            </div>
        </Panel3D>
    );
};

// ─── Stats / Badges (Floating elements) ───────────────────────────────────
const FloatingBadge: React.FC<{
    icon: string;
    text: string;
    subtext: string;
    color: string;
    left: string | number;
    top: string | number;
    zOffset: number;
    delay: number;
    scaleMult?: number;
}> = ({ icon, text, subtext, color, left, top, zOffset, delay, scaleMult = 1 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const float = Math.sin((frame + delay * 2) / 25) * 20;
    const scale = interpolate(sp(frame, fps, delay, 10, 120), [0, 1], [0, 1 * scaleMult]);
    const opacity = interpolate(frame, [delay, delay + 10], [0, 1], C);

    return (
        <div style={{
            position: "absolute",
            left, top,
            transformStyle: "preserve-3d",
            transform: `translateZ(${zOffset + float}px) scale(${scale})`,
            opacity,
            background: "rgba(20, 25, 40, 0.7)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${color}66`,
            borderRadius: 99,
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: `0 15px 35px rgba(0,0,0,0.6), inset 0 0 20px ${color}15`,
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, ${color}66, ${color}22)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                border: `1px solid ${color}`,
                boxShadow: `0 0 15px ${color}44`,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: LF.textPrimary, whiteSpace: "nowrap" }}>{text}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: color, whiteSpace: "nowrap" }}>{subtext}</div>
            </div>
        </div>
    );
};

// ─── AnimBackground ───────────────────────────────────────────────────────────
const AnimBackground: React.FC = () => {
    const frame = useCurrentFrame();
    // Rotate hue slowly
    const hue = interpolate(frame, [0, 900], [240, 270], C);

    return (
        <>
            {/* Ambient glows beneath the 3D scene (far back) */}
            <div style={{
                position: "absolute", left: "20%", top: "10%", width: "50%", height: "50%",
                background: `radial-gradient(circle, ${LF.primary}20 0%, transparent 70%)`,
                filter: "blur(100px)",
                transform: "translateZ(-800px)",
            }} />
            <div style={{
                position: "absolute", right: "10%", bottom: "0%", width: "60%", height: "60%",
                background: `radial-gradient(circle, ${LF.pink}15 0%, transparent 70%)`,
                filter: "blur(120px)",
                transform: "translateZ(-800px)",
            }} />

            {/* "Space" grid far away */}
            <div style={{
                position: "absolute",
                width: 4000, height: 4000,
                left: "50%", top: "50%",
                marginLeft: -2000, marginTop: -2000,
                transform: "translateZ(-1400px) rotateX(45deg)",
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.03) 2px, transparent 2px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 2px, transparent 2px)
                `,
                backgroundSize: "100px 100px",
                backgroundPosition: "center center",
                WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 60%)",
                maskImage: "radial-gradient(circle, black 20%, transparent 60%)",
            }} />
        </>
    );
};

// ─── Main Composition ─────────────────────────────────────────────────────────
export const TOTAL_FRAMES = 900; // 30 seconds at 30fps

export const GamifiedLearningComposition: React.FC<GamifiedLearningProps> = (props) => {
    const frame = useCurrentFrame();

    // Very slow continuous rotation of the entire scene for a dynamic 3D feel
    // Yaw slowly rotating `-40deg` to `-55deg` and back to `-40deg` with Math.sin
    const yaw = -45 + Math.sin(frame / 140) * 10;

    // Isometric pitch (around x)
    const pitch = 55;

    return (
        <AbsoluteFill
            style={{
                fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                overflow: "visible",
                color: LF.textPrimary,
                perspective: 1600, // Deep perspective for isometric effect
            }}
        >
            <AnimBackground />

            {/* 3D World Container */}
            <div style={{
                position: "absolute",
                inset: 0,
                transformStyle: "preserve-3d",
                // Isometric rotation
                transform: `rotateX(${pitch}deg) rotateZ(${yaw}deg) scale(0.85) translateY(-20px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>

                {/* Main Isometric Elements */}
                <EditorWindow props={props} />
                <TimelinePanel props={props} />
                <Toolbar />
                <PlaybackControls props={props} />

                {/* Floating Decorative Elements */}
                <FloatingBadge
                    icon="🎓" text={`+150 ${props.xp_label}`} subtext={props.step4_label}
                    color={LF.gold} left="60%" top="15%" zOffset={220} delay={80} scaleMult={1.1}
                />

                <FloatingBadge
                    icon="🌟" text={props.step2_label} subtext={`+50 ${props.coins_label}`}
                    color={LF.green} left="25%" top="75%" zOffset={180} delay={120}
                />

                <FloatingBadge
                    icon="💼" text="Startup" subtext={props.step5_label}
                    color={LF.primary} left="70%" top="60%" zOffset={260} delay={160} scaleMult={0.9}
                />

                <FloatingBadge
                    icon="🤖" text={props.ai_title} subtext={props.step1_label}
                    color={LF.purple} left="35%" top="25%" zOffset={300} delay={200} scaleMult={1.2}
                />
            </div>
        </AbsoluteFill>
    );
};
