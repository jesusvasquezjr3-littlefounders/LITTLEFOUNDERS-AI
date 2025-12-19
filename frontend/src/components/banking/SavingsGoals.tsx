import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SavingsLoadingScreen } from "@/components/ui/LoadingScreen";
import { 
  PiggyBank, 
  Target,
  Trophy,
  Gift,
  Bike,
  Gamepad2,
  BookOpen,
  Plus,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  Users
} from "lucide-react";

interface SavingsGoal {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  category: 'toy' | 'education' | 'experience' | 'electronics' | 'other';
  deadline?: string;
  isCompleted: boolean;
  parentMatchPercentage?: number;
  roundUpEnabled: boolean;
  createdDate: string;
  completedDate?: string;
  imageUrl?: string;
  createdBy?: number;
  assignedTo?: number;
  userId?: number;
  userName?: string; // Nombre del usuario propietario de la meta
  createdByName?: string;
  assignedToName?: string;
}

interface Child {
  id: number;
  name: string;
  email: string;
}

const mockSavingsGoals: SavingsGoal[] = [
  {
    id: "1",
    title: "Nintendo Switch",
    description: "Ahorrar para comprar una Nintendo Switch nueva",
    targetAmount: 300,
    currentAmount: 125.50,
    category: "electronics",
    deadline: "2024-06-15",
    isCompleted: false,
    parentMatchPercentage: 25,
    roundUpEnabled: true,
    createdDate: "2024-01-01"
  },
  {
    id: "2",
    title: "Bicicleta Nueva",
    description: "Una bicicleta de montaña para aventuras",
    targetAmount: 200,
    currentAmount: 200,
    category: "toy",
    deadline: "2024-03-01",
    isCompleted: true,
    parentMatchPercentage: 50,
    roundUpEnabled: false,
    createdDate: "2023-12-01",
    completedDate: "2024-02-28"
  },
  {
    id: "3",
    title: "Curso de Programación",
    description: "Curso online de programación para niños",
    targetAmount: 150,
    currentAmount: 45.25,
    category: "education",
    deadline: "2024-04-30",
    isCompleted: false,
    parentMatchPercentage: 100,
    roundUpEnabled: true,
    createdDate: "2024-01-10"
  }
];

const categoryIcons = {
  toy: Gift,
  education: BookOpen,
  experience: Trophy,
  electronics: Gamepad2,
  other: Target
};

const categoryColors = {
  toy: "bg-pink-100 text-pink-700",
  education: "bg-green-100 text-green-700",
  experience: "bg-purple-100 text-purple-700",
  electronics: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-700"
};

export function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [userType, setUserType] = useState<string>("");
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    targetAmount: "",
    category: "other" as SavingsGoal['category'],
    deadline: "",
    parentMatchPercentage: "0",
    roundUpEnabled: false,
    assignedTo: "self"
  });

  // Función para cargar metas de ahorro
  const loadGoals = async () => {
    try {
      setIsLoading(true);
      
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        console.error('No user found in localStorage');
        setGoals(mockSavingsGoals); // Fallback
        return;
      }
      
      const user = JSON.parse(userStr);
      setUserType(user.user_type);
      
      // If user is tutor, load children
      if (user.user_type === 'tutor') {
        const childrenResponse = await fetch(
          `http://localhost:8000/savings/children/${user.id}`
        );
        if (childrenResponse.ok) {
          const childrenData = await childrenResponse.json();
          setChildren(childrenData.children || []);
        }
      }
      
      const response = await fetch(
        `http://localhost:8000/savings/goals/${user.id}?requester_id=${user.id}&t=${Date.now()}`
      );
      
      if (!response.ok) {
        throw new Error('Error loading savings goals');
      }
      
      const data = await response.json();
      
      // Formatear goals para el componente
      const formattedGoals: SavingsGoal[] = data.map((g: any) => ({
        id: g.id.toString(),
        title: g.title,
        description: g.description || '',
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        category: g.category || 'other',
        deadline: g.deadline,
        isCompleted: g.current_amount >= g.target_amount,
        parentMatchPercentage: g.parent_match_percentage || 0,
        roundUpEnabled: g.round_up_enabled || false,
        createdDate: g.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        imageUrl: g.image_url,
        createdBy: g.created_by,
        assignedTo: g.assigned_to,
        userId: g.user_id,
        userName: g.user_name
      }));
      
      setGoals(formattedGoals);
      console.log(`✅ Metas de ahorro cargadas: ${formattedGoals.length}`);
      
    } catch (error) {
      console.error('Error al cargar metas de ahorro:', error);
      setGoals(mockSavingsGoals); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar metas de ahorro y children (si es tutor) desde el backend
  useEffect(() => {
    loadGoals();
  }, []);

  // Detectar cuando el usuario regresa a la pestaña y refrescar datos
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Usuario regresó a la pestaña, refrescar datos
        console.log('🔄 Usuario regresó a la pestaña, refrescando metas...');
        loadGoals();
      }
    };

    const handleFocus = () => {
      // También refrescar cuando la ventana recibe foco
      console.log('🔄 Ventana recibió foco, refrescando metas...');
      loadGoals();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const activeGoals = goals.filter(goal => !goal.isCompleted);
  const completedGoals = goals.filter(goal => goal.isCompleted);

  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.targetAmount) {
      alert('Por favor completa el título y el monto objetivo');
      return;
    }

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('Error: Usuario no encontrado');
        return;
      }
      
      const user = JSON.parse(userStr);

      // Preparar datos para el backend
      const goalData = {
        title: newGoal.title,
        description: newGoal.description,
        target_amount: parseFloat(newGoal.targetAmount),
        category: newGoal.category,
        deadline: newGoal.deadline || null,
        image_url: null,
        parent_match_percentage: parseInt(newGoal.parentMatchPercentage) || 0,
        round_up_enabled: newGoal.roundUpEnabled,
        assigned_to: (newGoal.assignedTo && newGoal.assignedTo !== 'self') ? parseInt(newGoal.assignedTo) : null
      };

      // Enviar al backend
      const response = await fetch(
        `http://localhost:8000/savings/goals?user_id=${user.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(goalData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear la meta de ahorro');
      }

      const createdGoal = await response.json();

      // Refrescar datos desde el backend para asegurar consistencia
      console.log('✅ Meta creada exitosamente, refrescando datos...');
      await loadGoals();
      
      // Resetear formulario
      setNewGoal({
        title: "",
        description: "",
        targetAmount: "",
        category: "other",
        deadline: "",
        parentMatchPercentage: "0",
        roundUpEnabled: false,
        assignedTo: "self"
      });
      
      setIsAddingGoal(false);
      alert('✅ Meta de ahorro creada exitosamente');

    } catch (error: any) {
      console.error('Error al crear meta de ahorro:', error);
      alert(`❌ Error al crear la meta: ${error.message}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateDaysLeft = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderGoalCard = (goal: SavingsGoal) => {
    const CategoryIcon = categoryIcons[goal.category];
    const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
    const parentMatch = goal.parentMatchPercentage ? (goal.currentAmount * goal.parentMatchPercentage) / 100 : 0;
    const totalWithMatch = goal.currentAmount + parentMatch;
    const daysLeft = goal.deadline ? calculateDaysLeft(goal.deadline) : null;
    
    // Get user info to check ownership
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const isOwnGoal = currentUser && goal.userId === currentUser.id;
    const wasAssigned = goal.assignedTo && goal.createdBy !== goal.userId;
    
    return (
      <Card key={goal.id} className={`relative ${goal.isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
        {goal.isCompleted && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2">
            <Trophy className="h-4 w-4" />
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center space-x-2">
                <CategoryIcon className="h-5 w-5" />
                <span>{goal.title}</span>
                {goal.isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
              </CardTitle>
              <CardDescription>
                {goal.description}
                {userType === 'tutor' && goal.userName && (
                  <div className="mt-1 text-sm text-blue-600 font-medium">
                    Meta de: {goal.userName}
                  </div>
                )}
              </CardDescription>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={categoryColors[goal.category]}>
                  {goal.category === 'toy' ? 'Juguete' :
                   goal.category === 'education' ? 'Educación' :
                   goal.category === 'experience' ? 'Experiencia' :
                   goal.category === 'electronics' ? 'Electrónicos' : 'Otro'}
                </Badge>
                {goal.roundUpEnabled && (
                  <Badge variant="outline" className="text-xs">
                    Redondeo activo
                  </Badge>
                )}
                {!isOwnGoal && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Meta de hijo
                  </Badge>
                )}
                {wasAssigned && (
                  <Badge variant="outline" className="text-xs bg-blue-50">
                    Asignada por tutor
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(goal.currentAmount)}
              </div>
              <div className="text-sm text-muted-foreground">
                de {formatCurrency(goal.targetAmount)}
              </div>
              {goal.parentMatchPercentage && goal.parentMatchPercentage > 0 && (
                <div className="text-xs text-green-600 font-medium">
                  +{formatCurrency(parentMatch)} coincidencia parental
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso</span>
                <span>{progressPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              {goal.parentMatchPercentage && goal.parentMatchPercentage > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Con coincidencia parental ({goal.parentMatchPercentage}%)</span>
                    <span>{formatCurrency(totalWithMatch)}</span>
                  </div>
                  <Progress 
                    value={(totalWithMatch / goal.targetAmount) * 100} 
                    className="h-2"
                  />
                </div>
              )}
            </div>

            {/* Timeline */}
            {goal.deadline && !goal.isCompleted && (
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className={`${daysLeft && daysLeft < 30 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                  {daysLeft && daysLeft > 0 ? `${daysLeft} días restantes` : 
                   daysLeft === 0 ? 'Vence hoy' : 
                   'Vencida'}
                </span>
              </div>
            )}

            {goal.isCompleted && goal.completedDate && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Completada el {new Date(goal.completedDate).toLocaleDateString('es-ES')}</span>
              </div>
            )}

            {/* Action Buttons */}
            {!goal.isCompleted && (
              <div className="flex space-x-2">
                <Button size="sm" className="flex-1">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Añadir Dinero
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ver Progreso
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Pantalla de carga mientras se cargan las metas
  if (isLoading) {
    return <SavingsLoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Goal Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mis Metas de Ahorro</h2>
          <p className="text-muted-foreground">Crea metas y ahorra para conseguir lo que quieres</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadGoals}
            disabled={isLoading}
          >
            <Target className="h-4 w-4 mr-2" />
            {isLoading ? 'Cargando...' : 'Actualizar'}
          </Button>
          <Dialog open={isAddingGoal} onOpenChange={setIsAddingGoal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Meta de Ahorro</DialogTitle>
                <DialogDescription>
                  Define tu meta y comienza a ahorrar para conseguirla
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Selector de child (solo para tutores) */}
                {userType === 'tutor' && children.length > 0 && (
                  <div>
                    <Label htmlFor="assignedTo">Asignar a (opcional)</Label>
                    <Select 
                      value={newGoal.assignedTo} 
                      onValueChange={(value) => setNewGoal({...newGoal, assignedTo: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un hijo (o déjalo vacío para ti)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Para mí</SelectItem>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id.toString()}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Si asignas a un hijo, la meta aparecerá en su cuenta
                    </p>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="title">¿Qué quieres conseguir?</Label>
                  <Input
                    id="title"
                    placeholder="Ej: Nintendo Switch, Bicicleta nueva..."
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    placeholder="Describe tu meta..."
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">¿Cuánto cuesta?</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100.00"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({...newGoal, targetAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Fecha límite para completarla (opcional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="parentMatch">¿Qué porcentaje aportará el padre?</Label>
                  <Input
                    id="parentMatch"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="25"
                    value={newGoal.parentMatchPercentage}
                    onChange={(e) => setNewGoal({...newGoal, parentMatchPercentage: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Porcentaje que los padres agregarán por cada dólar ahorrado
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddingGoal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddGoal}>
                    Crear Meta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {activeGoals.length}
                </div>
                <div className="text-sm text-muted-foreground">Metas activas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {completedGoals.length}
                </div>
                <div className="text-sm text-muted-foreground">Metas logradas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <PiggyBank className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0))}
                </div>
                <div className="text-sm text-muted-foreground">Total ahorrado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Metas Activas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeGoals.map(goal => renderGoalCard(goal))}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Metas Logradas 🎉</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {completedGoals.map(goal => renderGoalCard(goal))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeGoals.length === 0 && completedGoals.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <PiggyBank className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            {userType === 'tutor' ? (
              <>
                <h3 className="text-xl font-semibold mb-2">No hay metas de ahorro</h3>
                <p className="text-muted-foreground mb-6">
                  Tus hijos aún no han creado metas de ahorro. Puedes ayudarlos creando metas para ellos.
                </p>
                <Button onClick={() => setIsAddingGoal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Meta para Mi Hijo
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-2">¡Crea tu primera meta de ahorro!</h3>
                <p className="text-muted-foreground mb-6">
                  Establece una meta, ahorra dinero y consigue lo que más quieres
                </p>
                <Button onClick={() => setIsAddingGoal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Mi Primera Meta
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}




