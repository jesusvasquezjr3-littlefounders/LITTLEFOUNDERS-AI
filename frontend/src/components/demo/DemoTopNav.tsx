import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function DemoTopNav() {
    return (
        <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
            {/* Search Placeholder - Optional, keeping layout consistent */}
            <div className="flex items-center flex-1 max-w-md">
                {/* Empty for now, or add a fake search if needed */}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
                <Button asChild variant="ghost">
                    <Link to="/login">Iniciar Sesión</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                    <Link to="/register">¡Probar Ahora!</Link>
                </Button>
            </div>
        </header>
    );
}
