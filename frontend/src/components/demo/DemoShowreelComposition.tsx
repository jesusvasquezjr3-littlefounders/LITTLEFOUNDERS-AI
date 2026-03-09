import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Easing,
    Img,
} from "remotion";
import { DinoCharacter } from "@/components/demo/DinoCharacter";
import { DinaCharacter } from "@/components/demo/DinaCharacter";
import { DrRhoCharacter } from "@/components/demo/DrRhoCharacter";
import { ZaraVexCharacter } from "@/components/demo/ZaraVexCharacter";

export interface DemoShowreelProps {
    isDarkMode: boolean;
    isMobile?: boolean;
    s_hook_title: string; s_hook_subtitle: string;
    s_lesson_title: string; s_lesson_question: string; s_lesson_opt_a: string; s_lesson_opt_b: string; s_lesson_opt_c: string; s_lesson_opt_d: string; s_lesson_badge_xp: string; s_lesson_badge_level: string;
    s_games_title: string; s_games_badge_1: string; s_games_badge_2: string; s_games_badge_3: string;
    s_bank_title: string; s_bank_balance_label: string; s_bank_limit_1: string; s_bank_limit_2: string; s_bank_badge: string;
    s_ai_title: string; s_ai_user_msg: string; s_ai_bot_msg: string;
    s_char_liruf: string; s_char_dina: string; s_char_rho: string; s_char_zara: string;
    s_cta_headline: string; s_cta_sub: string; s_cta_button: string;
    s_stat_lessons: string; s_stat_games: string; s_stat_ai: string; s_stat_bank: string;
    s_ai_typing: string; s_game_lemonade: string; s_game_market: string;
    s_game_stocks: string; s_game_factory: string; s_game_farm: string;
    s_game_risk: string; s_badge_win: string; s_badge_money: string;
    s_badge_parental: string; s_card_name: string; s_card_number: string;
    s_social_title: string; s_social_streak: string; s_social_incentive: string; s_social_privacy: string;
    s_dash_lessons: string; s_dash_minutes: string; s_dash_points: string; s_dash_streak: string;
}

const LF = { primary: "#5b6cf8", purple: "#9333ea", pink: "#ec4899", green: "#22c55e", gold: "#f59e0b", cyan: "#06b6d4" };
const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const EZ = Easing.bezier(0.8, 0, 0.2, 1); // Aggressive Apple-style easing (slow start, lightning fast middle, slow end)

// Theme helpers
function bg(d: boolean, m?: boolean) { return d ? `rgba(15, 20, 35, ${m ? 0.95 : 0.7})` : `rgba(255, 255, 255, ${m ? 0.98 : 0.85})`; }
function txt(d: boolean) { return d ? "#fff" : "#000"; }
function border(d: boolean) { return d ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"; }
function shadow(d: boolean, m?: boolean) {
    if (m) return d ? `0 10px 20px rgba(0,0,0,0.8)` : `0 10px 20px rgba(0,0,0,0.1)`;
    return d ? `0 40px 80px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.2)` : `0 40px 80px rgba(0,0,0,0.15), inset 0 2px 3px rgba(255,255,255,0.8)`;
}

// ─── APPLE-STYLE PANEL ──────────────────────────────────────────────────────
const PromoPanel: React.FC<{
    children: React.ReactNode; width: number; height: number;
    delayIn: number; delayOut: number; actT: number; dark: boolean;
    isMobile?: boolean;
}> = ({ children, width, height, delayIn, delayOut, actT, dark, isMobile }) => {
    const { fps } = useVideoConfig();

    // Aggressive Spring In
    const sprIn = spring({ frame: actT - delayIn, fps, config: { damping: 14, stiffness: 120, mass: 1 } });

    // Smooth Ease Out (zoom past camera)
    const outT = Math.max(0, actT - delayOut);
    const zOut = interpolate(outT, [0, 30], [0, 2000], { easing: Easing.in(Easing.exp), ...C });
    const opOut = interpolate(outT, [10, 25], [1, 0], C);

    // Initial fly-in from deep Z space, rotating into place
    const zIn = interpolate(sprIn, [0, 1], [-2000, 0]);
    const rotX = interpolate(sprIn, [0, 1], [60, 0]);
    const rotY = interpolate(sprIn, [0, 1], [-40, 0]);

    // Continuous subtle breathing while clamped
    const breath = Math.sin(actT * 0.05) * 10;
    const breathRot = Math.cos(actT * 0.03) * 2;

    return (
        <div style={{
            position: "absolute", width, height,
            left: "50%", top: "50%", marginLeft: -width / 2, marginTop: -height / 2,
            transformStyle: "preserve-3d",
            transform: `translateZ(${zIn + zOut + breath}px) rotateX(${rotX + breathRot}deg) rotateY(${rotY - breathRot}deg)`,
            opacity: interpolate(sprIn, [0, 0.2], [0, 1], C) * opOut,
            background: bg(dark, isMobile),
            backdropFilter: isMobile ? "none" : "blur(24px)",
            border: `1px solid ${border(dark)}`, borderRadius: 24, padding: 30,
            boxShadow: shadow(dark, isMobile), color: txt(dark),
            willChange: "transform, opacity, filter",
            display: "flex", flexDirection: "column"
        }}>
            {children}
        </div>
    );
};

// ─── APPLE-STYLE BADGE ──────────────────────────────────────────────────────
const PromoBadge: React.FC<{
    icon: string; text: string; sub?: string; color: string;
    offsetX: number; offsetY: number; zSpace: number;
    delayIn: number; delayOut: number; actT: number; dark: boolean; isMobile?: boolean;
}> = ({ icon, text, sub, color, offsetX, offsetY, zSpace, delayIn, delayOut, actT, dark, isMobile }) => {
    const { fps } = useVideoConfig();
    const sprIn = spring({ frame: actT - delayIn, fps, config: { damping: 12, stiffness: 150 } });
    const outT = Math.max(0, actT - delayOut);
    const zOut = interpolate(outT, [0, 20], [0, 1500], { easing: Easing.in(Easing.exp), ...C });
    const floater = Math.sin(actT * 0.08) * 20;

    return (
        <div style={{
            position: "absolute", left: "50%", top: "50%",
            marginLeft: offsetX, marginTop: offsetY,
            transformStyle: "preserve-3d",
            transform: `translateZ(${zSpace + zOut + floater}px) scale(${sprIn}) rotateZ(${interpolate(sprIn, [0, 1], [-20, 0])}deg)`,
            opacity: interpolate(outT, [10, 20], [1, 0], C),
            background: dark ? `rgba(20,25,35,${isMobile ? 0.98 : 0.9})` : `rgba(255,255,255,${isMobile ? 0.98 : 0.95})`,
            backdropFilter: isMobile ? "none" : "blur(20px)", border: `1px solid ${color}66`,
            borderRadius: 99, padding: "12px 24px", display: "flex", alignItems: "center", gap: 14,
            boxShadow: shadow(dark, isMobile), color: txt(dark),
            willChange: "transform, opacity, filter"
        }}>
            <div style={{ fontSize: 28, filter: `drop-shadow(0 0 10px ${color}88)` }}>{icon}</div>
            <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{text}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{sub}</div>
            </div>
        </div>
    );
};

// ─── DYNAMIC TITLE TEXT ─────────────────────────────────────────────────────
const PromoTitle: React.FC<{ text: string; actT: number; delay: number; color1: string; color2: string }> = ({ text, actT, delay, color1, color2 }) => {
    const spr = spring({ frame: actT - delay, fps: 30, config: { damping: 14, stiffness: 100 } });
    const chars = text.split("");
    return (
        <div style={{ display: "flex", justifyContent: "center", transform: `scale(${interpolate(spr, [0, 1], [0.8, 1])})`, opacity: interpolate(spr, [0, 0.5], [0, 1], C) }}>
            <h1 style={{
                fontSize: 84, fontWeight: 900, letterSpacing: -3, margin: 0,
                background: `linear-gradient(135deg, ${color1}, ${color2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{text}</h1>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 1: APERTURA (0 - 220)
// ──────────────────────────────────────────────────────────────────────────────
const Act1Intro: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const { fps } = useVideoConfig();
    const spr = spring({ frame: t, fps, config: { damping: 20, stiffness: 100 } });
    const outT = Math.max(0, t - 190);
    const zOut = interpolate(outT, [0, 30], [0, 2000], { easing: Easing.in(Easing.exp), ...C });

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ transform: `scale(${spr}) translateZ(${zOut}px)`, opacity: interpolate(outT, [10, 25], [1, 0], C), textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Img src="/logo-main.png" style={{ height: 380, filter: `drop-shadow(0 0 60px ${LF.primary}AA)`, transform: `translateY(${Math.sin(t * 0.05) * 20}px)`, marginBottom: 40 }} />
                <div style={{ fontSize: 36, fontWeight: 700, color: p.isDarkMode ? "#E2E8F0" : "#334155", opacity: interpolate(t, [30, 45], [0, 1], C) }}>{p.s_hook_title}</div>
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 2: LECCIONES (220 - 440)
// ──────────────────────────────────────────────────────────────────────────────
const Act2Lessons: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const d = p.isDarkMode;
    const fill = interpolate(t, [40, 120], [0, 65], C);
    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <PromoPanel width={800} height={460} delayIn={0} delayOut={180} actT={t} dark={d} isMobile={p.isMobile}>
                <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 30 }}>{p.s_lesson_title}</div>
                <div style={{ height: 16, background: border(d), borderRadius: 8, overflow: "hidden", marginBottom: 40 }}>
                    <div style={{ width: `${fill}%`, height: "100%", background: LF.primary }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flex: 1 }}>
                    {[{ e: "🏠", t: p.s_lesson_opt_a, c: false }, { e: "🚗", t: p.s_lesson_opt_b, c: true }, { e: "💳", t: p.s_lesson_opt_c, c: false }, { e: "📱", t: p.s_lesson_opt_d, c: false }].map((opt, i) => {
                        const act = opt.c && t > 120;
                        return (
                            <div key={i} style={{
                                background: act ? `${LF.green}22` : "transparent",
                                border: `3px solid ${act ? LF.green : border(d)}`,
                                borderRadius: 16, display: "flex", alignItems: "center", gap: 20, padding: 20,
                                transform: act ? `scale(1.05)` : "scale(1)", transition: "all 0.3s"
                            }}>
                                <div style={{ fontSize: 40 }}>{opt.e}</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{opt.t}</div>
                            </div>
                        )
                    })}
                </div>
            </PromoPanel>

            {/* Liruf flying by */}
            <div style={{
                position: "absolute", left: "50%", top: "50%", marginLeft: 300, marginTop: -100, width: 250, height: 250,
                transformStyle: "preserve-3d",
                transform: `translateX(${interpolate(t, [0, 80], [800, 0], { easing: EZ, ...C })}px) 
                            translateZ(${interpolate(Math.max(0, t - 180), [0, 30], [200, 1500], { easing: Easing.in(Easing.exp), ...C })}px)
                            rotateY(-20deg)`,
                opacity: interpolate(Math.max(0, t - 185), [0, 15], [1, 0], C)
            }}>
                <DinoCharacter mood="excited" showBubble={false} />
            </div>

            <PromoBadge icon="🌟" text={p.s_lesson_badge_xp} sub="+50 XP" color={LF.gold} offsetX={350} offsetY={100} zSpace={300} delayIn={60} delayOut={185} actT={t} dark={d} isMobile={p.isMobile} />
            <PromoBadge icon="🔥" text={p.s_lesson_badge_level} sub="Level Up" color={LF.pink} offsetX={-550} offsetY={150} zSpace={400} delayIn={80} delayOut={190} actT={t} dark={d} isMobile={p.isMobile} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 3: JUEGOS (440 - 660)
// ──────────────────────────────────────────────────────────────────────────────
const Act3Games: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const d = p.isDarkMode;
    const games = [{ e: "🍋", t: p.s_game_lemonade, c: LF.gold }, { e: "🏪", t: p.s_game_market, c: LF.pink }, { e: "📈", t: p.s_game_stocks, c: LF.primary }, { e: "🏭", t: p.s_game_factory, c: LF.purple }, { e: "🚜", t: p.s_game_farm, c: LF.green }, { e: "🎲", t: p.s_game_risk, c: LF.cyan }];

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <PromoPanel width={760} height={600} delayIn={0} delayOut={180} actT={t} dark={d} isMobile={p.isMobile}>
                <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 30 }}>{p.s_games_title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    {games.map((g, i) => {
                        const spr = spring({ frame: t - (30 + i * 10), fps: 30, config: { damping: 12, stiffness: 150 } });
                        return (
                            <div key={i} style={{
                                aspectRatio: "1", borderRadius: 20, background: `${g.c}11`, border: `2px solid ${g.c}44`,
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
                                transform: `scale(${spr})`, opacity: interpolate(spr, [0, 0.5], [0, 1], C)
                            }}>
                                <div style={{ fontSize: 50, filter: `drop-shadow(0 10px 20px ${g.c}88)` }}>{g.e}</div>
                                <div style={{ fontSize: 16, fontWeight: 900 }}>{g.t}</div>
                            </div>
                        )
                    })}
                </div>
            </PromoPanel>

            {/* Dina popping from bottom */}
            <div style={{
                position: "absolute", left: "50%", top: "50%", marginLeft: -500, marginTop: 50, width: 220, height: 220,
                transformStyle: "preserve-3d",
                transform: `translateX(${interpolate(t, [20, 90], [-800, 0], { easing: EZ, ...C })}px) 
                            translateZ(${interpolate(Math.max(0, t - 180), [0, 30], [300, 2000], { easing: Easing.in(Easing.exp), ...C })}px)
                            rotateZ(10deg)`,
                opacity: interpolate(Math.max(0, t - 185), [0, 15], [1, 0], C)
            }}>
                <DinaCharacter expression="happy" enableMouseTracking={false} />
            </div>

            <PromoBadge icon="🏆" text={p.s_games_badge_1} sub={p.s_badge_win} color={LF.gold} offsetX={300} offsetY={-180} zSpace={250} delayIn={100} delayOut={185} actT={t} dark={d} isMobile={p.isMobile} />
            <PromoBadge icon="💼" text={p.s_games_badge_2} sub={p.s_badge_money} color={LF.green} offsetX={380} offsetY={100} zSpace={350} delayIn={120} delayOut={190} actT={t} dark={d} isMobile={p.isMobile} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 4: BANCA (660 - 880)
// ──────────────────────────────────────────────────────────────────────────────
const Act4Bank: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const d = p.isDarkMode;
    const bal = interpolate(t, [40, 150], [1250, 1850], C);

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <PromoPanel width={800} height={420} delayIn={0} delayOut={180} actT={t} dark={d} isMobile={p.isMobile}>
                <div style={{ fontSize: 20, color: p.isDarkMode ? "#aaa" : "#666" }}>{p.s_bank_balance_label}</div>
                <div style={{ fontSize: 64, fontWeight: 900, color: LF.green, marginBottom: 30 }}>${Math.floor(bal)}</div>

                {/* 3D Spinning Card inside the panel! */}
                <div style={{
                    position: "absolute", right: 40, top: 40, width: 260, height: 160, borderRadius: 20,
                    background: `linear-gradient(135deg, ${LF.purple}, ${LF.primary})`, padding: 20,
                    boxShadow: `0 30px 60px ${LF.purple}66`, display: "flex", flexDirection: "column", justifyContent: "space-between",
                    transformStyle: "preserve-3d",
                    transform: `translateZ(${interpolate(Math.sin(t * 0.05), [-1, 1], [60, 100])}px) translateY(${Math.sin(t * 0.04) * 10}px)`
                }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{p.s_card_name}</div>
                    <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", letterSpacing: 4 }}>{p.s_card_number}</div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flex: 1 }}>
                    {[3, 5, 2, 7, 4, 8, 6, 9, 3, 5].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: LF.primary, height: `${interpolate(t, [60 + i * 5, 100 + i * 5], [0, h * 10], C)}%`, borderRadius: "8px 8px 0 0" }} />
                    ))}
                </div>
            </PromoPanel>

            <div style={{
                position: "absolute", left: "50%", top: "50%", marginLeft: -400, marginTop: -150, width: 160, height: 160,
                transformStyle: "preserve-3d",
                transform: `translateX(${interpolate(t, [20, 90], [800, 0], { easing: EZ, ...C })}px) 
                            translateZ(${interpolate(Math.max(0, t - 180), [0, 30], [400, 2000], { easing: Easing.in(Easing.exp), ...C })}px)
                            rotateY(-15deg)`,
                opacity: interpolate(Math.max(0, t - 185), [0, 15], [1, 0], C)
            }}>
                <DrRhoCharacter mood="wise" showBubble={false} />
            </div>

            <PromoBadge icon="🔒" text={p.s_bank_badge} sub={p.s_badge_parental} color={LF.purple} offsetX={300} offsetY={160} zSpace={250} delayIn={80} delayOut={185} actT={t} dark={d} isMobile={p.isMobile} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 5: IA (880 - 1100)
// ──────────────────────────────────────────────────────────────────────────────
const Act5AI: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const d = p.isDarkMode;
    const typing = Math.floor(t / 10) % 4;

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <PromoPanel width={640} height={400} delayIn={0} delayOut={180} actT={t} dark={d} isMobile={p.isMobile}>
                <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 20 }}>{p.s_ai_title}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20, opacity: interpolate(t, [30, 50], [0, 1], C) }}>
                    <div style={{ background: `${LF.primary}22`, borderRadius: "20px 20px 4px 20px", padding: 20, maxWidth: "80%", fontSize: 18, fontWeight: 600 }}>{p.s_ai_user_msg}</div>
                </div>
                <div style={{ display: "flex", gap: 14, opacity: interpolate(t, [60, 80], [0, 1], C) }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${LF.pink}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🤖</div>
                    <div style={{ background: border(d), borderRadius: "20px 20px 20px 4px", padding: 20, maxWidth: "80%", fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>
                        {t < 110 ? `${p.s_ai_typing}${".".repeat(typing)}` : p.s_ai_bot_msg}
                    </div>
                </div>
            </PromoPanel>

            <div style={{
                position: "absolute", left: "50%", top: "50%", marginLeft: 300, marginTop: -200, width: 160, height: 160,
                transformStyle: "preserve-3d",
                transform: `translateX(${interpolate(t, [20, 90], [800, 0], { easing: EZ, ...C })}px) 
                            translateZ(${interpolate(Math.max(0, t - 180), [0, 30], [200, 2000], { easing: Easing.in(Easing.exp), ...C })}px)`,
                opacity: interpolate(Math.max(0, t - 185), [0, 15], [1, 0], C)
            }}>
                <ZaraVexCharacter mood="curious" showBubble={false} />
            </div>

            <PromoBadge icon="🤖" text={p.s_stat_ai} sub="24/7" color={LF.pink} offsetX={-450} offsetY={100} zSpace={300} delayIn={90} delayOut={185} actT={t} dark={d} isMobile={p.isMobile} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 6: SOCIAL (1100 - 1320)
// ──────────────────────────────────────────────────────────────────────────────
const Act6Social: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0 || t > 220) return null;
    const d = p.isDarkMode;

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <PromoPanel width={820} height={460} delayIn={0} delayOut={180} actT={t} dark={d} isMobile={p.isMobile}>
                <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 30, color: LF.cyan }}>{p.s_social_title}</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flex: 1, height: "100%" }}>
                    {[
                        { title: p.s_dash_lessons, value: "12", lottie: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie", color: LF.primary, b: `${LF.primary}11` },
                        { title: p.s_dash_minutes, value: "120", lottie: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie", color: LF.green, b: `${LF.green}11` },
                        { title: p.s_dash_points, value: "1500", lottie: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie", color: LF.gold, b: `${LF.gold}11` },
                        { title: p.s_dash_streak, value: "🔥 7", lottie: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie", color: LF.purple, b: `${LF.purple}11` }
                    ].map((s, i) => {
                        const cellSpr = spring({ frame: t - (30 + i * 15), fps: 30, config: { damping: 12, stiffness: 120 } });
                        return (
                            <div key={i} style={{
                                background: s.b, borderRadius: 16, border: `1px solid ${s.color}44`,
                                display: "flex", alignItems: "center", gap: 15, padding: "10px 20px",
                                transform: `scale(${interpolate(cellSpr, [0, 1], [0.8, 1])})`, opacity: cellSpr
                            }}>
                                <div style={{ width: 100, height: 100, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {/* @ts-ignore */}
                                    <dotlottie-wc src={s.lottie} autoplay loop style={{ width: "100%", height: "100%" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: d ? "#ccc" : "#666" }}>{s.title}</div>
                                    <div style={{ fontSize: 36, fontWeight: 900, color: s.color }}>{s.value}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Privacy Disclaimer */}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${border(d)}`, fontSize: 12, color: d ? "#888" : "#888", display: "flex", alignItems: "center", gap: 8, lineHeight: 1.4 }}>
                    <span style={{ fontSize: 16 }}>🛡️</span>
                    <span>{p.s_social_privacy}</span>
                </div>
            </PromoPanel>

            <div style={{
                position: "absolute", left: "50%", top: "50%", marginLeft: -380, marginTop: 150, width: 160, height: 160,
                transformStyle: "preserve-3d",
                transform: `translateX(${interpolate(t, [20, 90], [-800, 0], { easing: EZ, ...C })}px) 
                            translateZ(${interpolate(Math.max(0, t - 180), [0, 30], [200, 2000], { easing: Easing.in(Easing.exp), ...C })}px)
                            rotateZ(-10deg)`,
                opacity: interpolate(Math.max(0, t - 185), [0, 15], [1, 0], C)
            }}>
                <DinaCharacter expression="happy" enableMouseTracking={false} />
            </div>

            <PromoBadge icon="🤝" text="Team" sub="Ranking" color={LF.cyan} offsetX={340} offsetY={-120} zSpace={300} delayIn={80} delayOut={185} actT={t} dark={d} isMobile={p.isMobile} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ACT 7: CTA (1320 - 1570)
// ──────────────────────────────────────────────────────────────────────────────
const Act7CTA: React.FC<{ p: DemoShowreelProps; t: number }> = ({ p, t }) => {
    if (t < 0) return null;
    const { fps } = useVideoConfig();
    const spr = spring({ frame: t, fps, config: { damping: 14, stiffness: 100 } });

    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", width: "150%", height: "150%", background: `radial-gradient(circle at 50% 50%, ${LF.primary}30 0%, transparent 80%)`, filter: "blur(100px)", transform: "translateZ(-800px)" }} />

            {/* Characters exploding outwards */}
            <div style={{ display: "flex", gap: 30, transform: `translateZ(100px) scale(${spr})`, marginBottom: 300 }}>
                {[
                    <DinoCharacter mood="excited" showBubble={false} />,
                    <DinaCharacter expression="happy" enableMouseTracking={false} />,
                    <DrRhoCharacter mood="wise" showBubble={false} />,
                    <ZaraVexCharacter mood="excited" showBubble={false} />,
                ].map((comp, i) => (
                    <div key={i} style={{ width: 140, height: 140, transform: `translateY(${Math.sin((t + i * 20) * 0.1) * 15}px)`, filter: `drop-shadow(0 20px 40px rgba(0,0,0,0.5))` }}>{comp}</div>
                ))}
            </div>

            <div style={{ position: "absolute", transform: `translateZ(250px) scale(${spr})`, textAlign: "center", marginTop: 100 }}>
                <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: -3, lineHeight: 1.1, background: `linear-gradient(135deg, ${LF.primary}, ${LF.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{p.s_cta_headline}</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: p.isDarkMode ? "#aaa" : "#555", marginTop: 20 }}>{p.s_cta_sub}</div>
                <div style={{ marginTop: 40, transform: `scale(${1 + Math.sin(t * 0.2) * 0.02})` }}>
                    <span style={{ background: `linear-gradient(135deg, ${LF.primary}, ${LF.purple})`, padding: "20px 60px", borderRadius: 999, fontSize: 32, fontWeight: 900, color: "#fff", boxShadow: `0 20px 50px ${LF.primary}88` }}>{p.s_cta_button}</span>
                </div>
            </div>
        </div>
    );
};

// ─── Main Composition ─────────────────────────────────────────────────────────
export const TOTAL_FRAMES_SHOWREEL = 1570;

const BackgroundParticles: React.FC<{ frame: number, isDark: boolean, isMobile?: boolean }> = ({ frame, isDark, isMobile }) => {
    if (isMobile) return null;
    return (
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", pointerEvents: "none" }}>
            {[...Array(15)].map((_, i) => {
                // Pseudo-random generation for particles
                const seedX = Math.sin(i * 123.45);
                const seedY = Math.cos(i * 678.9);
                const x = seedX * 800;
                const y = seedY * 400;
                const z = (Math.sin(i) * 300) - 200;
                const speed = 0.5 + (i % 3) * 0.2;

                // Slowly float upwards and rotate
                const animatedY = y - (frame * speed) % 800 + (seedY > 0 ? 400 : -400);
                const opacity = 0.2 + Math.sin(frame * 0.05 + i) * 0.1;
                const size = 20 + (i % 15);

                const icons = ["✨", "💰", "🚀", "🌟"];
                const icon = icons[i % icons.length];

                return (
                    <div key={i} style={{
                        position: "absolute", left: "50%", top: "50%",
                        transform: `translate3d(${x}px, ${animatedY}px, ${z}px) rotateZ(${frame * (i % 2 === 0 ? 0.2 : -0.2)}deg)`,
                        opacity: isDark ? opacity * 1.5 : opacity,
                        fontSize: size,
                        filter: `drop-shadow(0 0 10px rgba(255,255,255,0.2))`,
                        willChange: "transform, opacity"
                    }}>
                        {icon}
                    </div>
                )
            })}
        </div>
    );
};

export const DemoShowreelComposition: React.FC<DemoShowreelProps> = (props) => {
    const frame = useCurrentFrame();

    // Marketing Enhancement: Continuous, subtle cinematic camera drift
    const pitch = props.isMobile ? 0 : Math.sin(frame / 120) * 5;
    const yaw = props.isMobile ? 0 : Math.cos(frame / 150) * 6;
    const roll = props.isMobile ? 0 : Math.sin(frame / 200) * 1.5;
    const globalZ = props.isMobile ? 0 : Math.sin(frame / 80) * 60;

    return (
        <AbsoluteFill style={{ fontFamily: "'Inter', sans-serif", background: "transparent", perspective: 1400, overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "100%", height: "100%", background: `radial-gradient(circle at 50% 50%, ${LF.primary}10 0%, transparent 80%)`, filter: "blur(100px)" }} />

            <div style={{
                position: "absolute", inset: 0, transformStyle: "preserve-3d",
                transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg) translateZ(${globalZ}px)`,
                willChange: "transform"
            }}>
                <BackgroundParticles frame={frame} isDark={props.isDarkMode} isMobile={props.isMobile} />
                <Act1Intro p={props} t={frame} />
                <Act2Lessons p={props} t={frame - 220} />
                <Act3Games p={props} t={frame - 440} />
                <Act4Bank p={props} t={frame - 660} />
                <Act5AI p={props} t={frame - 880} />
                <Act6Social p={props} t={frame - 1100} />
                <Act7CTA p={props} t={frame - 1320} />
            </div>
        </AbsoluteFill>
    );
};
