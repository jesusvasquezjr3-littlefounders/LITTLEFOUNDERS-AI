import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Clock
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
  const [goals, setGoals] = useState<SavingsGoal[]>(mockSavingsGoals);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    targetAmount: "",
    category: "other" as SavingsGoal['category'],
    deadline: "",
    parentMatchPercentage: "0",
    roundUpEnabled: false
  });

  const activeGoals = goals.filter(goal => !goal.isCompleted);
  const completedGoals = goals.filter(goal => goal.isCompleted);

  const handleAddGoal = () => {
    if (!newGoal.title || !newGoal.targetAmount) return;

    const goal: SavingsGoal = {
      id: Date.now().toString(),
      title: newGoal.title,
      description: newGoal.description,
      targetAmount: parseFloat(newGoal.targetAmount),
      currentAmount: 0,
      category: newGoal.category,
      deadline: newGoal.deadline || undefined,
      isCompleted: false,
      parentMatchPercentage: parseInt(newGoal.parentMatchPercentage) || 0,
      roundUpEnabled: newGoal.roundUpEnabled,
      createdDate: new Date().toISOString().split('T')[0]
    };

    setGoals([...goals, goal]);
    setNewGoal({
      title: "",
      description: "",
      targetAmount: "",
      category: "other",
      deadline: "",
      parentMatchPercentage: "0",
      roundUpEnabled: false
    });
    setIsAddingGoal(false);
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
              <CardDescription>{goal.description}</CardDescription>
              <div className="flex items-center space-x-2">
                <Badge className={categoryColors[goal.category]}>
                  {goal.category === 'toy' ? 'Juguete' :
                   goal.category === 'education' ? 'Educación' :
                   goal.category === 'experience' ? 'Experiencia' :
                   goal.category === 'electronics' ? 'Electrónicos' : 'Otro'}
                </Badge>
                {goal.roundUpEnabled && (
                  <Badge variant="outline" className="text-xs">
                    Round-up activo
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
                  +{formatCurrency(parentMatch)} match parental
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
                    <span>Con match parental ({goal.parentMatchPercentage}%)</span>
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

  return (
    <div className="space-y-6">
      {/* Header with Add Goal Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mis Metas de Ahorro</h2>
          <p className="text-muted-foreground">Crea metas y ahorra para conseguir lo que quieres</p>
        </div>
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
                <Label htmlFor="deadline">Fecha límite (opcional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="parentMatch">Match parental (%)</Label>
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
            <h3 className="text-xl font-semibold mb-2">¡Crea tu primera meta de ahorro!</h3>
            <p className="text-muted-foreground mb-6">
              Establece una meta, ahorra dinero y consigue lo que más quieres
            </p>
            <Button onClick={() => setIsAddingGoal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Mi Primera Meta
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}




