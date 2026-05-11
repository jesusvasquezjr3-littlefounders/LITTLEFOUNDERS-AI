import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

interface IntroNarrativeProps {
    exercise?: any;
    onNext: () => void;
    isAudioPlaying: boolean;
}

export const IntroNarrative = ({ exercise, onNext, isAudioPlaying }: IntroNarrativeProps) => {
    const { t } = useTranslation('lessons');

    // Character code mapping - normalize all variations
    const CHARACTER_CODE_MAP: Record<string, string> = {
        'liruf': 'liruf',
        'dina': 'dina',
        'dr_rho': 'dr_rho',
        'zara_vex': 'zara_vex',
        'drrho': 'dr_rho',
        'zaravex': 'zara_vex',
        'DrRho': 'dr_rho',
        'ZaraVex': 'zara_vex',
        'dr rho': 'dr_rho',
        'zara vex': 'zara_vex'
    };

    // Get character code from exercise with normalization
    const rawCode = exercise?.character_code || 'liruf';
    const characterCode = CHARACTER_CODE_MAP[rawCode.toLowerCase().trim()] || CHARACTER_CODE_MAP[rawCode] || 'liruf';

    // Get narrative text
    const narrativeText = exercise?.content?.transcript
        || exercise?.content?.instruction
        || exercise?.content?.context
        || t('intro.welcome');

    // Render the correct character
    const renderCharacter = () => {
        switch (characterCode) {
            case 'dina':
                return (
                    <DinaCharacter
                        className="w-full max-w-[280px] mx-auto"
                        expression="happy"
                        isTalking={isAudioPlaying}
                    />
                );
            case 'dr_rho':
                return (
                    <DrRhoCharacter
                        className="w-full max-w-[280px] mx-auto"
                        mood="wise"
                        isTalking={isAudioPlaying}
                    />
                );
            case 'zara_vex':
                return (
                    <ZaraVexCharacter
                        className="w-full max-w-[280px] mx-auto"
                        mood="happy"
                        isTalking={isAudioPlaying}
                    />
                );
            default:
                return (
                    <DinoCharacter
                        className="w-full max-w-[280px] mx-auto"
                        showBubble={false}
                        mood="excited"
                        isTalking={isAudioPlaying}
                    />
                );
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center gap-6">
            {/* Character */}
            <div className="flex-shrink-0 mb-4">
                {renderCharacter()}
            </div>

            {/* Speech Bubble with Narrative */}
            <div className="w-full flex justify-center">
                <div className="relative bg-card border-2 border-border rounded-xl shadow-sm px-6 py-4 max-w-md">
                    <p className="text-center font-medium text-foreground leading-snug">
                        {narrativeText}
                    </p>
                    {/* Speech bubble arrow */}
                    <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-l-2 border-t-2 border-border rotate-45" />
                </div>
            </div>

            {/* Audio indicator */}
            {isAudioPlaying && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{t('status.speaking')}</span>
                </div>
            )}

            {/* Continue Button */}
            <Button
                onClick={onNext}
                disabled={isAudioPlaying}
                className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[0_4px_0_rgb(107,33,168)]"
            >
                <span className="relative flex items-center justify-center">{t('actions.continue')}</span>
            </Button>
        </div>
    );
};
