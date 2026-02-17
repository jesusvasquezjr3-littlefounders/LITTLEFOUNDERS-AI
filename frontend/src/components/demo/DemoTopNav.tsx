import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTranslation } from "react-i18next";

export function DemoTopNav() {
    const { t } = useTranslation('demo');

    return (
        <header className="relative flex items-center justify-end px-6 py-3 bg-card border-b border-border">
            {/* Centered Logo - Hidden on mobile to prevent overlap */}
            <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <img
                    src="/logo-sized.png"
                    alt="LittleFounders"
                    className="h-8 w-auto object-contain"
                />
            </div>


            {/* Right Section */}
            <div className="flex items-center space-x-4">
                <ThemeToggle />
                <Button asChild variant="ghost">
                    <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                    <Link to="/register">{t('nav.register')}</Link>
                </Button>
            </div>
        </header>
    );
}
