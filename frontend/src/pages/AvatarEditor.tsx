import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ArrowLeft, Shuffle, Save, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

// Avatar option categories with their correct DiceBear values
const AVATAR_OPTIONS = {
    top: {
        label: 'Cabello',
        icon: '💇',
        values: ['bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads', 'dreads01', 'dreads02',
            'frida', 'fro', 'froBand', 'frizzle', 'longButNotTooLong', 'miaWallace',
            'shaggy', 'shaggyMullet', 'shavedSides', 'shortCurly', 'shortFlat',
            'shortRound', 'shortWaved', 'sides', 'straight01', 'straight02',
            'straightAndStrand', 'theCaesar', 'theCaesarAndSidePart',
            'hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04']
    },
    hairColor: {
        label: 'Color Cabello',
        icon: '🎨',
        values: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'e8e1e1', 'ecdcbf',
            'c93305', 'b45f06', 'f1c27d', 'ffdbac']
    },
    eyes: {
        label: 'Ojos',
        icon: '👀',
        values: ['default', 'closed', 'cry', 'xDizzy', 'eyeRoll', 'happy', 'hearts', 'side',
            'squint', 'surprised', 'wink', 'winkWacky']
    },
    eyebrows: {
        label: 'Cejas',
        icon: '🤨',
        values: ['default', 'defaultNatural', 'angry', 'angryNatural', 'flatNatural',
            'raisedExcited', 'raisedExcitedNatural', 'sadConcerned', 'sadConcernedNatural',
            'unibrowNatural', 'upDown', 'upDownNatural', 'frownNatural']
    },
    mouth: {
        label: 'Boca',
        icon: '👄',
        values: ['default', 'concerned', 'disbelief', 'eating', 'grimace', 'sad', 'screamOpen',
            'serious', 'smile', 'tongue', 'twinkle', 'vomit']
    },
    skinColor: {
        label: 'Piel',
        icon: '✋',
        values: ['614335', 'ae5d29', 'd08b5b', 'edb98a', 'f8d25c', 'ffdbb4', 'fd9841', 'ffdbac']
    },
    clothing: {
        label: 'Ropa',
        icon: '👕',
        values: ['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'graphicShirt', 'hoodie',
            'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck']
    },
    clothesColor: {
        label: 'Color Ropa',
        icon: '🌈',
        values: ['3c4f5c', '65c9ff', '262e33', 'e6e6e6', '929598', 'a7ffc4', 'b1e2ff',
            'ffdeb5', 'ffafb9', 'ffffb1', 'ff488e', '5199e4', '25557c', 'ff5c5c']
    },
    clothingGraphic: {
        label: 'Diseño',
        icon: '🎨',
        values: ['bat', 'bear', 'cumbia', 'deer', 'diamond', 'hola', 'pizza', 'resist', 'skull', 'skullOutline']
    },
    accessories: {
        label: 'Accesorios',
        icon: '🕶️',
        values: ['none', 'kurt', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers', 'eyepatch']
    },
    accessoriesColor: {
        label: 'Color Lentes',
        icon: '👓',
        values: ['262e33', '65c9ff', '929598', 'a7ffc4', 'b1e2ff', 'e6e6e6', 'ff488e', 'ffafb9']
    },
    facialHair: {
        label: 'Barba',
        icon: '🧔',
        values: ['none', 'beardLight', 'beardMajestic', 'beardMedium', 'moustacheFancy', 'moustacheMagnum']
    },
    facialHairColor: {
        label: 'Color Barba',
        icon: '🧔‍♂️',
        values: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'e8e1e1', 'ecdcbf']
    },
    hatColor: {
        label: 'Color Gorro',
        icon: '🎩',
        values: ['262e33', '3c4f5c', '65c9ff', '929598', 'a7ffc4', 'b1e2ff', 'e6e6e6', 'ff488e', 'ffafb9', 'ffffb1']
    },
    backgroundColor: {
        label: 'Fondo',
        icon: '🖼️',
        // Expanded palette: Pastels, Vibrants, Darks
        values: [
            'none',
            // Pastels
            'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'e1f7d5', 'fff5b1', 'd4ffea',
            // Vibrants
            '65c9ff', '5199e4', '25557c', 'ff5c5c', 'ff488e', '9333ea', 'eab308', '22c55e',
            // Darks/Neutrals
            '1e293b', '334155', '475569', 'f8fafc'
        ]
    }
};

// Generate a random avatar config
const generateRandomConfig = () => {
    const config: Record<string, string[]> = {};
    Object.entries(AVATAR_OPTIONS).forEach(([key, opt]) => {
        const randomValue = opt.values[Math.floor(Math.random() * opt.values.length)];
        config[key] = [randomValue];
    });
    return config;
};

const AvatarEditor = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useTranslation(['avatar', 'common']);
    const { playSound } = useSound();

    const [config, setConfig] = useState<Record<string, string[]>>(() => {
        // Try to load existing config from user data
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.avatar_config) {
                    return user.avatar_config;
                }
            }
        } catch (e) { }
        // Generate random if no existing config
        return generateRandomConfig();
    });

    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('top');

    // Generate avatar SVG with probability settings for accessories/facial hair
    const avatarSvg = useMemo(() => {
        const avatarConfig: Record<string, any> = {
            size: 256,
            ...config,
            // Enable accessories if selected and not 'none'
            accessoriesProbability: config.accessories?.[0] && config.accessories[0] !== 'none' ? 100 : 0,
            // Enable facial hair if selected and not 'none'
            facialHairProbability: config.facialHair?.[0] && config.facialHair[0] !== 'none' ? 100 : 0,
        };

        // Remove backgroundColor if 'none'
        if (config.backgroundColor?.[0] === 'none') {
            delete avatarConfig.backgroundColor;
        }

        const avatar = createAvatar(avataaars, avatarConfig as any);
        return avatar.toDataUri();
    }, [config]);

    // Update a single option
    const updateOption = (key: string, value: string) => {
        playSound('ui_tap');

        setConfig(prev => {
            const newConfig = {
                ...prev,
                [key]: [value]
            };

            // Auto-switch to graphicShirt if selecting a clothingGraphic
            if (key === 'clothingGraphic' && prev.clothing?.[0] !== 'graphicShirt') {
                newConfig.clothing = ['graphicShirt'];

                toast({
                    title: t('avatar:notifications.graphic_shirt_title'),
                    description: t('avatar:notifications.graphic_shirt_desc'),
                    className: 'bg-blue-50 text-blue-800 border-blue-200',
                    duration: 3000
                });
            }

            return newConfig;
        });
    };

    // Randomize all options
    const handleRandomize = () => {
        playSound('ui_tap');
        setConfig(generateRandomConfig());
    };

    // Save avatar to backend
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const rawToken = localStorage.getItem('token');
            if (!rawToken) {
                throw new Error('No token found');
            }
            // Remove extra quotes if present
            const token = rawToken.replace(/"/g, '');

            const response = await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ avatar_config: config })
            });

            if (response.status === 401) {
                // Session expired or invalid token
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                toast({
                    title: t('avatar:notifications.session_expired'),
                    description: t('avatar:notifications.session_expired_desc'),
                    variant: 'destructive'
                });
                navigate('/login');
                return;
            }

            if (response.ok) {
                const updatedUser = await response.json();
                // Update localStorage
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const newUser = { ...currentUser, avatar_config: config };
                localStorage.setItem('user', JSON.stringify(newUser));

                playSound('auth_success');
                toast({
                    title: t('avatar:notifications.saved_title'),
                    description: t('avatar:notifications.saved_desc'),
                    className: "bg-green-50 border-green-200 text-green-800"
                });

                navigate('/profile');
            } else {
                throw new Error('Failed to save avatar');
            }
        } catch (error) {
            console.error(error);
            playSound('auth_error');
            toast({
                title: t('avatar:notifications.save_error_title'),
                description: t('avatar:notifications.save_error_desc'),
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto pb-8 space-y-6 animate-in fade-in duration-500">

                {/* Header with Save Button */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/profile')}
                            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Button>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {t('avatar:title')}
                        </h1>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full md:w-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('avatar:actions.saving')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('avatar:actions.save')}
                            </>
                        )}
                    </Button>
                </div>

                {/* Avatar Preview */}
                <GlassPanel variant="default" className="border-0 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 shadow-lg">
                    <CardContent className="flex flex-col items-center py-8">
                        <div className="relative">
                            <div
                                className="absolute -inset-2 rounded-full blur-lg opacity-50 animate-pulse transition-colors duration-500"
                                style={{
                                    background: config.backgroundColor?.[0] && config.backgroundColor[0] !== 'none'
                                        ? `#${config.backgroundColor[0]}`
                                        : 'linear-gradient(to right, #ec4899, #9333ea)' // pink-500 to purple-600
                                }}
                            />
                            <img
                                src={avatarSvg}
                                alt="Tu Avatar"
                                className="relative w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-white shadow-2xl"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleRandomize}
                            className="mt-6 gap-2 rounded-full border-2 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                        >
                            <Shuffle className="w-4 h-4" />
                            {t('avatar:actions.randomize')}
                        </Button>
                    </CardContent>
                </GlassPanel>

                {/* Duolingo-style Category Selector - Horizontal scroll on ALL devices */}
                <div className="w-full relative group">
                    {/* Gradient masks for scroll indication */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-950 to-transparent z-10 pointer-events-none md:hidden" />
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-950 to-transparent z-10 pointer-events-none md:hidden" />

                    <div className="w-full overflow-x-auto py-4 px-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <div className="flex gap-3 px-2 min-w-max mx-auto">
                            {Object.entries(AVATAR_OPTIONS).map(([key, opt], index) => {
                                const isActive = activeTab === key;
                                // Different gradient colors for each category
                                const gradients = [
                                    'from-pink-400 to-pink-600',
                                    'from-amber-400 to-orange-500',
                                    'from-sky-400 to-blue-500',
                                    'from-yellow-400 to-amber-500',
                                    'from-rose-400 to-red-500',
                                    'from-orange-300 to-orange-500',
                                    'from-indigo-400 to-purple-500',
                                    'from-emerald-400 to-teal-500',
                                    'from-violet-400 to-purple-600',
                                    'from-slate-400 to-slate-600',
                                    'from-cyan-400 to-cyan-600',
                                    'from-lime-400 to-green-500',
                                    'from-fuchsia-400 to-fuchsia-600',
                                    'from-red-400 to-rose-500',
                                    'from-teal-400 to-teal-600'
                                ];
                                const gradient = gradients[index % gradients.length];

                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            playSound('ui_tap');
                                            setActiveTab(key);
                                        }}
                                        className={`
                                        flex flex-col items-center justify-center gap-1.5 transition-all duration-200 flex-shrink-0
                                        ${isActive ? 'scale-110' : 'opacity-50 hover:opacity-100'}
                                    `}
                                    >
                                        <div className={`
                                        w-14 h-14 md:w-16 md:h-16 rounded-2xl 
                                        flex items-center justify-center
                                        shadow-lg transition-all duration-200
                                        ${isActive
                                                ? `bg-gradient-to-br ${gradient} ring-4 ring-white dark:ring-slate-700 shadow-xl`
                                                : 'bg-slate-200 dark:bg-slate-700'
                                            }
                                    `}>
                                            <span className="text-2xl md:text-3xl leading-none">
                                                {opt.icon}
                                            </span>
                                        </div>
                                        <span className={`
                                        text-[10px] md:text-xs font-bold whitespace-nowrap
                                        ${isActive ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}
                                    `}>
                                            {t(`avatar:categories.${key}`)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Options Grid - Larger items on mobile */}
                <GlassPanel variant="strong" className="border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl">
                    <CardContent className="p-3 md:p-6">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                            {AVATAR_OPTIONS[activeTab as keyof typeof AVATAR_OPTIONS]?.values.map((value) => {
                                const isSelected = config[activeTab]?.[0] === value;
                                const isColor = activeTab.toLowerCase().includes('color');

                                return (
                                    <button
                                        key={value}
                                        onClick={() => updateOption(activeTab, value)}
                                        className={`
                                            relative aspect-square rounded-2xl border-3 transition-all duration-200 overflow-hidden
                                            ${isSelected
                                                ? 'border-purple-500 ring-4 ring-purple-300/50 scale-105 shadow-lg'
                                                : 'border-slate-200 dark:border-slate-600 hover:border-purple-300 hover:scale-102'
                                            }
                                            ${isColor ? '' : 'p-0.5 bg-slate-50 dark:bg-slate-700'}
                                        `}
                                    >
                                        {isColor ? (
                                            value === 'none' ? (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                    <span className="text-2xl">🚫</span>
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-full h-full rounded-xl"
                                                    style={{ backgroundColor: `#${value}` }}
                                                />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img
                                                    src={createAvatar(avataaars, {
                                                        size: 80,
                                                        ...config,
                                                        [activeTab]: [value],
                                                        // Enable accessories/facial hair for preview (but not if 'none')
                                                        accessoriesProbability: (activeTab === 'accessories' && value !== 'none') || (config.accessories?.[0] && config.accessories[0] !== 'none') ? 100 : 0,
                                                        facialHairProbability: (activeTab === 'facialHair' && value !== 'none') || (config.facialHair?.[0] && config.facialHair[0] !== 'none') ? 100 : 0,
                                                    } as any).toDataUri()}
                                                    alt={value}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </GlassPanel>

            </div>
        </DashboardLayout>
    );
};

export default AvatarEditor;
