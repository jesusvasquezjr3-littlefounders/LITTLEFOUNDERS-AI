import React, { useRef, useEffect } from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { ShowreelPlayer } from '@/components/showreel/ShowreelPlayer';
import { useTranslation, Trans } from 'react-i18next';

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


    return (
        <LandingLayout>
            <div className="relative min-h-[calc(100vh-80px)] pt-24 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-cyan-50/50 via-white to-purple-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-700 overflow-hidden">
                
                {/* Ultra Ambient Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                    <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-900/10 rounded-full blur-[100px] animate-float opacity-70"></div>
                    <div className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] bg-pink-400/10 dark:bg-pink-900/10 rounded-full blur-[120px] animate-float opacity-70" style={{ animationDelay: '3s' }}></div>
                    
                    <div className="absolute top-1/4 left-10 text-pink-500/10 dark:text-pink-500/5 animate-float"><Sparkles size={60} /></div>
                    <div className="absolute top-1/2 right-12 text-blue-500/10 dark:text-blue-500/5 animate-float" style={{ animationDelay: '2s' }}><Bot size={70} /></div>
                    <div className="absolute top-3/4 right-1/4 text-purple-500/10 dark:text-purple-500/5 animate-float" style={{ animationDelay: '0.5s' }}><Globe size={50} /></div>
                </div>

                {/* Global Page Title */}
                <div className="max-w-[90rem] mx-auto text-center mb-16 space-y-6 pt-4">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white transition-colors tracking-tight">
                        {t('faq.title')}
                    </h1>
                    <div className="flex justify-center items-center gap-3">
                        <div className="h-1.5 w-8 bg-pink-500 rounded-full opacity-60"></div>
                        <div className="h-1.5 w-24 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full opacity-60"></div>
                        <div className="h-1.5 w-8 bg-purple-500 rounded-full opacity-60"></div>
                    </div>
                </div>

                <div className="max-w-[90rem] mx-auto flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                    
                    {/* Left Column: Composition (Video) */}
                    <div className="w-full lg:w-7/12 xl:w-2/3 lg:sticky lg:top-32 relative">
                        {/* Interactive Remotion Player embedded in 16:9 container */}
                        <div className="w-full aspect-video rounded-[1.5rem] bg-gray-100 dark:bg-slate-900 shadow-2xl relative border border-white/20 dark:border-white/10 group">
                            <div className="absolute inset-0 z-10 w-full h-full rounded-[1.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
                            <ShowreelPlayer playerRef={playerRef} />
                        </div>
                    </div>

                    {/* Right Column: FAQ Content */}
                    <div className="w-full lg:w-5/12 xl:w-1/3 flex flex-col lg:pt-0">
                        <Accordion type="single" collapsible className="w-full space-y-4">
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
            </div>
        </LandingLayout>
    );
}
