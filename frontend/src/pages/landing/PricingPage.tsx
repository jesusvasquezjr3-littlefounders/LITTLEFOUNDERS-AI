import React from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PricingPage() {
    const { t } = useTranslation('landing');

    // Features from i18n
    const freemiumFeatures = [
        t('pricing.freemium_feature_1'),
        t('pricing.freemium_feature_2'),
        t('pricing.freemium_feature_3'),
        t('pricing.freemium_feature_4'),
        t('pricing.freemium_feature_5'),
    ];

    return (
        <LandingLayout>
            <div className="relative min-h-screen pt-32 pb-20 px-4 bg-white dark:bg-slate-950 transition-colors duration-700 overflow-hidden">
                
                {/* Ultra Ambient Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-400/15 dark:bg-purple-900/10 rounded-full blur-[150px] animate-float opacity-70"></div>
                    <div className="absolute bottom-[-10%] left-[-15%] w-[900px] h-[900px] bg-pink-400/15 dark:bg-pink-900/10 rounded-full blur-[150px] animate-float opacity-70" style={{ animationDelay: '3s' }}></div>
                </div>

                <div className="max-w-6xl mx-auto relative">
                    <div className="text-center mb-16 space-y-4 animate-fade-in">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white transition-colors tracking-tight">
                            {t('pricing.title')}
                        </h1>
                        <p className="text-base text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed font-semibold">
                            {t('pricing.subtitle')}
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-4">
                            <div className="h-1 w-8 bg-pink-500 rounded-full opacity-50"></div>
                            <div className="h-1 w-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full opacity-50"></div>
                            <div className="h-1 w-8 bg-purple-600 rounded-full opacity-50"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-4">
                        
                        {/* Tier 1: Freemium (Active) - Ultra Glass Edition */}
                        <div className="liquid-glass p-6 lg:p-7 rounded-[2rem] border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 border-l-white/40 dark:border-l-white/10 shadow-lg relative transform transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl flex flex-col group mt-4">
                            {/* Inner Glow - Wrapped in its own overflow-hidden container if necessary, but here we can just let it bleed or clip it internally */}
                            <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                                <div className="absolute -top-12 -left-12 w-32 h-32 bg-pink-500/10 rounded-full blur-[40px] group-hover:bg-pink-500/15 transition-colors"></div>
                            </div>
                            
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 bg-[length:200%_auto] animate-gradient-x text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md whitespace-nowrap z-10 border border-white/20 backdrop-blur-md">
                                {t('pricing.freemium_badge')}
                            </div>
                            
                            <div className="mb-6 relative">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{t('pricing.freemium_title')}</h3>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{t('pricing.freemium_price')}</span>
                                    <span className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[9px] tracking-widest opacity-60">{t('pricing.freemium_period')}</span>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-semibold leading-relaxed relative">
                                {t('pricing.freemium_desc')}
                            </p>

                            <ul className="space-y-3 mb-8 flex-grow relative">
                                {freemiumFeatures.map((feat, i) => (
                                    <li key={i} className="flex items-center gap-3 group/item">
                                        <div className="w-5 h-5 rounded-lg bg-pink-100/50 dark:bg-pink-900/20 flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover/item:scale-105">
                                            <CheckCircle2 className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                        </div>
                                        <span className="text-gray-800 dark:text-gray-200 font-semibold text-sm">{feat}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button className="w-full py-4 text-base rounded-xl bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 pointer-events-none opacity-40 font-bold tracking-tight transition-all shadow-sm">
                                {t('pricing.freemium_btn')}
                            </Button>
                        </div>

                        {/* Tier 2: Ghost - Ultra Subtlety */}
                        <div className="liquid-glass-subtle p-6 lg:p-7 rounded-[2rem] border-gray-200 dark:border-slate-800/40 border-t-white/10 border-l-white/10 opacity-60 filter grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700 relative group flex flex-col hover:-translate-y-1.5 overflow-hidden shadow-sm hover:shadow-lg">
                            <div className="mb-6 relative">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{t('pricing.tier2_title')}</h3>
                                <div className="flex items-baseline gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                                    <span className="text-4xl font-black text-gray-400 tracking-tighter italic">? ? ?</span>
                                </div>
                            </div>
                            
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-gray-400/10 uppercase tracking-[0.4em] transform -rotate-[12deg] pointer-events-none group-hover:text-gray-400/5 transition-colors leading-none text-center">
                                {t('pricing.coming_soon')}
                            </div>

                            <ul className="space-y-3 mb-8 opacity-10 group-hover:opacity-100 transition-all blur-[2px] group-hover:blur-none flex-grow duration-700 relative">
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                            </ul>
                            
                            <Button variant="outline" className="w-full py-4 text-base rounded-xl border-gray-200 text-gray-400 dark:border-slate-800 pointer-events-none uppercase font-bold tracking-widest bg-transparent transition-colors">
                                {t('pricing.very_soon')}
                            </Button>
                        </div>

                        {/* Tier 3: Ghost - Ultra Institutions */}
                        <div className="liquid-glass-subtle p-6 lg:p-7 rounded-[2rem] border-gray-200 dark:border-slate-800/40 border-t-white/10 border-l-white/10 opacity-60 filter grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700 relative group flex flex-col hover:-translate-y-1.5 overflow-hidden shadow-sm hover:shadow-lg">
                            <div className="mb-6 relative">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{t('pricing.tier3_title')}</h3>
                                <div className="flex items-baseline gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                                    <span className="text-4xl font-black text-gray-400 tracking-tighter italic">! ! !</span>
                                </div>
                            </div>
                            
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-gray-400/10 uppercase tracking-[0.4em] transform -rotate-[12deg] pointer-events-none group-hover:text-gray-400/5 transition-colors leading-none text-center">
                                {t('pricing.coming_soon')}
                            </div>

                            <ul className="space-y-3 mb-8 opacity-10 group-hover:opacity-100 transition-all blur-[2px] group-hover:blur-none flex-grow duration-700 relative">
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                                <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-gray-400" /></div> <span className="text-sm font-semibold italic opacity-40">???</span></li>
                            </ul>

                            <Button variant="outline" className="w-full py-4 text-base rounded-xl border-gray-200 text-gray-400 dark:border-slate-800 pointer-events-none uppercase font-bold tracking-widest bg-transparent transition-colors">
                                {t('pricing.very_soon')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </LandingLayout>
    );
}
