import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const LandingParentCTA: React.FC = () => {
    const { t } = useTranslation('landing');

    return (
        <section className="py-24 bg-white dark:bg-slate-950 text-center transition-colors duration-500">
            <div className="max-w-4xl mx-auto px-4 relative">
                {/* Decorative glows */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-pink-400/20 dark:bg-pink-900/20 rounded-full blur-[80px] pointer-events-none -z-10"></div>
                <div className="absolute top-1/2 left-[30%] -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-purple-400/20 dark:bg-purple-900/20 rounded-full blur-[80px] pointer-events-none -z-10"></div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 text-sm font-bold mb-6">
                    {t('cta_parents.disclaimer')}
                </div>

                <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-8 transition-colors leading-tight">
                    {t('cta_parents.title')}
                </h2>
                
                <p className="text-base md:text-lg lg:text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto transition-colors">
                    {t('cta_parents.subtitle')}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-5 justify-center">
                    <Button asChild size="lg" className="h-16 px-10 text-xl rounded-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-xl hover:shadow-pink-500/25 transition-all transform hover:scale-105 w-full sm:w-auto">
                        <Link to="/onboarding">
                            <span className="flex items-center font-bold">
                                {t('cta_parents.button')}
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    </Button>

                    <Button asChild variant="ghost" size="lg" className="h-16 px-10 text-xl rounded-full border-2 border-gray-200 dark:border-slate-800 bg-transparent hover:bg-gray-50 dark:hover:bg-slate-900 transition-all transform hover:scale-105 w-full sm:w-auto">
                        <Link to="/login" className="font-bold text-gray-700 dark:text-gray-300">
                            {t('cta_parents.login_link')}
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
};
