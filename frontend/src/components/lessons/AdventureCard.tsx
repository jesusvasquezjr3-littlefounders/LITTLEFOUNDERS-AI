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

// ============== SCENE COMPONENTS ==============

const ArchipelagoScene = () => (
    <div className="scene-archipelago w-full h-full relative bg-gradient-to-b from-[#4dd0e1] to-[#b2ebf2] dark:from-[#01579b] dark:to-[#0277bd]">
        {/* Stars for dark mode */}
        <div className="stars absolute inset-0 bg-stars opacity-0 dark:opacity-90 z-0" />

        {/* Celestial (Sun/Moon) */}
        <div className="celestial absolute top-10 right-10 w-12 h-12 bg-[#fdd835] dark:bg-[#eee] rounded-full shadow-sun dark:shadow-moon z-1" />

        {/* Clouds */}
        <div className="cloud cloud-1 absolute top-10 left-8 w-[70px] h-[22px] bg-white dark:bg-white/15 rounded-[20px] animate-float-h" />
        <div className="cloud cloud-2 absolute top-[70px] right-12 w-[90px] h-[26px] bg-white dark:bg-white/15 rounded-[20px] animate-float-h-delayed" />
        <div className="cloud cloud-3 absolute top-[120px] left-[40%] w-[60px] h-[20px] bg-white dark:bg-white/15 rounded-[20px] animate-float-h" style={{ animationDelay: '2s' }} />

        {/* Background Islands */}


        {/* Water Background */}
        <div className="absolute bottom-0 w-full h-[130px] bg-[#29b6f6] z-1" />

        {/* Main Island */}
        <div className="island-main absolute bottom-10 left-[5%] w-[200px] h-[100px] bg-[#ffb74d] rounded-t-full z-5 shadow-island">
            {/* Palm Tree */}
            <div className="palm absolute -top-[70px] left-[60px]">
                {/* Trunk */}
                <div className="trunk w-4 h-[80px] bg-[#795548] rounded-lg -rotate-6" />
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
            <div className="light absolute top-1 left-2 w-3 h-2.5 bg-[#ffeb3b] rounded-full animate-twinkle" />
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

        {/* Foreground Water */}
        <div className="water-fg absolute -bottom-5 w-[120%] -left-[10%] h-[90px] bg-[#039be5] rounded-t-[50%] z-20 shadow-water animate-wave" />
    </div>
);

const ForestScene = () => (
    <div className="scene-forest w-full h-full relative bg-gradient-to-b from-[#42a5f5] to-[#bbdefb] dark:from-[#1a237e] dark:to-[#283593]">
        <div className="stars absolute inset-0 bg-stars opacity-0 dark:opacity-90 z-0" />
        <div className="celestial absolute top-10 right-10 w-12 h-12 bg-[#fdd835] dark:bg-[#eee] rounded-full shadow-sun dark:shadow-moon z-1" />
        <div className="cloud absolute top-8 right-10 w-[60px] h-5 bg-white dark:bg-white/15 rounded-[20px] animate-float-h" />

        {/* Ground Background */}
        <div className="ground-bg absolute bottom-0 w-full h-[120px] bg-[#43a047] z-1 rounded-t-[50%]" />

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
        <div className="ground-fg absolute bottom-0 w-full h-20 bg-[#66bb6a] z-10 rounded-tr-[30%]">
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

const CityScene = () => (
    <div className="scene-city w-full h-full relative bg-gradient-to-b from-[#6366f1] to-[#c7d2fe] dark:from-[#312e81] dark:to-[#1e3a8a]">
        <div className="stars absolute inset-0 bg-stars opacity-0 dark:opacity-90 z-0" />
        <div className="celestial absolute top-8 right-10 w-12 h-12 bg-[#ffd54f] dark:bg-[#eee] rounded-full shadow-sun dark:shadow-moon z-1" />

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

        {/* Foreground Buildings */}
        <div className="fg-bldg fb1 absolute bottom-[50px] left-[5%] w-[60px] h-[140px] bg-[#818cf8] rounded-t-[10px] z-5 shadow-bldg" />
        <div className="fg-bldg fb2 absolute bottom-[50px] left-[25%] w-[80px] h-[200px] bg-[#7986cb] rounded-t-[10px] z-6 shadow-bldg" />
        <div className="fg-bldg fb3 absolute bottom-[50px] left-[55%] w-[50px] h-[120px] bg-[#ef5350] rounded-t-[10px] z-4 shadow-bldg" />
        <div className="fg-bldg fb4 absolute bottom-[50px] right-[5%] w-[70px] h-[160px] bg-[#4dd0e1] rounded-t-[10px] z-5 shadow-bldg" />

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
        <div className="helicopter absolute top-[60px] left-[60%] w-10 h-5 bg-[#333] rounded-[20px_5px_5px_20px] z-2 animate-float">
            <div className="heli-tail absolute right-[-20px] top-[5px] w-[25px] h-[5px] bg-[#333]" />
            <div className="heli-rotor absolute -top-2.5 left-2.5 w-[50px] h-0.5 bg-[#333] animate-spin-fast" />
        </div>

        {/* Streetlight */}
        <div className="streetlight absolute bottom-[50px] left-[45%] w-1 h-[60px] bg-[#455a64] z-14">
            <div className="light-head absolute top-0 -left-2 w-5 h-1.5 bg-[#455a64] rounded" />
            <div className="light-bulb absolute top-1.5 left-0 w-2 h-2 bg-[#eceff1] dark:bg-[#ffca28] rounded-full shadow-streetlight dark:shadow-streetlight-on" />
        </div>
    </div>
);

const ValleyScene = () => (
    <div className="scene-valley w-full h-full relative bg-gradient-to-b from-[#66bb6a] to-[#dcedc8] dark:from-[#1b5e20] dark:to-[#2e7d32]">
        <div className="stars absolute inset-0 bg-stars opacity-0 dark:opacity-90 z-0" />
        <div className="celestial absolute top-8 right-10 w-12 h-12 bg-[#fdd835] dark:bg-[#eee] rounded-full shadow-sun dark:shadow-moon z-1" />
        <div className="cloud absolute top-[50px] left-1/2 w-20 h-6 bg-white dark:bg-white/15 rounded-[20px] animate-float-h" />

        {/* Background Hills */}
        <div className="hill-bg absolute bottom-0 w-full h-[200px] bg-[#8bc34a] rounded-t-[100%] scale-x-150 z-1" />
        <div className="hill-bg-2 absolute bottom-0 left-[-20%] w-[60%] h-[150px] bg-[#9ccc65] rounded-t-[100%] scale-x-150 z-0 opacity-70" />
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
        <div className="hill-fg-l absolute -bottom-[50px] -left-[20%] w-[70%] h-[200px] bg-[#7cb342] rounded-full z-3" />
        <div className="hill-fg-r absolute -bottom-[80px] -right-[20%] w-[80%] h-[220px] bg-[#689f38] rounded-full z-4">
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
    <div className="scene-kingdom w-full h-full relative bg-gradient-to-b from-[#ff9800] to-[#ffe0b2] dark:from-[#3e2723] dark:to-[#4e342e]">
        <div className="stars absolute inset-0 bg-stars opacity-0 dark:opacity-90 z-0" />
        <div className="celestial absolute top-8 right-10 w-12 h-12 bg-[#fdd835] dark:bg-[#eee] rounded-full shadow-sun dark:shadow-moon z-1" />

        {/* Dragon */}
        <div className="dragon absolute top-[60px] left-[20%] w-10 h-5 bg-[#4caf50] rounded-[20px] z-10 animate-dragon">
            <div className="d-head absolute -top-[5px] -left-2.5 w-4 h-4 bg-[#4caf50] rounded" />
            <div className="d-wing absolute -top-4 left-2.5 w-5 h-5 bg-[#81c784] rounded-tr-[20px] -rotate-[20deg] animate-float" />
        </div>

        {/* Mountain Base */}
        <div className="mount-base absolute -bottom-20 w-full h-[200px] bg-[#795548] rounded-t-[50%] z-1" />

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
    <div className="scene-cosmos w-full h-full relative bg-gradient-to-b from-[#1a237e] via-[#1e3a8a] to-[#000000]">
        <div className="stars absolute inset-0 bg-stars opacity-90 z-0" />

        {/* Nebula */}
        <div className="nebula absolute top-0 right-0 w-full h-full bg-gradient-radial from-indigo-500/20 to-transparent opacity-50 z-0" />

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
  /* Background patterns */
  .bg-stars {
    background-image: 
      radial-gradient(white 2px, transparent 2px), 
      radial-gradient(white 1px, transparent 1px);
    background-size: 80px 80px, 40px 40px;
  }

  /* Shadows */
  .shadow-sun { box-shadow: 0 0 0 8px rgba(253, 216, 53, 0.3); }
  .shadow-moon { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.1); }
  .shadow-island { box-shadow: inset -15px -5px 0 #f57c00; }
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

  /* Hover effects */
  .wallpaper-card:hover .label { opacity: 0; }
`;

export default AdventureCard;
