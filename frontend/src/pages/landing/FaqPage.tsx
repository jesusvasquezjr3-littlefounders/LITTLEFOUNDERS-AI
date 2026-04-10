import React, { useRef, useEffect } from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { DemoShowreelPlayer } from '@/components/demo/DemoShowreelPlayer';
import { useTranslation, Trans } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown, Bot, Sparkles, Globe, ShieldCheck } from "lucide-react";

export default function FaqPage() {
    const { t } = useTranslation('landing');
    const playerRef = useRef<any>(null);
    const { playBGM, stopBGM } = useSound();

    useEffect(() => {
        // Play the same background music used in lessons for consistency
        playBGM('/sounds/edu/background.mp3', { volume: 0.2 });

        return () => {
            // Stop BGM with a fade out when leaving the demo page
            stopBGM({ fade: true, fadeDuration: 1000 });
        };
    }, [playBGM, stopBGM]);

    return (
        <LandingLayout>
            {/* 1. Full Screen Remotion Header */}
            <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-900/20 dark:to-slate-900 transition-colors duration-700">
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        /* Fill width first; height = width * 9/16 */
                        width: "100vw",
                        height: "calc(100vw * 9 / 16)",
                        /* But also ensure it fills height if screen is taller than 16:9 */
                        minHeight: "100vh",
                        minWidth: "calc(100vh * 16 / 9)",
                    }}
                >
                    <DemoShowreelPlayer playerRef={playerRef} />
                </div>
                
                {/* Scroll Indicator */}
                <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-20 animate-bounce cursor-pointer">
                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-gray-900/40 backdrop-blur-md border border-white/20 rounded-full text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        <ChevronDown className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* 2. FAQ Content */}
            <div className="relative min-h-screen pt-24 pb-20 px-4 bg-white dark:bg-slate-950 transition-colors duration-700 overflow-hidden">
                
                {/* Ultra Ambient Background Shapes - Sized Down */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                    <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-purple-400/10 dark:bg-purple-900/5 rounded-full blur-[120px] animate-float opacity-70"></div>
                    <div className="absolute bottom-[-5%] left-[-10%] w-[700px] h-[700px] bg-pink-400/10 dark:bg-pink-900/5 rounded-full blur-[120px] animate-float opacity-70" style={{ animationDelay: '3s' }}></div>
                    
                    {/* Decorative Icons Sized Down */}
                    <div className="absolute top-1/4 left-10 text-pink-500/10 dark:text-pink-500/5 animate-float"><Sparkles size={60} /></div>
                    <div className="absolute top-2/3 right-12 text-blue-500/10 dark:text-blue-500/5 animate-float" style={{ animationDelay: '2s' }}><Bot size={70} /></div>
                    <div className="absolute top-3/4 right-1/4 text-purple-500/10 dark:text-purple-500/5 animate-float" style={{ animationDelay: '0.5s' }}><Globe size={50} /></div>
                </div>

                <div className="max-w-3xl mx-auto relative">
                    <div className="text-center mb-12 space-y-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white transition-colors tracking-tight">
                            {t('faq.title')}
                        </h2>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-0.5 w-6 bg-pink-500 rounded-full opacity-40"></div>
                            <div className="h-0.5 w-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full opacity-40"></div>
                            <div className="h-0.5 w-6 bg-purple-500 rounded-full opacity-40"></div>
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-3">
                        {/* Accordion Items with Specular Edge Highlights - Refined Sizing */}
                        <AccordionItem value="item-1" className="liquid-glass border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 border-l-white/40 dark:border-l-white/10 shadow-md px-5 py-0.5 !rounded-[1.25rem] overflow-hidden group">
                            <AccordionTrigger className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 hover:no-underline transition-all group-data-[state=open]:text-pink-600 dark:group-data-[state=open]:text-pink-400 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                        <Globe size={14} />
                                    </div>
                                    {t('faq.q1')}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pb-3 mt-0.5">
                                <div className="pl-9 border-l border-pink-100 dark:border-pink-900/30 ml-3 transition-colors">
                                    <Trans i18nKey="faq.a1" ns="landing" />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-2" className="liquid-glass border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 border-l-white/40 dark:border-l-white/10 shadow-md px-5 py-0.5 !rounded-[1.25rem] overflow-hidden group">
                            <AccordionTrigger className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 hover:no-underline transition-all group-data-[state=open]:text-blue-600 dark:group-data-[state=open]:text-blue-400 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Bot size={14} />
                                    </div>
                                    {t('faq.q2')}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pb-3 mt-0.5">
                                <div className="pl-9 border-l border-blue-100 dark:border-blue-900/30 ml-3">
                                    {t('faq.a2')}
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-3" className="liquid-glass border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 border-l-white/40 dark:border-l-white/10 shadow-md px-5 py-0.5 !rounded-[1.25rem] overflow-hidden group">
                            <AccordionTrigger className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 hover:no-underline transition-all group-data-[state=open]:text-purple-600 dark:group-data-[state=open]:text-purple-400 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                        <Sparkles size={14} />
                                    </div>
                                    {t('faq.q3')}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pb-3 mt-0.5">
                                <div className="pl-9 border-l border-purple-100 dark:border-purple-900/30 ml-3">
                                    <Trans i18nKey="faq.a3" ns="landing" />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-4" className="liquid-glass border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 border-l-white/40 dark:border-l-white/10 shadow-md px-5 py-0.5 !rounded-[1.25rem] overflow-hidden group">
                            <AccordionTrigger className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 hover:no-underline transition-all group-data-[state=open]:text-green-600 dark:group-data-[state=open]:text-green-400 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                        <ShieldCheck size={14} />
                                    </div>
                                    {t('faq.q4')}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pb-3 mt-0.5">
                                <div className="pl-9 border-l border-green-100 dark:border-green-900/30 ml-3">
                                    {t('faq.a4')}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </LandingLayout>
    );
}
