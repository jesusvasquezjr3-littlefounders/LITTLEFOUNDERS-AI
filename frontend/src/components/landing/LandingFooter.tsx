import React from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LandingFooterProps {
    hideCTA?: boolean;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ hideCTA = false }) => {
    const { t } = useTranslation('landing');

    // We keep the CTA word rotation here just for the bottom CTA (optional)
    const [ctaWordIndex, setCtaWordIndex] = React.useState(0);
    const ctaWords = (t('cta.rotating_words', { returnObjects: true }) as string[]) || ["founder"];

    React.useEffect(() => {
        if (hideCTA) return;
        const wordInterval = setInterval(() => {
            setCtaWordIndex((prev) => (prev + 1) % ctaWords.length);
        }, 4000);
        return () => clearInterval(wordInterval);
    }, [ctaWords.length, hideCTA]);

    return (
        <>
            {/* --- CTA / FOOTER --- */}
            {!hideCTA && (
                <section className="py-24 bg-white dark:bg-slate-950 text-center transition-colors duration-500">
                    <div className="max-w-3xl mx-auto px-4">
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-8 transition-colors">
                            {t('cta.title_part1')} <br />
                            <span className="inline-block relative">
                                <span key={ctaWordIndex} className="animate-fade-in-up inline-block text-pink-600 dark:text-pink-400">
                                    {ctaWords[ctaWordIndex]}.
                                </span>
                            </span>
                        </h2>
                        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto transition-colors">
                            {t('cta.subtitle')}
                        </p>
                        <Button asChild size="lg" className="px-12 py-8 text-2xl rounded-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-2xl hover:shadow-pink-500/25 transition-all transform hover:scale-105">
                            <Link to="/register">
                                {t('cta.button')}
                            </Link>
                        </Button>
                        <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">{t('cta.disclaimer')}</p>
                    </div>
                </section>
            )}

            <footer className="bg-gray-900 dark:bg-black border-t border-gray-800 dark:border-slate-800 py-12 transition-colors duration-500">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <Link to="/" className="flex items-center gap-2 opacity-80 grayscale hover:grayscale-0 transition-all">
                        <img src="/logo-sized.png" alt="LittleFounders" className="h-8 w-auto object-contain dark:invert dark:brightness-200" />
                    </Link>
                    <div className="flex items-center gap-6">
                        <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
                            <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.terms')}</Link>
                            <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.privacy')}</Link>
                            <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.contact')}</Link>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400 dark:text-gray-600">
                        {t('footer.copyright')}
                    </div>
                </div>
            </footer>
        </>
    );
};
