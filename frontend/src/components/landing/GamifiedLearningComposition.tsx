import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Sequence,
} from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────
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
    // Additional module labels
    games_title: string;
    sim_title: string;
    ai_title: string;
    bank_title: string;
}

// ─── LittleFounders design tokens ────────────────────────────────────────────
const LF = {
    primary: "#5b6cf8", // hsl(236 64% 58%)
    primaryDark: "#3d4fd4",
    purple: "#9333ea",
    pink: "#ec4899",
    green: "#22c55e",
    gold: "#f59e0b",
    danger: "#ef4444",
    bgCard: "#1e2333",  // slightly blue-tinted dark card
    bgDark: "#0f1220",
    border: "rgba(255,255,255,0.08)",
    textPrimary: "#f8fafc",
    textMuted: "rgba(255,255,255,0.45)",
    radius: 16,
    radiusSm: 10,
};

// ─── Easing helpers ───────────────────────────────────────────────────────────
const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// Returns 0→1 spring value offset by `from` frames
function sp(frame: number, fps: number, from = 0, damping = 16, stiffness = 150) {
    return spring({ frame: frame - from, fps, config: { damping, stiffness, mass: 1 } });
}

// ─── Shared: Screen wrapper ───────────────────────────────────────────────────
const Screen: React.FC<{
    frame: number;
    children: React.ReactNode;
    accent: string;
}> = ({ frame, children, accent }) => {
    const { fps } = useVideoConfig();
    const appear = sp(frame, fps, 0, 18, 160);
    const y = interpolate(appear, [0, 1], [50, 0]);
    const o = interpolate(frame, [0, 10], [0, 1], C);

    return (
        <AbsoluteFill
            style={{
                display: "flex",
                flexDirection: "column",
                padding: "52px 24px 24px",
                opacity: o,
                transform: `translateY(${y}px)`,
            }}
        >
            {/* Accent bar at top */}
            <div
                style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 3,
                    background: accent,
                    borderRadius: "3px 3px 0 0",
                }}
            />
            {children}
        </AbsoluteFill>
    );
};

// ─── Shared: Module badge ─────────────────────────────────────────────────────
const Badge: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
    <div
        style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 12px",
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.1,
            textTransform: "uppercase" as const,
            background: `${color}25`,
            border: `1px solid ${color}50`,
            color,
            marginBottom: 12,
            alignSelf: "flex-start" as const,
        }}
    >
        {children}
    </div>
);

// ─── Shared: Animated card ────────────────────────────────────────────────────
const Card: React.FC<{
    frame: number;
    delay?: number;
    fps: number;
    children: React.ReactNode;
    style?: React.CSSProperties;
}> = ({ frame, delay = 0, fps, children, style }) => {
    const s = sp(frame, fps, delay, 14, 170);
    const x = interpolate(s, [0, 1], [30, 0]);
    const o = interpolate(frame, [delay, delay + 8], [0, 1], C);

    return (
        <div
            style={{
                background: LF.bgCard,
                border: `1px solid ${LF.border}`,
                borderRadius: LF.radius,
                padding: "12px 14px",
                opacity: o,
                transform: `translateX(${x}px)`,
                ...style,
            }}
        >
            {children}
        </div>
    );
};

// ─── XP bar helper ────────────────────────────────────────────────────────────
const XpBar: React.FC<{ fill: number; label?: string }> = ({ fill, label }) => (
    <div style={{ width: "100%" }}>
        {label && (
            <div style={{ fontSize: 10, color: LF.textMuted, marginBottom: 3 }}>{label}</div>
        )}
        <div
            style={{
                height: 8,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 99,
                overflow: "hidden",
                border: `1px solid ${LF.border}`,
            }}
        >
            <div
                style={{
                    height: "100%",
                    width: `${fill * 100}%`,
                    background: `linear-gradient(90deg, ${LF.primary}, ${LF.purple})`,
                    borderRadius: 99,
                    boxShadow: `0 0 8px ${LF.primary}88`,
                }}
            />
        </div>
    </div>
);

// ─── TOP HUD ─────────────────────────────────────────────────────────────────
const Hud: React.FC<{
    level_label: string;
    coins_label: string;
    xp_label: string;
    moduleIcon: string;
    moduleTitle: string;
}> = ({ level_label, coins_label, xp_label, moduleIcon, moduleTitle }) => {
    const frame = useCurrentFrame();
    const o = interpolate(frame, [4, 16], [0, 1], C);

    return (
        <div
            style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                background: "rgba(15,18,32,0.92)",
                backdropFilter: "blur(8px)",
                borderBottom: `1px solid ${LF.border}`,
                opacity: o,
                zIndex: 100,
            }}
        >
            {/* Logo mark */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: `linear-gradient(135deg, ${LF.primary}, ${LF.purple})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                    }}
                >
                    🌟
                </div>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 900,
                        background: `linear-gradient(90deg, ${LF.primary}, ${LF.purple})`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        letterSpacing: 0.3,
                    }}
                >
                    LittleFounders
                </span>
            </div>

            {/* Module name */}
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: LF.textMuted,
                    letterSpacing: 0.5,
                }}
            >
                {moduleIcon} {moduleTitle}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: LF.gold,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                    }}
                >
                    🪙 <span style={{ color: "#fde68a" }}>120</span>
                </div>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#a5b4fc",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                    }}
                >
                    ⭐ <span>Nv.2</span>
                </div>
            </div>
        </div>
    );
};

// ─── SCENE 1: Lección Interactiva (Quiz) ─────────────────────────────────────
const QuizScene: React.FC<{
    challenge: string;
    opt_a: string;
    opt_b: string;
    opt_c: string;
    step2_label: string;
    step1_label: string;
    xp_label: string;
    level_label: string;
    coins_label: string;
}> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const SELECT = 120;
    const isSelected = frame >= SELECT;
    const checkSp = sp(frame, fps, SELECT, 8, 280);

    const opts = [
        { label: props.opt_a, correct: true },
        { label: props.opt_b, correct: false },
        { label: props.opt_c, correct: false },
    ];

    return (
        <>
            <Hud
                moduleIcon="📚"
                moduleTitle={props.step1_label}
                level_label={props.level_label}
                coins_label={props.coins_label}
                xp_label={props.xp_label}
            />
            <Screen frame={frame} accent={`linear-gradient(90deg, ${LF.primary}, ${LF.purple})`}>
                <Badge color={LF.primary}>📚 {props.step1_label}</Badge>

                {/* Question */}
                <Card frame={frame} delay={0} fps={fps} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: LF.textMuted, marginBottom: 6 }}>
                        💡 Pregunta de Finanzas
                    </div>
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: LF.textPrimary,
                            lineHeight: 1.5,
                        }}
                    >
                        {props.challenge}
                    </div>
                </Card>

                {/* Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {opts.map((opt, i) => {
                        const delay = 8 + i * 7;
                        const s = sp(frame, fps, delay, 14, 180);
                        const x = interpolate(s, [0, 1], [40, 0]);
                        const o = interpolate(frame, [delay, delay + 8], [0, 1], C);

                        const hl = isSelected && opt.correct;
                        const dim = isSelected && !opt.correct;

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: o * (dim ? 0.3 : 1),
                                    transform: `translateX(${x}px)`,
                                    background: hl ? `linear-gradient(135deg, ${LF.green}22, ${LF.green}11)` : "rgba(255,255,255,0.04)",
                                    border: hl ? `2px solid ${LF.green}` : `1.5px solid ${LF.border}`,
                                    borderRadius: LF.radiusSm,
                                    padding: "11px 14px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: hl ? "#86efac" : LF.textPrimary,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    boxShadow: hl ? `0 0 18px ${LF.green}33` : "none",
                                }}
                            >
                                <span>{opt.label}</span>
                                {hl && (
                                    <span
                                        style={{
                                            transform: `scale(${interpolate(checkSp, [0, 1], [0, 1])})`,
                                            display: "inline-block",
                                            fontSize: 16,
                                        }}
                                    >
                                        ✅
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Correct feedback */}
                {isSelected && (
                    <div
                        style={{
                            marginTop: 10,
                            padding: "8px 14px",
                            borderRadius: LF.radiusSm,
                            background: `${LF.green}18`,
                            border: `1px solid ${LF.green}40`,
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#86efac",
                            opacity: interpolate(frame, [SELECT + 2, SELECT + 12], [0, 1], C),
                        }}
                    >
                        🎉 {props.step2_label} +15 XP 🪙
                    </div>
                )}

                {/* Progress bar at bottom */}
                <div style={{ marginTop: "auto", paddingTop: 12 }}>
                    <XpBar
                        fill={interpolate(frame, [SELECT, SELECT + 35], [0.45, 0.62], C)}
                        label={`${props.xp_label} · ${Math.round(interpolate(frame, [SELECT, SELECT + 35], [136, 185], C))}/300`}
                    />
                </div>
            </Screen>
        </>
    );
};

// ─── SCENE 2: Videojuegos ────────────────────────────────────────────────────
const GamesScene: React.FC<{
    games_title: string;
    level_label: string;
    coins_label: string;
    xp_label: string;
}> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const games = [
        { name: "Ñam vs Yum", emoji: "🦕", color: "#10b981", score: "1,240 pts", tag: "Popular" },
        { name: "Néctar de las Sombras", emoji: "🌙", color: "#8b5cf6", score: "880 pts", tag: "Nuevo" },
        { name: "Paper Detective", emoji: "🕵️", color: "#f59e0b", score: "720 pts", tag: "Beta" },
    ];

    // Simulated game-play: score counter animation on first card
    const liveScore = Math.round(interpolate(frame, [15, 150], [1240, 1780], C));

    return (
        <>
            <Hud
                moduleIcon="🎮"
                moduleTitle={props.games_title}
                level_label={props.level_label}
                coins_label={props.coins_label}
                xp_label={props.xp_label}
            />
            <Screen frame={frame} accent={`linear-gradient(90deg, #10b981, #8b5cf6)`}>
                <Badge color="#10b981">🎮 {props.games_title}</Badge>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {games.map((g, i) => {
                        const delay = i * 9;
                        const s = sp(frame, fps, delay, 14, 160);
                        const y = interpolate(s, [0, 1], [28, 0]);
                        const o = interpolate(frame, [delay, delay + 10], [0, 1], C);

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: o,
                                    transform: `translateY(${y}px)`,
                                    background: LF.bgCard,
                                    border: `1px solid ${LF.border}`,
                                    borderLeft: `3px solid ${g.color}`,
                                    borderRadius: LF.radius,
                                    padding: "12px 14px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                {/* Icon */}
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: `${g.color}22`,
                                        border: `1px solid ${g.color}44`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 20,
                                        flexShrink: 0,
                                    }}
                                >
                                    {g.emoji}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color: LF.textPrimary,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {g.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: g.color,
                                        }}
                                    >
                                        {i === 0 ? `${liveScore} pts` : g.score}
                                    </div>
                                </div>

                                {/* Tag */}
                                <div
                                    style={{
                                        padding: "3px 8px",
                                        borderRadius: 99,
                                        fontSize: 9,
                                        fontWeight: 800,
                                        color: g.color,
                                        background: `${g.color}18`,
                                        border: `1px solid ${g.color}30`,
                                        flexShrink: 0,
                                    }}
                                >
                                    {g.tag}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Live indicator */}
                <div
                    style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: interpolate(frame, [50, 70], [0, 1], C),
                    }}
                >
                    <div
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: LF.green,
                            boxShadow: `0 0 6px ${LF.green}`,
                            animation: "none",
                            opacity: 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI),
                        }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 700, color: LF.textMuted }}>
                        Live — jugando ahora
                    </span>
                </div>

                <div style={{ marginTop: "auto", paddingTop: 12 }}>
                    <XpBar fill={0.62} label={`${props.xp_label} · 185/300`} />
                </div>
            </Screen>
        </>
    );
};

// ─── SCENE 3: Simulación de Emprendimiento ───────────────────────────────────
const SimScene: React.FC<{
    sim_title: string;
    level_label: string;
    coins_label: string;
    xp_label: string;
}> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const revenue = interpolate(frame, [10, 150], [0, 0.72], C);
    const expenses = interpolate(frame, [18, 150], [0, 0.41], C);
    const profit = interpolate(frame, [28, 150], [0, 0.31], C);

    const metrics = [
        { label: "Ingresos", value: `$${Math.round(revenue * 2800)}`, pct: revenue, color: LF.green, icon: "📈" },
        { label: "Gastos", value: `$${Math.round(expenses * 2800)}`, pct: expenses, color: LF.danger, icon: "📉" },
        { label: "Ganancia", value: `$${Math.round(profit * 2800)}`, pct: profit, color: LF.primary, icon: "💰" },
    ];

    const milestones = [
        { label: "Primer cliente", done: true },
        { label: "Meta $500", done: true },
        { label: "Expandir equipo", done: false },
    ];

    return (
        <>
            <Hud
                moduleIcon="🚀"
                moduleTitle={props.sim_title}
                level_label={props.level_label}
                coins_label={props.coins_label}
                xp_label={props.xp_label}
            />
            <Screen frame={frame} accent={`linear-gradient(90deg, ${LF.green}, ${LF.primary})`}>
                <Badge color={LF.green}>🚀 {props.sim_title}</Badge>

                {/* Company header */}
                <Card frame={frame} fps={fps} delay={0} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: `linear-gradient(135deg, ${LF.primary}, ${LF.purple})`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                flexShrink: 0,
                            }}
                        >
                            🏢
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: LF.textPrimary }}>
                                Mi Startup · Semana 3
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: LF.green }}>
                                ● Crecimiento +18%
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Metrics */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {metrics.map((m, i) => {
                        const delay = 8 + i * 7;
                        const s = sp(frame, fps, delay, 14, 180);
                        const x = interpolate(s, [0, 1], [30, 0]);
                        const o = interpolate(frame, [delay, delay + 8], [0, 1], C);

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: o,
                                    transform: `translateX(${x}px)`,
                                    background: LF.bgCard,
                                    border: `1px solid ${LF.border}`,
                                    borderRadius: LF.radiusSm,
                                    padding: "8px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span style={{ fontSize: 16 }}>{m.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: 4,
                                        }}
                                    >
                                        <span style={{ fontSize: 10, color: LF.textMuted }}>{m.label}</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>
                                            {m.value}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            height: 5,
                                            background: "rgba(255,255,255,0.06)",
                                            borderRadius: 99,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${m.pct * 100}%`,
                                                background: m.color,
                                                borderRadius: 99,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Milestones */}
                <div
                    style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 6,
                        opacity: interpolate(frame, [80, 100], [0, 1], C),
                    }}
                >
                    {milestones.map((ms, i) => (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                padding: "5px 7px",
                                borderRadius: LF.radiusSm,
                                background: ms.done ? `${LF.green}18` : "rgba(255,255,255,0.04)",
                                border: `1px solid ${ms.done ? LF.green + "44" : LF.border}`,
                                textAlign: "center" as const,
                                fontSize: 9,
                                fontWeight: 700,
                                color: ms.done ? "#86efac" : LF.textMuted,
                            }}
                        >
                            {ms.done ? "✓" : "○"} {ms.label}
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: "auto", paddingTop: 10 }}>
                    <XpBar fill={0.62} label={`${props.xp_label} · 185/300`} />
                </div>
            </Screen>
        </>
    );
};

// ─── SCENE 4: Aprendizaje con IA ─────────────────────────────────────────────
const AiScene: React.FC<{
    ai_title: string;
    level_label: string;
    coins_label: string;
    xp_label: string;
}> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const messages = [
        {
            from: "user",
            text: "¿Qué es el interés compuesto?",
            delay: 15,
        },
        {
            from: "ai",
            text: "¡Buena pregunta! 🧠 Es cuando los intereses generan más intereses con el tiempo. ¡Tu dinero trabaja para ti!",
            delay: 55,
        },
        {
            from: "user",
            text: "¿Me pones un ejemplo?",
            delay: 130,
        },
    ];

    // Typing indicator blink
    const typingOpacity = frame >= 130 ? interpolate(frame, [130, 145], [0, 1], C) : 0;
    const typingDot = (0.5 + 0.5 * Math.sin((frame / 8) * Math.PI));

    return (
        <>
            <Hud
                moduleIcon="🤖"
                moduleTitle={props.ai_title}
                level_label={props.level_label}
                coins_label={props.coins_label}
                xp_label={props.xp_label}
            />
            <Screen frame={frame} accent={`linear-gradient(90deg, ${LF.purple}, ${LF.pink})`}>
                <Badge color={LF.purple}>🤖 {props.ai_title}</Badge>

                {/* AI avatar header */}
                <Card frame={frame} fps={fps} delay={0} style={{ marginBottom: 10, padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 99,
                                background: `linear-gradient(135deg, ${LF.purple}, ${LF.pink})`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                flexShrink: 0,
                                boxShadow: `0 0 14px ${LF.purple}66`,
                            }}
                        >
                            🧑‍🏫
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: LF.textPrimary }}>
                                Dr. Rho · Tutor IA
                            </div>
                            <div
                                style={{
                                    fontSize: 9,
                                    color: LF.green,
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                }}
                            >
                                <span
                                    style={{
                                        display: "inline-block",
                                        width: 5,
                                        height: 5,
                                        borderRadius: "50%",
                                        background: LF.green,
                                    }}
                                />
                                En línea ahora
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Chat messages */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    {messages.map((m, i) => {
                        const o = interpolate(frame, [m.delay, m.delay + 12], [0, 1], C);
                        const s = sp(frame, fps, m.delay, 12, 200);
                        const y = interpolate(s, [0, 1], [16, 0]);
                        const isUser = m.from === "user";

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: o,
                                    transform: `translateY(${y}px)`,
                                    display: "flex",
                                    justifyContent: isUser ? "flex-end" : "flex-start",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "80%",
                                        padding: "8px 12px",
                                        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background: isUser
                                            ? `linear-gradient(135deg, ${LF.primary}, ${LF.purple})`
                                            : "rgba(255,255,255,0.07)",
                                        border: isUser ? "none" : `1px solid ${LF.border}`,
                                        fontSize: 12,
                                        fontWeight: isUser ? 600 : 500,
                                        color: LF.textPrimary,
                                        lineHeight: 1.5,
                                        boxShadow: isUser ? `0 4px 12px ${LF.primary}44` : "none",
                                    }}
                                >
                                    {m.text}
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing indicator */}
                    {typingOpacity > 0 && (
                        <div
                            style={{
                                opacity: typingOpacity,
                                display: "flex",
                                gap: 4,
                                alignItems: "center",
                                padding: "8px 12px",
                                background: "rgba(255,255,255,0.06)",
                                borderRadius: "14px 14px 14px 4px",
                                border: `1px solid ${LF.border}`,
                                alignSelf: "flex-start" as const,
                                width: 52,
                            }}
                        >
                            {[0, 1, 2].map((d) => (
                                <div
                                    key={d}
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: LF.purple,
                                        opacity: 0.3 + 0.7 * Math.abs(Math.sin(((frame - d * 5) / 12) * Math.PI)),
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ paddingTop: 10 }}>
                    <XpBar fill={0.62} label={`${props.xp_label} · 185/300`} />
                </div>
            </Screen>
        </>
    );
};

// ─── SCENE 5: Banca Digital ──────────────────────────────────────────────────
const BankScene: React.FC<{
    bank_title: string;
    level_label: string;
    coins_label: string;
    xp_label: string;
}> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Balance counter animation
    const balance = interpolate(frame, [10, 140], [0, 324.50], C);
    const savingsPct = interpolate(frame, [15, 140], [0, 0.65], C);

    const categories = [
        { label: "Ahorro", pct: savingsPct, color: LF.green, emoji: "🏦", amt: "$211" },
        { label: "Gastos", pct: savingsPct * 0.52, color: LF.danger, emoji: "🛒", amt: "$87" },
        { label: "Invertir", pct: savingsPct * 0.35, color: LF.primary, emoji: "📊", amt: "$59" },
    ];

    const goalPct = interpolate(frame, [30, 140], [0, 0.65], C);

    return (
        <>
            <Hud
                moduleIcon="🏦"
                moduleTitle={props.bank_title}
                level_label={props.level_label}
                coins_label={props.coins_label}
                xp_label={props.xp_label}
            />
            <Screen frame={frame} accent={`linear-gradient(90deg, ${LF.gold}, ${LF.green})`}>
                <Badge color={LF.gold}>🏦 {props.bank_title}</Badge>

                {/* Balance card */}
                <Card frame={frame} fps={fps} delay={0} style={{ marginBottom: 10, background: `linear-gradient(135deg, ${LF.primary}22, ${LF.purple}22)`, borderColor: `${LF.primary}40` }}>
                    <div style={{ fontSize: 10, color: LF.textMuted, marginBottom: 4 }}>
                        Saldo disponible
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 900,
                            color: LF.textPrimary,
                            lineHeight: 1,
                            marginBottom: 6,
                        }}
                    >
                        ${balance.toFixed(2)}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <span
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: LF.green,
                                background: `${LF.green}18`,
                                padding: "2px 7px",
                                borderRadius: 99,
                            }}
                        >
                            ↑ +$24 esta semana
                        </span>
                    </div>
                </Card>

                {/* Budget categories */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {categories.map((cat, i) => {
                        const delay = 10 + i * 8;
                        const s = sp(frame, fps, delay, 14, 180);
                        const x = interpolate(s, [0, 1], [30, 0]);
                        const o = interpolate(frame, [delay, delay + 8], [0, 1], C);

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: o,
                                    transform: `translateX(${x}px)`,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span style={{ fontSize: 16, flexShrink: 0 }}>{cat.emoji}</span>
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: 4,
                                        }}
                                    >
                                        <span style={{ fontSize: 11, color: LF.textMuted, fontWeight: 600 }}>
                                            {cat.label}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: cat.color }}>
                                            {cat.amt}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            height: 6,
                                            background: "rgba(255,255,255,0.06)",
                                            borderRadius: 99,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${cat.pct * 100}%`,
                                                background: cat.color,
                                                borderRadius: 99,
                                                boxShadow: `0 0 6px ${cat.color}66`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Savings goal */}
                <Card
                    frame={frame}
                    fps={fps}
                    delay={28}
                    style={{ marginTop: 10 }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                            alignItems: "center",
                        }}
                    >
                        <span style={{ fontSize: 11, fontWeight: 700, color: LF.textPrimary }}>
                            🎯 Meta: Bicicleta
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: LF.gold }}>
                            {Math.round(goalPct * 100)}%
                        </span>
                    </div>
                    <div
                        style={{
                            height: 8,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 99,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: `${goalPct * 100}%`,
                                background: `linear-gradient(90deg, ${LF.gold}, ${LF.green})`,
                                borderRadius: 99,
                                boxShadow: `0 0 10px ${LF.gold}55`,
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 10, color: LF.textMuted, marginTop: 4 }}>
                        $211 / $325 — faltan $114
                    </div>
                </Card>

                <div style={{ marginTop: "auto", paddingTop: 10 }}>
                    <XpBar fill={0.62} label={`${props.xp_label} · 185/300`} />
                </div>
            </Screen>
        </>
    );
};

// ─── Transition flash ─────────────────────────────────────────────────────────
const Transition: React.FC = () => {
    const frame = useCurrentFrame();
    const o = interpolate(frame, [0, 10, 20, 30], [1, 0.2, 0.5, 0], C);

    return (
        <AbsoluteFill
            style={{
                background: `linear-gradient(135deg, ${LF.primary}66, ${LF.purple}66)`,
                opacity: o,
                pointerEvents: "none",
            }}
        />
    );
};

// ─── AnimBackground ───────────────────────────────────────────────────────────
const AnimBackground: React.FC = () => {
    const frame = useCurrentFrame();
    const hue = interpolate(frame, [0, 330], [230, 265], C);

    return (
        <>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(160deg, hsl(${hue},55%,10%) 0%, hsl(${hue + 20},60%,7%) 100%)`,
                }}
            />
            {/* Subtle grid */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
                    backgroundSize: "24px 24px",
                }}
            />
            {/* Corner glow */}
            <div
                style={{
                    position: "absolute",
                    top: -60,
                    right: -60,
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${LF.purple}22 0%, transparent 70%)`,
                }}
            />
        </>
    );
};

// ─── Main Composition ─────────────────────────────────────────────────────────
// Timeline: 5 scenes × 180 frames + 4 transitions × 30 frames
// (≈30s at 30fps. Very smooth, readable, unhurried.)
const SCENE = 180;
const T1 = 0;
const T2 = T1 + SCENE;
const T3 = T2 + SCENE;
const T4 = T3 + SCENE;
const T5 = T4 + SCENE;
export const TOTAL_FRAMES = T5 + SCENE; // 900

export const GamifiedLearningComposition: React.FC<GamifiedLearningProps> = (props) => {
    const {
        step1_label, step2_label, step3_label, step4_label, step5_label,
        challenge, option_a, option_b, option_c,
        xp_label, level_label, coins_label,
        games_title, sim_title, ai_title, bank_title,
    } = props;

    return (
        <AbsoluteFill
            style={{
                fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                overflow: "hidden",
                color: LF.textPrimary,
            }}
        >
            <AnimBackground />

            {/* Scene 1: Quiz */}
            <Sequence from={T1} durationInFrames={SCENE}>
                <QuizScene
                    challenge={challenge}
                    opt_a={option_a}
                    opt_b={option_b}
                    opt_c={option_c}
                    step2_label={step2_label}
                    step1_label={step1_label}
                    xp_label={xp_label}
                    level_label={level_label}
                    coins_label={coins_label}
                />
            </Sequence>

            {/* Scene 2: Games */}
            <Sequence from={T2} durationInFrames={SCENE}>
                <GamesScene
                    games_title={games_title}
                    level_label={level_label}
                    coins_label={coins_label}
                    xp_label={xp_label}
                />
            </Sequence>

            {/* Scene 3: Startup sim */}
            <Sequence from={T3} durationInFrames={SCENE}>
                <SimScene
                    sim_title={sim_title}
                    level_label={level_label}
                    coins_label={coins_label}
                    xp_label={xp_label}
                />
            </Sequence>

            {/* Scene 4: AI */}
            <Sequence from={T4} durationInFrames={SCENE}>
                <AiScene
                    ai_title={ai_title}
                    level_label={level_label}
                    coins_label={coins_label}
                    xp_label={xp_label}
                />
            </Sequence>

            {/* Scene 5: Bank */}
            <Sequence from={T5} durationInFrames={SCENE}>
                <BankScene
                    bank_title={bank_title}
                    level_label={level_label}
                    coins_label={coins_label}
                    xp_label={xp_label}
                />
            </Sequence>

            {/* Flash transitions between scenes */}
            {[T2, T3, T4, T5].map((t) => (
                <Sequence key={t} from={t} durationInFrames={30}>
                    <Transition />
                </Sequence>
            ))}
        </AbsoluteFill>
    );
};
