import React from "react";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";

interface LandingLayoutProps {
    children: React.ReactNode;
    hideCTA?: boolean;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({ children, hideCTA = false }) => {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 font-sans selection:bg-pink-100 selection:text-pink-900 dark:selection:bg-pink-900 dark:selection:text-pink-100 transition-colors duration-300">
            <LandingNavbar />
            
            <main>
                {children}
            </main>

            <LandingFooter hideCTA={hideCTA} />
        </div>
    );
};
