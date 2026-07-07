import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { hasSession } from "@/lib/guestProfile";

export const LandingNavbar = () => {
    const { t } = useTranslation('landing');
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const session = hasSession();
    const ctaTo = session ? "/learn" : "/login";
    const ctaLabel = session ? t('nav.resume') : t('nav.register');

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 16);
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (mobileMenuOpen) {
            setIsMenuVisible(true);
        } else {
            const timer = setTimeout(() => setIsMenuVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [mobileMenuOpen]);

    const navLinks = [
        { path: '/how-it-works', label: t('nav.how') },
        { path: '/families', label: t('nav.families') },
        { path: '/pricing', label: t('nav.pricing') },
        { path: '/faq', label: t('nav.faq') },
    ];

    const isCurrent = (path: string) => location.pathname.startsWith(path);
    const showSolid = isScrolled || mobileMenuOpen;

    return (
        <nav
            className={`corp fixed top-0 w-full z-50 py-5 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ease-out ${
                showSolid
                    ? 'bg-white/85 dark:bg-[#0a0e1a]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 shadow-[0_4px_30px_-12px_rgba(15,23,42,0.15)]'
                    : 'bg-transparent border-b border-transparent'
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 shrink-0"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <img
                            src="/logo-sized.png"
                            alt="LittleFounders — Educación financiera para niños"
                            className="h-9 w-auto object-contain dark:brightness-110"
                        />
                    </Link>

                    <div className="hidden lg:flex items-center gap-7">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`relative corp-caption font-semibold transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:rounded-md ${
                                    isCurrent(link.path)
                                        ? 'text-indigo-600 dark:text-indigo-300'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300'
                                }`}
                            >
                                {link.label}
                                {isCurrent(link.path) && (
                                    <span className="absolute -bottom-1 left-0 right-0 h-px bg-indigo-500 dark:bg-indigo-400 rounded-full animate-content-enter" />
                                )}
                            </Link>
                        ))}
                    </div>

                    <div className="hidden lg:flex items-center gap-3">
                        <ThemeToggle />
                        <LanguageSelector variant="simple" />
                        <Link
                            to={ctaTo}
                            className="corp-btn-primary inline-flex items-center gap-2 corp-body-sm font-semibold rounded-full px-6 py-2.5"
                        >
                            {ctaLabel}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="flex lg:hidden items-center gap-2">
                        <ThemeToggle />
                        <LanguageSelector variant="simple" />
                        <button
                            className="text-slate-700 dark:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.97] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label={mobileMenuOpen ? t('nav.close_menu') : t('nav.open_menu')}
                            aria-expanded={mobileMenuOpen}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuVisible && (
                <div
                    ref={menuRef}
                    className="lg:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0a0e1a] border-b border-slate-200 dark:border-white/10 p-4 flex flex-col gap-1 shadow-xl"
                    style={{
                        opacity: mobileMenuOpen ? 1 : 0,
                        transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-6px)',
                        transition: 'opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                >
                    {navLinks.map((link, i) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className="corp-body font-medium py-3 border-b border-slate-100 dark:border-white/5 transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-300 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                            style={{
                                opacity: mobileMenuOpen ? 1 : 0,
                                transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-6px)',
                                transition: `opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1) ${40 + i * 40}ms, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1) ${40 + i * 40}ms`,
                            }}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="flex flex-col gap-2 mt-3" style={{
                        opacity: mobileMenuOpen ? 1 : 0,
                        transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(4px)',
                        transition: `opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1) ${40 + navLinks.length * 40}ms, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1) ${40 + navLinks.length * 40}ms`,
                    }}>
                        <Link
                            to={ctaTo}
                            className="corp-btn-primary text-center corp-body-sm font-semibold py-3 rounded-xl"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {ctaLabel}
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
};
