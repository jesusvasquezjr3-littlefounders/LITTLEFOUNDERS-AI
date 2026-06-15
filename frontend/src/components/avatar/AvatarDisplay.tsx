import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export interface AvatarConfig {
    accessories?: string[];
    accessoriesColor?: string[];
    clothing?: string[];
    clothesColor?: string[];
    eyebrows?: string[];
    eyes?: string[];
    facialHair?: string[];
    facialHairColor?: string[];
    hairColor?: string[];
    hatColor?: string[];
    mouth?: string[];
    nose?: string[];
    skinColor?: string[];
    top?: string[];
    backgroundColor?: string[];
    clothingGraphic?: string[];
}

interface AvatarDisplayProps {
    config?: AvatarConfig | null;
    size?: number;
    className?: string;
    showCTA?: boolean;
    linkToEdit?: boolean;
    includeBorder?: boolean;
}

export const AvatarDisplay = ({
    config,
    size = 128,
    className = "",
    showCTA = true,
    linkToEdit = false,
    includeBorder = true
}: AvatarDisplayProps) => {

    const { t } = useTranslation();

    const avatarSvg = useMemo(() => {
        if (!config) return null;

        const avatarConfig: Record<string, any> = {
            size,
            ...(config as any),
            // Enable accessories and facial hair if they're set and not 'none'
            accessoriesProbability: config.accessories?.[0] && config.accessories[0] !== 'none' ? 100 : 0,
            facialHairProbability: config.facialHair?.[0] && config.facialHair[0] !== 'none' ? 100 : 0,
        };

        // Remove backgroundColor if 'none'
        if (config.backgroundColor?.[0] === 'none') {
            delete avatarConfig.backgroundColor;
        }

        const avatar = createAvatar(avataaars, avatarConfig as any);
        return avatar.toDataUri();
    }, [config, size]);

    const borderClass = includeBorder ? "border-4 border-white dark:border-slate-800 shadow-xl" : "";

    const content = (
        <div className={`relative group ${className}`}>
            {avatarSvg ? (
                <img
                    src={avatarSvg}
                    alt="Avatar"
                    className={`rounded-full ${borderClass}`}
                    style={{ width: size, height: size }}
                />
            ) : (
                <div
                    className="rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl"
                    style={{ width: size, height: size }}
                >
                    <Sparkles className="w-1/3 h-1/3 text-white" />
                </div>
            )}

            {/* CTA Overlay for users without avatar */}
            {!config && showCTA && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                        {t('avatar:cta.create', '¡Crea tu Avatar!')}
                    </div>
                </div>
            )}
        </div>
    );

    if (linkToEdit) {
        return (
            <Link to="/avatar/edit" className="cursor-pointer">
                {content}
            </Link>
        );
    }

    return content;
};

export default AvatarDisplay;
