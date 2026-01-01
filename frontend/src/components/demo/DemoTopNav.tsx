import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";


export function DemoTopNav() {
    return (
        <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
            {/* Search Placeholder - Optional, keeping layout consistent */}
            <div className="flex items-center flex-1 justify-center max-w-md mx-auto">
                <ThemeToggle />
            </div>


            {/* Right Section */}
            <div className="flex items-center space-x-4">
                <Button asChild variant="ghost">
                    <Link to="/login">Iniciar Sesión</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                    <Link to="/register">¡Registrate Gratis!</Link>
                </Button>
            </div>
        </header>
    );
}
