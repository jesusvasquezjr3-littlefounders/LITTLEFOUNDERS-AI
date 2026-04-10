import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

export const LandingNavbar = () => {
    const { t } = useTranslation('landing');
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        // Initial check
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { path: '/', label: 'LittleFounders' },
        { path: '/families', label: t('nav.families') },
        { path: '/faq', label: t('nav.faq') },
        { path: '/pricing', label: t('nav.pricing') },
    ];

    const isCurrent = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <>
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled || mobileMenuOpen
                ? 'liquid-glass-subtle py-3'
                : 'bg-transparent py-5'
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <img src="/logo-sized.png" alt="LittleFounders" className="h-10 w-auto object-contain dark:brightness-110" />
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/families" className={`font-medium transition-colors ${isCurrent('/families') ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400'}`}>{t('nav.families')}</Link>
                            <Link to="/faq" className={`font-medium transition-colors ${isCurrent('/faq') ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400'}`}>{t('nav.faq')}</Link>
                            <Link to="/pricing" className={`font-medium transition-colors ${isCurrent('/pricing') ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400'}`}>{t('nav.pricing')}</Link>

                            <div className="flex items-center gap-2 ml-4">
                                <ThemeToggle />
                                <LanguageSelector variant="simple" />
                            </div>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button className="md:hidden text-gray-700 dark:text-gray-200" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-xl">
                        <Link to="/families" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('nav.families')}</Link>
                        <Link to="/faq" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('nav.faq')}</Link>
                        <Link to="/pricing" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('nav.pricing')}</Link>

                        <div className="flex flex-col gap-3 mt-2">
                            <div className="flex items-center justify-center py-2 gap-4">
                                <ThemeToggle />
                                <LanguageSelector variant="simple" />
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
};
