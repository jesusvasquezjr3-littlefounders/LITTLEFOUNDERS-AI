import { API_URL } from "@/config/api";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BankingDashboard } from "@/components/banking/BankingDashboard";
import { BankingActions } from "@/components/banking/BankingActions";
import { TransactionHistory } from "@/components/banking/TransactionHistory";
import { FamilyBanking } from "@/components/banking/FamilyBanking";
import { AccountStatement } from "@/components/banking/AccountStatement";
import { BankingLoadingScreen } from "@/components/ui/LoadingScreen";
import { 
  CreditCard, 
  Home,
  History,
  Users,
  FileText,
  AlertTriangle,
  Wallet
} from "lucide-react";

type ViewType = 'dashboard' | 'history' | 'family' | 'statement' | 'settings';
type ActionType = 'transfer' | 'save' | 'deposit' | 'withdraw' | null;

const DigitalBanking = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [user, setUser] = useState<any>(null);
  const [bankingActivated, setBankingActivated] = useState<boolean>(false);
  const [childrenWithoutCards, setChildrenWithoutCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Verificar estado de banca
  useEffect(() => {
    const checkBankingStatus = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/virtual-cards/status/${user.id}?t=${Date.now()}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (user.user_type === 'child') {
            setBankingActivated(data.banking_activated || false);
          } else if (user.user_type === 'tutor' || user.user_type === 'sponsor') {
            setBankingActivated(true); // Tutores siempre tienen acceso
            const childrenWithoutCard = data.children?.filter((c: any) => !c.banking_activated) || [];
            setChildrenWithoutCards(childrenWithoutCard);
          }
        } else {
          if (user.user_type === 'child') {
            setBankingActivated(false);
          } else {
            setBankingActivated(true);
          }
        }
      } catch (error) {
        console.error('Error checking banking status:', error);
        if (user.user_type !== 'child') {
          setBankingActivated(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      checkBankingStatus();
    }
  }, [user]);

  // Escuchar eventos de activación
  useEffect(() => {
    const handleActivation = () => {
      if (user?.id) {
        fetch(`${API_URL}/virtual-cards/status/${user.id}?t=${Date.now()}`)
          .then(res => res.json())
          .then(data => {
            if (user.user_type === 'child') {
              setBankingActivated(data.banking_activated || false);
            } else {
              const childrenWithoutCard = data.children?.filter((c: any) => !c.banking_activated) || [];
              setChildrenWithoutCards(childrenWithoutCard);
            }
          })
          .catch(console.error);
      }
    };

    window.addEventListener('virtualCardActivated', handleActivation);
    return () => window.removeEventListener('virtualCardActivated', handleActivation);
  }, [user]);

  const isChild = user?.user_type === 'child';
  const isAdult = user?.user_type === 'tutor' || user?.user_type === 'sponsor';

  // Manejar acciones
  const handleAction = (action: string) => {
    if (action === 'history') {
      setActiveView('history');
    } else {
      setActiveAction(action as ActionType);
    }
  };

  // Pantalla de carga
  if (isLoading) {
    return (
      <DashboardLayout>
        <BankingLoadingScreen />
      </DashboardLayout>
    );
  }

  // Si es niño sin banca activada
  if (isChild && !bankingActivated) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                <CreditCard className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold">Banca Digital</h2>
              <p className="text-muted-foreground">
                Tu banca digital aún no está activada. Pide a tu tutor o patrocinador que active tu tarjeta virtual.
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Verificar Estado
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="h-8 w-8 text-primary" />
              Banca Digital
            </h1>
            <p className="text-muted-foreground mt-1">
              {isChild 
                ? "Administra tu dinero, ahorra y aprende sobre finanzas"
                : "Gestiona las finanzas familiares y supervisa las cuentas"
              }
            </p>
          </div>

          {/* Alerta para tutores con hijos sin tarjeta */}
          {isAdult && childrenWithoutCards.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">
                    {childrenWithoutCards.length === 1 
                      ? '1 hijo sin tarjeta' 
                      : `${childrenWithoutCards.length} hijos sin tarjeta`
                    }
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  onClick={() => setActiveView('family')}
                >
                  Activar
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Navegación */}
        <div className="border-b">
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
            {isAdult && (
              <NavButton 
                active={activeView === 'family'} 
                onClick={() => setActiveView('family')}
                icon={<Users className="h-4 w-4" />}
                label="Familia"
                badge={childrenWithoutCards.length > 0 ? childrenWithoutCards.length : undefined}
              />
            )}
            <NavButton 
              active={activeView === 'statement'} 
              onClick={() => setActiveView('statement')}
              icon={<FileText className="h-4 w-4" />}
              label="Estado de Cuenta"
            />
          </nav>
        </div>

        {/* Contenido Principal */}
        <div className="min-h-[60vh]">
          {activeView === 'dashboard' && (
            <BankingDashboard onAction={handleAction} />
          )}

          {activeView === 'history' && (
            <TransactionHistory onBack={() => setActiveView('dashboard')} />
          )}

          {activeView === 'family' && isAdult && (
            <FamilyBanking onBack={() => setActiveView('dashboard')} />
          )}

          {activeView === 'statement' && (
            <AccountStatement />
          )}
        </div>

        {/* Modal de Acciones */}
        <BankingActions 
          action={activeAction}
          onClose={() => setActiveAction(null)}
          onSuccess={() => {
            // Refrescar datos después de una acción exitosa
            window.dispatchEvent(new Event('bankingDataUpdated'));
          }}
        />
      </div>
    </DashboardLayout>
  );
};

// Componente de navegación
interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function NavButton({ active, onClick, icon, label, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
        border-b-2 -mb-px
        ${active 
          ? 'border-primary text-primary' 
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

export default DigitalBanking;
