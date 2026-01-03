import { useState } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DemoBankingDashboard } from "@/components/demo/DemoBankingDashboard";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import {
    Home,
    History,
    FileText,
    Wallet
} from "lucide-react";

type ViewType = 'dashboard' | 'history' | 'statement';

export function DemoDigitalBanking() {
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [showRegisterDialog, setShowRegisterDialog] = useState(false);
    const [dialogContext, setDialogContext] = useState({ title: "", description: "" });

    const handleRestrictedAction = (actionName: string) => {
        let title = "Funcionalidad Premium";
        let description = "Regístrate para acceder a todas las funciones de la Banca Digital.";

        switch (actionName) {
            case 'transferir':
                title = "Transferencias";
                description = "Envía dinero a tus cuentas de ahorro o a otros miembros de la familia. Regístrate para habilitar esta función.";
                break;
            case 'ahorrar':
                title = "Metas de Ahorro";
                description = "Crea metas de ahorro y separa dinero para cumplirlas. ¡Regístrate para empezar a ahorrar!";
                break;
            case 'depositar':
                title = "Depósitos";
                description = "Recibe dinero real de tus tareas y mesadas. Regístrate para conectar tu cuenta.";
                break;
            case 'historial':
                title = "Historial Completo";
                description = "Visualiza todos tus movimientos en detalle. Regístrate para mantener el control de tus finanzas.";
                break;
        }

        setDialogContext({ title, description });
        setShowRegisterDialog(true);
    };

    return (
        <DemoDashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
                            <Wallet className="h-8 w-8 text-primary" />
                            Banca Digital
                        </h1>
                        <p className="text-muted-foreground mt-1 text-gray-600 dark:text-gray-400">
                            Administra tu dinero virtual, ahorra y aprende sobre finanzas.
                        </p>
                    </div>
                </div>

                {/* Navegación - Tipo Tabs (Igual a Main App) */}
                <div className="border-b border-gray-200 dark:border-gray-800">
                    <nav className="flex space-x-1 overflow-x-auto pb-px">
                        <NavButton
                            active={activeView === 'dashboard'}
                            onClick={() => setActiveView('dashboard')}
                            icon={<Home className="h-4 w-4" />}
                            label="Inicio"
                        />
                        <NavButton
                            active={activeView === 'history'}
                            onClick={() => setActiveView('history')}
                            icon={<History className="h-4 w-4" />}
                            label="Historial"
                        />
                        <NavButton
                            active={activeView === 'statement'}
                            onClick={() => setActiveView('statement')}
                            icon={<FileText className="h-4 w-4" />}
                            label="Estado de Cuenta"
                        />
                    </nav>
                </div>

                {/* Contenido Principal */}
                <div className="min-h-[60vh] relative">
                    {activeView === 'dashboard' && (
                        <DemoBankingDashboard onRestrictedAction={handleRestrictedAction} />
                    )}

                    {activeView === 'history' && (
                        <div className="relative min-h-[400px]">
                            <DemoLockOverlay
                                title="Historial de Transacciones"
                                description="Accede al detalle histórico de todos tus ingresos y gastos. Regístrate para desbloquear tu historial completo."
                            />
                        </div>
                    )}

                    {activeView === 'statement' && (
                        <div className="relative min-h-[400px]">
                            <DemoLockOverlay
                                title="Estado de Cuenta Mensual"
                                description="Genera reportes detallados y visualiza tu crecimiento financiero mes a mes. Disponible en la versión completa."
                            />
                        </div>
                    )}
                </div>

                {/* Dialogo de Registro */}
                <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-center text-2xl">🔒 {dialogContext.title}</DialogTitle>
                            <DialogDescription className="text-center pt-4 text-lg">
                                {dialogContext.description}
                                <br /><br />
                                <strong>¡Banca Digital en Desarrollo!</strong>
                                <br />
                                Próximamente disponible de forma profesional.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
                                Seguir Explorando
                            </Button>
                            <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                                <Link to="/register">Crear Cuenta Gratis</Link>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}

// Componente de navegación (Copiado de DigitalBanking.tsx para consistencia visual)
interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`
        relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
        border-b-2 -mb-px outline-none focus:outline-none
        ${active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                }
      `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
