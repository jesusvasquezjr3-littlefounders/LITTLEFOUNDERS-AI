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

    const rawCode = exercise?.character_code || 'liruf';
    const characterCode = CHARACTER_CODE_MAP[rawCode.toLowerCase().trim()] || CHARACTER_CODE_MAP[rawCode] || 'liruf';

    const narrativeText = exercise?.content?.transcript
        || exercise?.content?.instruction
        || exercise?.content?.context
        || t('intro.welcome');

    // Size is controlled by the wrapper div — each character fills its container
    const renderCharacter = () => {
        switch (characterCode) {
            case 'dina':
                return <DinaCharacter className="w-full" expression="happy" isTalking={isAudioPlaying} />;
            case 'dr_rho':
                return <DrRhoCharacter className="w-full" mood="wise" isTalking={isAudioPlaying} />;
            case 'zara_vex':
                return <ZaraVexCharacter className="w-full" mood="happy" isTalking={isAudioPlaying} />;
            default:
                return <DinoCharacter className="w-full" showBubble={false} mood="excited" isTalking={isAudioPlaying} />;
        }
    };

    return (
        <div className="flex-1 w-full flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">

            {/* Content — fills available space and centers it vertically */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 py-4">

                {/* Character — bigger on mobile, generous on desktop */}
                <div className="flex-shrink-0 lp-bob w-56 sm:w-72 mx-auto">
                    {renderCharacter()}
                </div>

                {/* Speech bubble */}
                <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
                    <div className="bg-white rounded-[2.5rem] shadow-sm relative px-6 py-5">
                        <p className="lp-display text-center text-lg sm:text-xl leading-snug" style={{ color: 'var(--lp-ink)' }}>
                            {narrativeText}
                        </p>
                        {/* Arrow pointing UP toward character */}
                        <div
                            className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
                            style={{ background: 'var(--lp-surface)', borderLeft: '1.5px solid var(--lp-line)', borderTop: '1.5px solid var(--lp-line)' }}
                        />
                    </div>
                </div>

                {/* Audio playing indicator */}
                {isAudioPlaying && (
                    <div className="flex items-center justify-center gap-2" style={{ color: 'var(--lp-muted)' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--lp-amber)' }} />
                        <span className="lp-display text-sm">{t('status.speaking')}</span>
                    </div>
                )}
            </div>

            {/* Footer — button anchored at the bottom of the activity area */}
            <div className="w-full max-w-2xl mx-auto pb-6 pt-2">
                <QuestButton variant="go" onClick={onNext} disabled={isAudioPlaying}>
                    {t('actions.continue')}
                </QuestButton>
            </div>
        </div>
    );
};
