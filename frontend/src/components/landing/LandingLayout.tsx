import React from "react";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";

interface LandingLayoutProps {
    children: React.ReactNode;
    hideCTA?: boolean;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({ children, hideCTA = false }) => {
    return (
        <div className="corp min-h-screen bg-white dark:bg-[#070b14] landing-page-root selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-500/40 dark:selection:text-white transition-colors duration-300">
            <LandingNavbar />
            
            <main className="view-transition-content pt-24 lg:pt-28">
                {children}
            </main>

            <LandingFooter hideCTA={hideCTA} />
        </div>
    );
};
