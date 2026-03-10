import { DemoThemeToggle } from "./DemoThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslation } from "react-i18next";

export function DemoTopNav() {
    const { t } = useTranslation('demo');

    return (
        <header className="relative flex items-center px-4 md:px-6 py-3 bg-card/80 backdrop-blur-md border-b border-border min-h-[72px] md:min-h-[80px]">
            {/* Logo Container - Left on mobile, center on desktop */}
            <div className="relative md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10">
                <img
                    src="/logo-sized.png"
                    alt="LittleFounders"
                    className="h-8 md:h-10 w-auto object-contain transition-all duration-300"
                />
            </div>

            {/* Right Section - Theme & Language Toggles Balanced */}
            <div className="flex items-center gap-3 ml-auto z-20">
                <DemoThemeToggle className="h-10 w-10 md:h-11 md:w-11" />
                <LanguageSelector
                    variant="pill"
                    className="h-10 md:h-11 px-4 md:px-5 text-xs md:text-sm font-bold shadow-sm"
                />
            </div>
        </header>
    );
}
