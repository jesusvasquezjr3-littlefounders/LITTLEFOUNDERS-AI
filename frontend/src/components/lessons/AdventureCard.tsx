import React from 'react';

interface AdventureCardProps {
    title: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    status: 'available' | 'locked' | 'completed';
    progress?: number;
    ageRange?: string;
    hideTitle?: boolean;
}

export const AdventureCard: React.FC<AdventureCardProps> = ({
    title,
    theme,
    status,
    progress = 0,
    ageRange,
    hideTitle = false,
}) => {
    const themeClasses: Record<string, string> = {
        archipelago: 'adventure-archipelago',
        forest: 'adventure-forest',
        city: 'adventure-city',
        valley: 'adventure-valley',
        kingdom: 'adventure-kingdom',
        cosmos: 'adventure-cosmos',
    };

    return (
        <article className={`group wallpaper-card ${themeClasses[theme]} relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/10 transition-shadow hover:shadow-md`}>
            {/* Label */}
            {!hideTitle && (
                <div className="label absolute top-6 left-6 z-50 pointer-events-none transition-opacity duration-300">
                    <span className="text-white text-2xl font-bold drop-shadow-lg">
                        {title}
                    </span>
                </div>
            )}

            {/* Progress Bar */}
            {status !== 'locked' && progress > 0 && (
                <div className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full">
                    <div className="w-20 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-white text-xs font-bold">{progress}%</span>
                </div>
            )}

            {/* Scene Container */}
            <div className="scene w-full h-full relative overflow-hidden">
                {theme === 'archipelago' && <ArchipelagoScene />}
                {theme === 'forest' && <ForestScene />}
                {theme === 'city' && <CityScene />}
                {theme === 'valley' && <ValleyScene />}
                {theme === 'kingdom' && <KingdomScene />}
                {theme === 'cosmos' && <CosmosScene />}

                {/* Premium atmosphere — applies to every scene */}
                <Atmosphere />
            </div>

            {/* Hover Effect Layer */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-6 z-[55]">
                <div className="text-white">
                    <h3 className="text-2xl font-bold mb-1">{title}</h3>
                </div>
            </div>

            <style>{adventureStyles}</style>
        </article>
    );
};

// ============== SHARED ATMOSPHERE & ELEMENTS ==============

/** Premium overlay stack: top light bloom, horizon haze, vignette, fine film grain. */
const Atmosphere = () => (
    <div className="pointer-events-none absolute inset-0 z-30">
        <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-[26%] h-1/3 bg-gradient-to-t from-white/10 to-transparent blur-lg" />
        <div className="absolute inset-0 wallpaper-vignette" />
        <div className="absolute inset-0 wallpaper-grain" />
    </div>
);

/** Glowing sun (light mode) / moon (dark mode) with soft halo. Pass position via className. */
const Celestial: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`absolute ${className} w-14 h-14 z-[2]`}>
        {/* Sun — light mode */}
        <div className="absolute inset-0 dark:hidden">
            <div className="absolute -inset-6 rounded-full bg-amber-300/40 blur-2xl animate-pulse-slow" />
            <div className="absolute inset-0 rounded-full celestial-sun" />
        </div>
        {/* Moon — dark mode */}
        <div className="absolute inset-0 hidden dark:block">
            <div className="absolute -inset-5 rounded-full bg-sky-100/20 blur-2xl animate-pulse-slow" />
            <div className="absolute inset-0 rounded-full celestial-moon">
                <div className="absolute top-2.5 left-3 w-2 h-2 rounded-full bg-slate-900/10" />
                <div className="absolute top-6 left-7 w-3 h-3 rounded-full bg-slate-900/10" />
                <div className="absolute top-9 left-4 w-1.5 h-1.5 rounded-full bg-slate-900/10" />
            </div>
        </div>
    </div>
);

/** Organic starfield with a few twinkling accents. `alwaysOn` keeps stars in light mode too (space). */
const StarField: React.FC<{ alwaysOn?: boolean }> = ({ alwaysOn = false }) => (
    <div className="absolute inset-0 z-0 overflow-hidden">
        <div className={`absolute inset-0 bg-stars ${alwaysOn ? 'opacity-90' : 'opacity-0 dark:opacity-90'}`} />
        <div className={`absolute inset-0 ${alwaysOn ? 'opacity-100' : 'opacity-0 dark:opacity-100'}`}>
            <span className="star-twinkle" style={{ top: '14%', left: '22%' }} />
            <span className="star-twinkle" style={{ top: '26%', left: '68%', animationDelay: '0.6s' }} />
            <span className="star-twinkle" style={{ top: '42%', left: '44%', animationDelay: '1.2s' }} />
            <span className="star-twinkle" style={{ top: '11%', left: '84%', animationDelay: '1.8s' }} />
            <span className="star-twinkle" style={{ top: '56%', left: '13%', animationDelay: '0.3s' }} />
        </div>
    </div>
);

/** A pair of distant seagulls drifting across the sky. */
const Birds: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        className={`absolute ${className} z-[2] text-slate-700/45 dark:text-white/40 animate-bird`}
        width="46" height="16" viewBox="0 0 46 16" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    >
        <path d="M2 9 Q7 3 12 9 Q17 3 22 9" />
        <path d="M25 12 Q29 7 33 12 Q37 7 41 12" />
    </svg>
);

// ============== SCENE COMPONENTS ==============

const ArchipelagoScene = () => (
    <div className="scene-archipelago w-full h-full relative bg-gradient-to-b from-[#7fe3f0] via-[#37bfe8] to-[#cdeff5] dark:from-[#06182f] dark:via-[#0b3a5c] dark:to-[#0a5d7a]">
        <StarField />

        {/* Warm horizon glow (golden-hour hint) */}
        <div className="absolute inset-x-0 bottom-[34%] h-24 bg-gradient-to-t from-amber-200/40 to-transparent dark:from-sky-300/10 z-0 blur-md" />

        {/* Sun / Moon */}
        <Celestial className="top-9 right-10" />

        {/* Birds */}
        <Birds className="top-[52px] left-[28%]" />

        {/* Clouds */}
        <div className="cloud absolute top-10 left-8 w-[70px] h-[22px] bg-white/90 dark:bg-white/12 rounded-[20px] blur-[1px] animate-float-h z-[1]" />
        <div className="cloud absolute top-[70px] right-16 w-[90px] h-[26px] bg-white/80 dark:bg-white/10 rounded-[20px] blur-[1px] animate-float-h-delayed z-[1]" />
        <div className="cloud absolute top-[120px] left-[40%] w-[60px] h-[20px] bg-white/75 dark:bg-white/[0.08] rounded-[20px] blur-[1px] animate-float-h z-[1]" style={{ animationDelay: '2s' }} />

        {/* Water Background (gradient + shimmer) */}
        <div className="absolute bottom-0 w-full h-[130px] bg-gradient-to-b from-[#3bb7ef] to-[#1d83c7] dark:from-[#0a5d7a] dark:to-[#063f56] z-1 overflow-hidden">
            <div className="water-shimmer absolute top-7 left-0 w-full h-2 opacity-70" />
            <div className="water-shimmer absolute top-[60px] left-0 w-full h-1.5 opacity-50" style={{ animationDelay: '2.4s' }} />
        </div>

        {/* Main Island (shaded sand) */}
        <div className="island-main absolute bottom-10 left-[5%] w-[200px] h-[100px] rounded-t-full z-5 shadow-island bg-gradient-to-b from-[#ffd277] to-[#ee9f3c]">
            {/* Palm Tree */}
            <div className="palm absolute -top-[70px] left-[60px]">
                {/* Trunk */}
                <div className="trunk w-4 h-[80px] bg-gradient-to-r from-[#6b4a3a] to-[#8a6147] rounded-lg -rotate-6" />
                {/* Fronds - spreading in all directions */}
                <div className="fronds absolute top-0 left-2">
                    {/* Left fronds */}
                    <div className="absolute -top-2 left-0 w-[55px] h-[18px] bg-[#4caf50] rounded-[50px] origin-right -rotate-[20deg] -translate-x-[50px]" />
                    <div className="absolute -top-4 left-0 w-[50px] h-[16px] bg-[#66bb6a] rounded-[50px] origin-right -rotate-[40deg] -translate-x-[45px]" />
                    <div className="absolute top-0 left-0 w-[45px] h-[14px] bg-[#81c784] rounded-[50px] origin-right rotate-[10deg] -translate-x-[40px]" />
                    {/* Right fronds */}
                    <div className="absolute -top-2 left-0 w-[55px] h-[18px] bg-[#4caf50] rounded-[50px] origin-left rotate-[20deg]" />
                    <div className="absolute -top-4 left-0 w-[50px] h-[16px] bg-[#66bb6a] rounded-[50px] origin-left rotate-[40deg]" />
                    <div className="absolute top-0 left-0 w-[45px] h-[14px] bg-[#81c784] rounded-[50px] origin-left -rotate-[10deg]" />
                    {/* Top frond */}
                    <div className="absolute -top-6 left-[-5px] w-[20px] h-[40px] bg-[#66bb6a] rounded-[50px]" />
                </div>
                {/* Coconuts */}
                <div className="coconuts absolute -top-1 left-0 flex gap-1">
                    <div className="w-3 h-3 bg-[#5d4037] rounded-full" />
                    <div className="w-3 h-3 bg-[#5d4037] rounded-full" />
                    <div className="w-2.5 h-2.5 bg-[#6d4c41] rounded-full" />
                </div>
            </div>
        </div>

        {/* Lighthouse */}
        <div className="lighthouse absolute bottom-[60px] right-10 w-5 h-20 bg-stripes-lighthouse rounded-t z-3 shadow-md">
            <div className="top absolute -top-4 -left-1 w-7 h-4 bg-[#333] rounded-t" />
            <div className="light absolute top-1 left-2 w-3 h-2.5 bg-[#ffeb3b] rounded-full animate-twinkle shadow-torch" />
        </div>

        {/* Boat */}
        <div className="boat absolute bottom-[50px] right-1/2 w-12 h-5 bg-[#ef5350] rounded-b-[20px] z-8 animate-float">
            <div className="sail-l absolute bottom-5 left-1 border-b-[30px] border-b-[#eceff1] border-r-[20px] border-r-transparent" />
            <div className="sail-r absolute bottom-5 left-[27px] border-b-[20px] border-b-[#cfd8dc] border-l-[15px] border-l-transparent" />
        </div>

        {/* Second Boat */}
        <div className="boat absolute bottom-[70px] left-[80%] w-10 h-4 bg-[#42a5f5] rounded-b-[15px] z-6 animate-float" style={{ animationDelay: '1.5s' }}>
            <div className="sail absolute bottom-4 left-1 border-b-[25px] border-b-white border-r-[15px] border-r-transparent" />
        </div>

        {/* Foreground Water (gradient wave) */}
        <div className="water-fg absolute -bottom-5 w-[120%] -left-[10%] h-[90px] rounded-t-[50%] z-20 shadow-water animate-wave bg-gradient-to-b from-[#1f9fe0] to-[#0570b6] dark:from-[#0a5168] dark:to-[#063044]" />
    </div>
);

const ForestScene = () => (
    <div className="scene-forest w-full h-full relative bg-gradient-to-b from-[#7cc6f5] via-[#a7d8f6] to-[#d8ecfb] dark:from-[#0c1b40] dark:via-[#16265c] dark:to-[#243a72]">
        <StarField />
        <Celestial className="top-9 right-10" />
        <Birds className="top-[44px] left-[18%]" />
        <div className="cloud absolute top-8 left-10 w-[70px] h-5 bg-white/85 dark:bg-white/10 rounded-[20px] blur-[1px] animate-float-h z-[1]" />

        {/* Horizon haze */}
        <div className="absolute inset-x-0 bottom-[120px] h-16 bg-gradient-to-t from-emerald-200/30 to-transparent dark:from-emerald-400/10 z-0 blur-md" />

        {/* Ground Background */}
        <div className="ground-bg absolute bottom-0 w-full h-[120px] bg-gradient-to-b from-[#46a849] to-[#2f7d33] z-1 rounded-t-[50%]" />

        {/* Pine Trees Background */}
        <div className="pine-group absolute bottom-[60px] left-[10%] z-2 scale-75">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>
        <div className="pine-group absolute bottom-[80px] right-[15%] z-2 scale-90">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>
        <div className="pine-group absolute bottom-[70px] left-[70%] z-2 scale-[0.6]">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>
        <div className="pine-group absolute bottom-[75px] left-[85%] z-2 scale-[0.55]">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#388e3c] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#388e3c]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>
        <div className="pine-group absolute bottom-[65px] right-[5%] z-2 scale-[0.7]">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>

        {/* Ground Foreground */}
        <div className="ground-fg absolute bottom-0 w-full h-20 bg-gradient-to-b from-[#6cc06f] to-[#4a9b4e] z-10 rounded-tr-[30%]">
            {/* Pond */}
            <div className="pond absolute bottom-5 right-5 w-[120px] h-10 bg-[#4fc3f7] rounded-full border-4 border-[#81c784]">
                <div className="lilypad absolute top-2.5 left-5 w-4 h-2.5 bg-[#2e7d32] rounded-full" />
            </div>

            {/* Tent */}
            <div className="tent absolute bottom-[70px] left-[20%] w-0 h-0 border-l-[30px] border-l-transparent border-r-[30px] border-r-transparent border-b-[40px] border-b-[#ff7043] z-11" />

            {/* Campfire */}
            <div className="campfire absolute bottom-[65px] left-[32%] z-11">
                <div className="log w-4 h-1 bg-[#5d4037] rounded" />
                <div className="flame absolute -top-[10px] left-1 w-2.5 h-2.5 bg-[#ffeb3b] rounded-[50%_0_50%_50%] -rotate-45 animate-flame" />
            </div>
        </div>

        {/* Main Pine Tree */}
        <div className="pine-group absolute bottom-[60px] left-[45%] z-12 scale-110">
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32] mb-[-15px]" />
            <div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[35px] border-b-[#2e7d32]" />
            <div className="w-3 h-5 bg-[#5d4037] rounded mx-auto" />
        </div>

        {/* Bear */}
        <div className="bear absolute bottom-[90px] right-[15%] w-10 h-6 bg-[#3e2723] rounded-[15px_20px_5px_5px] z-3">
            <div className="head absolute -top-1 -left-1 w-4 h-4 bg-[#3e2723] rounded-full" />
        </div>

        {/* Fireflies (dark mode only) */}
        <div className="firefly absolute bottom-[90px] left-[30%] w-1 h-1 bg-[#ffeb3b] rounded-full opacity-0 dark:opacity-100 animate-twinkle z-20" />
        <div className="firefly absolute bottom-[110px] right-[30%] w-1 h-1 bg-[#ffeb3b] rounded-full opacity-0 dark:opacity-100 animate-twinkle-delayed z-20" />
    </div>
);

/** A city tower with a gradient body and a grid of windows — some lit warm at night. */
const Tower: React.FC<{ className: string; from: string; to: string; lit?: number[] }> = ({ className, from, to, lit = [] }) => (
    <div
        className={`fg-bldg absolute rounded-t-[10px] shadow-bldg overflow-hidden ${className}`}
        style={{ backgroundImage: `linear-gradient(to bottom, ${from}, ${to})` }}
    >
        <div className="absolute inset-x-2 top-3 grid grid-cols-3 gap-1.5">
            {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className={`h-2 rounded-[2px] ${lit.includes(i) ? 'window-glow' : 'bg-white/15 dark:bg-white/[0.07]'}`} />
            ))}
        </div>
    </div>
);

const CityScene = () => (
    <div className="scene-city w-full h-full relative bg-gradient-to-b from-[#8b93f5] via-[#a5b4fc] to-[#d6ddfe] dark:from-[#1b1745] dark:via-[#262061] dark:to-[#1e3a6e]">
        <StarField />
        <Celestial className="top-8 right-10" />

        {/* Background Buildings */}
        <div className="skyline-bg absolute bottom-10 w-full flex justify-around opacity-60 z-1">
            <div className="bg-bldg w-10 h-[100px] bg-[#4f46e5] rounded-t" />
            <div className="bg-bldg w-10 h-[160px] bg-[#6366f1] rounded-t" />
            <div className="bg-bldg w-10 h-[90px] bg-[#4f46e5] rounded-t" />
            <div className="bg-bldg w-10 h-[140px] bg-[#4338ca] rounded-t" />
            <div className="bg-bldg w-10 h-[120px] bg-[#4f46e5] rounded-t" />
            <div className="bg-bldg w-10 h-[110px] bg-[#6366f1] rounded-t" />
            <div className="bg-bldg w-8 h-[80px] bg-[#4f46e5] rounded-t" />
            <div className="bg-bldg w-10 h-[130px] bg-[#6366f1] rounded-t" />
        </div>

        {/* Additional Background Buildings (for wider cards) */}
        <div className="skyline-bg-2 absolute bottom-10 left-0 w-full flex justify-between opacity-40 z-0">
            <div className="bg-bldg w-8 h-[70px] bg-[#4338ca] rounded-t" />
            <div className="bg-bldg w-6 h-[50px] bg-[#4f46e5] rounded-t" />
            <div className="bg-bldg w-8 h-[90px] bg-[#6366f1] rounded-t" />
            <div className="bg-bldg w-6 h-[60px] bg-[#4338ca] rounded-t" />
            <div className="bg-bldg w-8 h-[75px] bg-[#4f46e5] rounded-t" />
        </div>

        {/* Foreground Buildings (gradient + lit windows) */}
        <Tower className="bottom-[50px] left-[5%] w-[60px] h-[140px] z-5" from="#8b96fb" to="#5b67d6" lit={[1, 3, 4, 7, 9, 12]} />
        <Tower className="bottom-[50px] left-[25%] w-[80px] h-[200px] z-6" from="#8e97d8" to="#5a64ad" lit={[0, 2, 5, 6, 9, 11, 13]} />
        <Tower className="bottom-[50px] left-[55%] w-[50px] h-[120px] z-4" from="#f47472" to="#c83f3d" lit={[1, 4, 8]} />
        <Tower className="bottom-[50px] right-[5%] w-[70px] h-[160px] z-5" from="#5fd6e6" to="#27a3b8" lit={[2, 3, 7, 10, 12]} />

        {/* Road */}
        <div className="city-ground absolute bottom-0 w-full h-[50px] bg-[#78909c] z-10" />
        <div className="road absolute bottom-[15px] w-full h-[25px] bg-[#37474f] z-11">
            <div className="road-line absolute top-2.5 w-full h-0.5 bg-road-line" />
        </div>

        {/* Bus (animated) */}
        <div className="bus absolute bottom-[18px] -left-[100px] w-[60px] h-[25px] bg-[#ffb300] rounded-[6px] z-15 animate-drive">
            <div className="bus-win absolute top-[3px] left-[5px] w-10 h-2 bg-[#e3f2fd]" />
        </div>

        {/* Helicopter */}
        <div className="helicopter absolute top-[60px] left-[60%] w-10 h-5 bg-gradient-to-b from-[#5b6675] to-[#3a4250] rounded-[20px_5px_5px_20px] z-2 animate-float shadow-md">
            <div className="heli-win absolute top-1 left-1.5 w-2.5 h-2 bg-[#bfe7ff] rounded-sm" />
            <div className="heli-light absolute -bottom-1 left-4 w-1 h-1 bg-red-500 rounded-full animate-twinkle shadow-torch" />
            <div className="heli-tail absolute right-[-20px] top-[5px] w-[25px] h-[5px] bg-[#3a4250]" />
            <div className="heli-rotor absolute -top-2.5 left-2.5 w-[50px] h-0.5 bg-[#2b313c] animate-spin-fast" />
        </div>

        {/* Streetlight */}
        <div className="streetlight absolute bottom-[50px] left-[45%] w-1 h-[60px] bg-[#455a64] z-14">
            <div className="light-head absolute top-0 -left-2 w-5 h-1.5 bg-[#455a64] rounded" />
            <div className="light-bulb absolute top-1.5 left-0 w-2 h-2 bg-[#eceff1] dark:bg-[#ffca28] rounded-full shadow-streetlight dark:shadow-streetlight-on" />
        </div>
    </div>
);

const ValleyScene = () => (
    <div className="scene-valley w-full h-full relative bg-gradient-to-b from-[#88cdf2] via-[#bbe3f6] to-[#dcefdf] dark:from-[#0d2742] dark:via-[#163a5c] dark:to-[#1d5230]">
        <StarField />
        <Celestial className="top-8 right-10" />
        <Birds className="top-[40px] left-[16%]" />
        <div className="cloud absolute top-[44px] left-[20%] w-20 h-6 bg-white/85 dark:bg-white/10 rounded-[20px] blur-[1px] animate-float-h z-[1]" />

        {/* Background Hills */}
        <div className="hill-bg absolute bottom-0 w-full h-[200px] bg-gradient-to-b from-[#9ccc5a] to-[#79ad3c] rounded-t-[100%] scale-x-150 z-1" />
        <div className="hill-bg-2 absolute bottom-0 left-[-20%] w-[60%] h-[150px] bg-[#a6d36a] rounded-t-[100%] scale-x-150 z-0 opacity-70" />
        <div className="hill-bg-3 absolute bottom-0 right-[-20%] w-[60%] h-[170px] bg-[#7cb342] rounded-t-[100%] scale-x-150 z-0 opacity-70" />

        {/* Barn */}
        <div className="barn absolute bottom-[120px] left-[20%] w-[50px] h-10 bg-[#d32f2f] z-2 clip-barn">
            <div className="barn-door absolute bottom-0 left-[15px] w-5 h-[25px] bg-white border-2 border-[#b71c1c] border-b-0 rounded-t-[10px]" />
        </div>
        <div className="silo absolute bottom-[120px] left-[calc(20%+50px)] w-4 h-9 bg-[#cfd8dc] rounded-t z-2" />

        {/* Hot Air Balloon */}
        <div className="balloon absolute top-[60px] right-[30%] z-1 animate-balloon">
            <div className="balloon-body w-10 h-[50px] bg-gradient-balloon rounded-[50%]" />
            <div className="basket absolute bottom-[-15px] left-3 w-4 h-3 bg-[#795548] rounded-sm" />
        </div>

        {/* Hills Foreground */}
        <div className="hill-fg-l absolute -bottom-[50px] -left-[20%] w-[70%] h-[200px] bg-gradient-to-b from-[#84bb47] to-[#5f923a] rounded-full z-3" />
        <div className="hill-fg-r absolute -bottom-[80px] -right-[20%] w-[80%] h-[220px] bg-gradient-to-b from-[#72ab3f] to-[#527e2f] rounded-full z-4">
            {/* Fence */}
            <div className="fence absolute top-[65px] left-[30%] flex gap-[5px]">
                <div className="post w-1 h-4 bg-[#8d6e63]" />
                <div className="post w-1 h-4 bg-[#8d6e63]" />
                <div className="post w-1 h-4 bg-[#8d6e63]" />
            </div>
        </div>

        {/* Sheep */}
        <div className="sheep absolute bottom-[90px] right-[25%] w-3.5 h-2.5 bg-white rounded-lg z-6">
            <div className="absolute -top-1 -left-0.5 w-2 h-2 bg-[#333] rounded-full" />
        </div>
        <div className="sheep absolute bottom-[100px] right-[15%] w-3.5 h-2.5 bg-white rounded-lg z-6 animate-float">
            <div className="absolute -top-1 -left-0.5 w-2 h-2 bg-[#333] rounded-full" />
        </div>
        <div className="sheep absolute bottom-[95px] left-[40%] w-3.5 h-2.5 bg-white rounded-lg z-6" style={{ animationDelay: '1s' }}>
            <div className="absolute -top-1 -left-0.5 w-2 h-2 bg-[#333] rounded-full" />
        </div>
        <div className="sheep absolute bottom-[105px] right-[40%] w-3 h-2 bg-white rounded-lg z-6 animate-float" style={{ animationDelay: '2s' }}>
            <div className="absolute -top-1 -left-0.5 w-1.5 h-1.5 bg-[#333] rounded-full" />
        </div>

        {/* Tractor (animated) */}
        <div className="tractor absolute bottom-[130px] left-[10%] w-[30px] h-5 bg-[#43a047] z-2 animate-tractor">
            <div className="wheel-l absolute -bottom-[5px] left-0 w-3 h-3 bg-[#333] rounded-full" />
            <div className="wheel-r absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-[#333] rounded-full" />
        </div>
    </div>
);

const KingdomScene = () => (
    <div className="scene-kingdom w-full h-full relative bg-gradient-to-b from-[#ffb24d] via-[#ff8f5e] to-[#ffd9a8] dark:from-[#241640] dark:via-[#3b1f49] dark:to-[#5b2f44]">
        <StarField />
        <Celestial className="top-8 right-10" />

        {/* Warm horizon glow behind the castle */}
        <div className="absolute inset-x-0 bottom-10 h-28 bg-gradient-to-t from-amber-300/45 to-transparent dark:from-fuchsia-500/15 z-0 blur-md" />

        {/* Dragon */}
        <div className="dragon absolute top-[60px] left-[20%] w-10 h-5 bg-[#4caf50] rounded-[20px] z-10 animate-dragon">
            <div className="d-head absolute -top-[5px] -left-2.5 w-4 h-4 bg-[#4caf50] rounded" />
            <div className="d-wing absolute -top-4 left-2.5 w-5 h-5 bg-[#81c784] rounded-tr-[20px] -rotate-[20deg] animate-float" />
        </div>

        {/* Mountain Base */}
        <div className="mount-base absolute -bottom-20 w-full h-[200px] rounded-t-[50%] z-1 bg-gradient-to-b from-[#7c5a44] to-[#4e3527] dark:from-[#3a2540] dark:to-[#241531]" />

        {/* Castle */}
        <div className="castle-complex absolute bottom-[90px] left-1/2 -translate-x-1/2 flex items-end z-5">
            <div className="tower-short relative w-[25px] h-[70px] bg-[#9e9e9e] rounded mx-0.5">
                <div className="k-roof absolute -top-5 -left-0.5 w-[115%] h-[25px] bg-[#c62828] clip-roof" />
                <div className="k-flag absolute -top-9 left-1/2 w-0.5 h-4 bg-[#333]">
                    <div className="flag absolute top-0 left-0.5 w-3 h-2 bg-[#ffca28] animate-sway" />
                </div>
                <div className="torch absolute top-5 left-[5px] w-1 h-1 bg-[#ffeb3b] rounded-full animate-twinkle shadow-torch" />
            </div>
            <div className="tower-tall relative w-[25px] h-[100px] bg-[#bdbdbd] rounded mx-0.5 shadow-tower">
                <div className="k-roof absolute -top-5 -left-0.5 w-[115%] h-[25px] bg-[#c62828] clip-roof" />
                <div className="k-flag absolute -top-9 left-1/2 w-0.5 h-4 bg-[#333]">
                    <div className="flag absolute top-0 left-0.5 w-3 h-2 bg-[#ffca28] animate-sway" />
                </div>
            </div>
            <div className="gatehouse relative w-[60px] h-[60px] bg-[#757575] z-6 flex flex-col items-center justify-end">
                <div className="k-roof absolute -top-5 left-[-5%] w-[110%] h-[25px] bg-[#c62828] clip-roof" />
                <div className="gate-arch w-[30px] h-10 bg-[#3e2723] rounded-t-[15px] border-2 border-[#616161] border-b-0">
                    <div className="portcullis w-full h-[25px] bg-portcullis border-b-2 border-[#333]" />
                </div>
            </div>
            <div className="tower-tall relative w-[25px] h-[100px] bg-[#bdbdbd] rounded mx-0.5 shadow-tower">
                <div className="k-roof absolute -top-5 -left-0.5 w-[115%] h-[25px] bg-[#c62828] clip-roof" />
                <div className="k-flag absolute -top-9 left-1/2 w-0.5 h-4 bg-[#333]">
                    <div className="flag absolute top-0 left-0.5 w-3 h-2 bg-[#ffca28] animate-sway" />
                </div>
            </div>
            <div className="tower-short relative w-[25px] h-[70px] bg-[#9e9e9e] rounded mx-0.5">
                <div className="k-roof absolute -top-5 -left-0.5 w-[115%] h-[25px] bg-[#c62828] clip-roof" />
                <div className="torch absolute top-5 right-[5px] w-1 h-1 bg-[#ffeb3b] rounded-full animate-twinkle shadow-torch" />
            </div>
        </div>

        {/* Market Stall */}
        <div className="market absolute bottom-[70px] left-[25%] w-[30px] h-5 bg-[#8d6e63] z-7">
            <div className="market-roof absolute -top-2.5 w-[30px] h-2.5 bg-market-stripes rounded-t" />
        </div>

        {/* Guard */}
        <div className="guard absolute bottom-[70px] left-[65%] w-2 h-4 bg-[#e0e0e0] z-7">
            <div className="absolute -top-1.5 w-2 h-1.5 bg-[#757575] rounded-full" />
            <div className="spear absolute -right-0.5 h-[25px] w-px bg-[#333] -bottom-2" />
        </div>
    </div>
);

// ============== STYLES ==============

const CosmosScene = () => (
    <div className="scene-cosmos w-full h-full relative bg-gradient-to-b from-[#241a6b] via-[#1e2f7e] to-[#05030f]">
        <StarField alwaysOn />

        {/* Nebula clouds */}
        <div className="absolute -top-12 right-0 w-2/3 h-2/3 z-0 blur-2xl" style={{ background: 'radial-gradient(circle, rgba(217,70,239,0.28), transparent 70%)' }} />
        <div className="absolute bottom-0 -left-6 w-2/3 h-2/3 z-0 blur-2xl" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.20), transparent 70%)' }} />

        {/* Planet Big */}
        <div className="planet-big absolute bottom-[-50px] left-[-50px] w-[200px] h-[200px] bg-[#3949ab] rounded-full shadow-[inset_-20px_-20px_50px_rgba(0,0,0,0.5)] z-5">
            <div className="crater absolute top-10 left-10 w-5 h-5 bg-[#283593] rounded-full opacity-50" />
            <div className="crater absolute top-20 left-24 w-8 h-8 bg-[#283593] rounded-full opacity-50" />
            <div className="crater absolute top-32 left-16 w-6 h-6 bg-[#283593] rounded-full opacity-50" />
            <div className="planet-ring absolute top-1/2 left-1/2 w-[260px] h-[60px] border-[15px] border-[#ffca28]/30 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-[-20deg]" />
        </div>

        {/* Small Planet */}
        <div className="planet-small absolute top-20 left-[15%] w-[50px] h-[50px] bg-gradient-to-br from-[#ff6b6b] to-[#c92a2a] rounded-full shadow-[inset_-5px_-5px_15px_rgba(0,0,0,0.5)] z-3">
            <div className="crater absolute top-2 left-3 w-3 h-3 bg-[#a61e1e] rounded-full opacity-40" />
        </div>

        {/* Additional Small Planet */}
        <div className="planet-tiny absolute top-[40%] right-[15%] w-[30px] h-[30px] bg-gradient-to-br from-[#81d4fa] to-[#0288d1] rounded-full shadow-[inset_-3px_-3px_10px_rgba(0,0,0,0.5)] z-3 animate-float" />

        {/* Satellite */}
        <div className="satellite absolute top-[30%] left-[30%] w-6 h-2 bg-[#bdbdbd] z-4 animate-dragon">
            <div className="panel-l absolute top-0 -left-4 w-4 h-2 bg-[#1565c0]" />
            <div className="panel-r absolute top-0 -right-4 w-4 h-2 bg-[#1565c0]" />
            <div className="dish absolute -top-1 left-2 w-2 h-2 bg-[#e0e0e0] rounded-full" />
        </div>

        {/* Rocket */}
        <div className="rocket absolute top-1/2 left-1/2 w-8 h-12 bg-white rounded-[50%_50%_5px_5px] z-10 animate-float">
            <div className="window absolute top-3 left-2 w-4 h-4 bg-[#4fc3f7] rounded-full border-2 border-[#e0e0e0]" />
            <div className="fin-l absolute bottom-0 -left-2 w-2 h-4 bg-[#f44336] rounded-t-lg" />
            <div className="fin-r absolute bottom-0 -right-2 w-2 h-4 bg-[#f44336] rounded-t-lg" />
            <div className="flame absolute -bottom-4 left-2 w-4 h-6 bg-[#ff9800] rounded-[0_0_50%_50%] animate-flame" />
        </div>

        {/* UFO */}
        <div className="ufo absolute top-20 right-20 w-12 h-6 z-8 animate-dragon">
            <div className="dome absolute -top-3 left-3 w-6 h-4 bg-[#b3e5fc] rounded-t-full border border-slate-400" />
            <div className="saucer w-full h-full bg-[#bdbdbd] rounded-[50%] shadow-lg flex items-center justify-center gap-1">
                <div className="light w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                <div className="light w-1 h-1 bg-green-500 rounded-full animate-pulse delay-75" />
                <div className="light w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-150" />
            </div>
        </div>

        {/* Shooting Star */}
        <div className="shooting-star absolute top-10 left-1/2 w-[100px] h-[2px] bg-gradient-to-r from-white to-transparent -rotate-[30deg] animate-drive" style={{ animationDuration: '3s' }} />

        {/* Astronaut */}
        <div className="astronaut absolute bottom-20 right-20 w-8 h-10 bg-white rounded-lg z-9 animate-float-h">
            <div className="visor absolute top-1 left-1 w-6 h-4 bg-[#333] rounded-md border border-gray-400" />
            <div className="backpack absolute top-2 -right-2 w-2 h-6 bg-[#e0e0e0] rounded-r" />
        </div>

    </div>
);

const adventureStyles = `
  /* Background patterns — irregular, natural star scatter */
  .bg-stars {
    background-image:
      radial-gradient(1.6px 1.6px at 18% 24%, rgba(255,255,255,.95), transparent 60%),
      radial-gradient(1px 1px at 62% 18%, rgba(255,255,255,.7), transparent 60%),
      radial-gradient(1.6px 1.6px at 82% 56%, rgba(255,255,255,.85), transparent 60%),
      radial-gradient(1px 1px at 34% 66%, rgba(255,255,255,.6), transparent 60%),
      radial-gradient(1.2px 1.2px at 48% 42%, rgba(255,255,255,.55), transparent 60%),
      radial-gradient(1.6px 1.6px at 90% 22%, rgba(255,255,255,.9), transparent 60%),
      radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,.6), transparent 60%),
      radial-gradient(1px 1px at 72% 78%, rgba(255,255,255,.55), transparent 60%),
      radial-gradient(1.3px 1.3px at 28% 12%, rgba(255,255,255,.7), transparent 60%);
    background-repeat: no-repeat;
  }

  /* Premium atmosphere */
  .wallpaper-vignette {
    background: radial-gradient(125% 105% at 50% 26%, transparent 50%, rgba(0,0,0,0.34) 100%);
  }
  .wallpaper-grain {
    opacity: 0.05;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    background-size: 150px 150px;
  }

  /* Glowing celestial bodies */
  .celestial-sun {
    background: radial-gradient(circle at 35% 30%, #fff7cc, #ffd24d 55%, #fb9d2e);
    box-shadow: 0 0 28px rgba(253,200,80,.75), 0 0 64px rgba(253,170,50,.35);
  }
  .celestial-moon {
    background: radial-gradient(circle at 35% 30%, #fdfdff, #d7def0 58%, #b9c2da);
    box-shadow: 0 0 22px rgba(214,226,255,.5), 0 0 54px rgba(150,170,220,.28);
  }

  /* Twinkling star accents */
  .star-twinkle {
    position: absolute;
    width: 3px; height: 3px;
    border-radius: 9999px;
    background: #fff;
    box-shadow: 0 0 7px rgba(255,255,255,.95);
    animation: twinkle 2.6s ease-in-out infinite;
  }

  /* Lit windows for the city at night */
  .window-glow { background: rgba(255, 214, 110, 0.85); box-shadow: 0 0 6px rgba(255,196,60,.7); }

  /* Water shimmer highlight */
  .water-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
    animation: shimmer 5s ease-in-out infinite;
  }

  /* Shadows */
  .shadow-island { box-shadow: inset -15px -5px 0 rgba(245, 124, 0, 0.55); }
  .shadow-water { box-shadow: 0 -10px 0 #4fc3f7; }
  .shadow-bldg { box-shadow: 5px 0 10px rgba(0,0,0,0.1); }
  .shadow-tower { box-shadow: inset -5px 0 0 rgba(0,0,0,0.2); }
  .shadow-streetlight { box-shadow: 0 0 10px #eceff1; }
  .shadow-streetlight-on { box-shadow: 0 0 10px #ffca28; }
  .shadow-torch { box-shadow: 0 0 5px #ff6f00; }

  /* Background gradients */
  .bg-stripes-lighthouse {
    background: repeating-linear-gradient(45deg, #f44336, #f44336 10px, #fff 10px, #fff 20px);
  }
  .bg-road-line {
    background: repeating-linear-gradient(90deg, #fff, #fff 15px, transparent 15px, transparent 30px);
  }
  .bg-gradient-balloon {
    background: linear-gradient(to right, #e91e63 20%, #ffeb3b 20%, #ffeb3b 40%, #2196f3 40%, #2196f3 60%, #e91e63 60%);
  }
  .bg-market-stripes {
    background: repeating-linear-gradient(90deg, #fff, #fff 5px, #f44336 5px, #f44336 10px);
  }
  .bg-portcullis {
    background: repeating-linear-gradient(90deg, #333, #333 2px, transparent 2px, transparent 6px);
  }

  /* Clip paths */
  .clip-barn { clip-path: polygon(0% 40%, 50% 0%, 100% 40%, 100% 100%, 0% 100%); }
  .clip-roof { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }

  /* Animations */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes float-h {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(10px); }
  }
  @keyframes wave {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.05); }
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes flame {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.2); opacity: 1; }
  }
  @keyframes sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  @keyframes dragon-hover {
    0%, 100% { transform: translateY(0) rotate(5deg); }
    50% { transform: translateY(-15px) rotate(0deg); }
  }
  @keyframes drive {
    from { left: -100px; }
    to { left: 130%; }
  }
  @keyframes tractor-move {
    0% { left: 10%; }
    50% { left: 30%; }
    100% { left: 10%; }
  }
  @keyframes balloon-rise {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
  @keyframes spin-fast {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulseSlow {
    0%, 100% { opacity: 0.65; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.08); }
  }
  @keyframes shimmer {
    0%, 100% { transform: translateX(-60%); opacity: 0; }
    50% { opacity: 0.9; }
    80% { transform: translateX(60%); opacity: 0; }
  }
  @keyframes bird-fly {
    0% { transform: translate(0, 0); }
    50% { transform: translate(20px, -8px); }
    100% { transform: translate(40px, 0); }
  }

  .animate-float { animation: float 3s ease-in-out infinite; }
  .animate-float-h { animation: float-h 8s ease-in-out infinite alternate; }
  .animate-float-h-delayed { animation: float-h 8s ease-in-out infinite alternate 1s; }
  .animate-wave { animation: wave 4s ease-in-out infinite alternate; }
  .animate-twinkle { animation: twinkle 1s infinite; }
  .animate-twinkle-delayed { animation: twinkle 2s infinite alternate 1.5s; }
  .animate-flame { animation: flame 0.5s infinite alternate; }
  .animate-sway { animation: sway 2s ease-in-out infinite; }
  .animate-dragon { animation: dragon-hover 4s ease-in-out infinite; }
  .animate-drive { animation: drive 8s linear infinite; }
  .animate-tractor { animation: tractor-move 20s linear infinite; }
  .animate-balloon { animation: balloon-rise 6s ease-in-out infinite alternate; }
  .animate-spin-fast { animation: spin-fast 0.1s linear infinite; }
  .animate-pulse-slow { animation: pulseSlow 4s ease-in-out infinite; }
  .animate-bird { animation: bird-fly 9s ease-in-out infinite alternate; }

  @media (prefers-reduced-motion: reduce) {
    .wallpaper-card [class*="animate-"], .star-twinkle, .water-shimmer { animation: none !important; }
  }

  /* Hover effects */
  .wallpaper-card:hover .label { opacity: 0; }
`;

export default AdventureCard;
