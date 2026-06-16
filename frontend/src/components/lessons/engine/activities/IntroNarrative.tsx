import { useTranslation } from 'react-i18next';
import { QuestButton } from '../ui/QuestButton';
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
                        className="w-44 sm:w-60 md:w-72 mx-auto"
                        expression="happy"
                        isTalking={isAudioPlaying}
                    />
                );
            case 'dr_rho':
                return (
                    <DrRhoCharacter
                        className="w-44 sm:w-60 md:w-72 mx-auto"
                        mood="wise"
                        isTalking={isAudioPlaying}
                    />
                );
            case 'zara_vex':
                return (
                    <ZaraVexCharacter
                        className="w-44 sm:w-60 md:w-72 mx-auto"
                        mood="happy"
                        isTalking={isAudioPlaying}
                    />
                );
            default:
                return (
                    <DinoCharacter
                        className="w-44 sm:w-60 md:w-72 mx-auto"
                        showBubble={false}
                        mood="excited"
                        isTalking={isAudioPlaying}
                    />
                );
        }
    };

    return (
        <div className="w-full max-w-lg flex flex-col items-center gap-5 sm:gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
            {/* Character */}
            <div className="flex-shrink-0 lp-bob">
                {renderCharacter()}
            </div>

            {/* Speech Bubble with Narrative */}
            <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
                <div className="lp-card relative px-6 py-5 max-w-md">
                    <p className="lp-display text-center text-lg sm:text-xl leading-snug" style={{ color: 'var(--lp-ink)' }}>
                        {narrativeText}
                    </p>
                    {/* Speech bubble arrow */}
                    <div
                        className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
                        style={{ background: 'var(--lp-surface)', borderLeft: '1.5px solid var(--lp-line)', borderTop: '1.5px solid var(--lp-line)' }}
                    />
                </div>
            </div>

            {/* Audio indicator */}
            {isAudioPlaying && (
                <div className="flex items-center justify-center gap-2" style={{ color: 'var(--lp-muted)' }}>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--lp-amber)' }} />
                    <span className="lp-display text-sm">{t('status.speaking')}</span>
                </div>
            )}

            {/* Continue Button */}
            <QuestButton variant="brand" onClick={onNext} disabled={isAudioPlaying}>
                {t('actions.continue')}
            </QuestButton>
        </div>
    );
};
