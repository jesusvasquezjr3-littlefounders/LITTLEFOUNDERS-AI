import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface IntroNarrativeProps {
    onNext: () => void;
    isAudioPlaying: boolean;
}

export const IntroNarrative = ({ onNext, isAudioPlaying }: IntroNarrativeProps) => {
    const { t } = useTranslation('lessons');

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom">
            {isAudioPlaying && (
                <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{t('status.speaking')}</span>
                </div>
            )}

            <Button
                onClick={onNext}
                disabled={isAudioPlaying}
                className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
            >
                {t('actions.continue')}
            </Button>
        </div>
    );
};
