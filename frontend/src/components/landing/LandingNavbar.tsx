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
            className={`corp fixed top-0 w-full z-50 py-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ${
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

                    <div className="hidden lg:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`text-sm font-medium transition-colors duration-150 ${
                                    isCurrent(link.path)
                                        ? 'text-indigo-600 dark:text-indigo-300'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <div className="hidden lg:flex items-center gap-3">
                        <ThemeToggle />
                        <LanguageSelector variant="simple" />
                        <Link
                            to={ctaTo}
                            className="corp-btn-primary inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-5 py-2.5"
                        >
                            {ctaLabel}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="flex lg:hidden items-center gap-2">
                        <ThemeToggle />
                        <LanguageSelector variant="simple" />
                        <button
                            className="text-slate-700 dark:text-slate-200 p-1"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Menu"
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuVisible && (
                <div
                    ref={menuRef}
                    className="lg:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0a0e1a] border-b border-slate-200 dark:border-white/10 p-4 flex flex-col gap-1 shadow-xl transition-[opacity,transform] duration-200 ease-out"
                    style={{
                        opacity: mobileMenuOpen ? 1 : 0,
                        transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-8px)',
                    }}
                >
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className="text-base font-medium text-slate-700 dark:text-slate-200 py-3 border-b border-slate-100 dark:border-white/5"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="flex flex-col gap-2 mt-3">
                        <Link
                            to={ctaTo}
                            className="corp-btn-primary text-center text-sm font-semibold py-3 rounded-xl"
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
