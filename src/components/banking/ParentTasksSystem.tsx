import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Trophy, 
  Clock, 
  Star, 
  CheckCircle, 
  Circle,
  DollarSign,
  Zap,
  Gift,
  Users,
  Home,
  BookOpen,
  Utensils,
  Plus,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Target,
  TrendingUp,
  Award,
  Activity,
  RefreshCw,
  Image
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  category: 'chores' | 'education' | 'social' | 'bonus';
  difficulty: 'easy' | 'medium' | 'hard';
  reward: number;
  timeEstimate: number; // in minutes
  isCompleted: boolean;
  isApproved: boolean | null;
  dueDate?: string;
  isFirstDibs?: boolean;
  completedDate?: string;
  approvalDate?: string;
  assignedBy: string;
  assignedTo: string;
  createdAt: string;
  notes?: string;
  photoEvidence?: string; // URL de la foto como evidencia
}

interface ChildInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const mockChildren: ChildInfo[] = [
  {
    id: "child001",
    name: "Carlos González",
    email: "nino@demo.com"
  }
];

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Lavar los platos",
    description: "Lavar todos los platos después de la cena",
    category: "chores",
    difficulty: "easy",
    reward: 5.00,
    timeEstimate: 15,
    isCompleted: false,
    isApproved: null,
    dueDate: "2024-01-16",
    assignedBy: "tutor@demo.com",
    assignedTo: "nino@demo.com",
    createdAt: "2024-01-10"
  },
  {
    id: "2",
    title: "Completar lección de matemáticas",
    description: "Terminar los ejercicios de fracciones del capítulo 3",
    category: "education",
    difficulty: "medium",
    reward: 10.00,
    timeEstimate: 30,
    isCompleted: true,
    isApproved: true,
    completedDate: "2024-01-15",
    approvalDate: "2024-01-15",
    assignedBy: "tutor@demo.com",
    assignedTo: "nino@demo.com",
    createdAt: "2024-01-08"
  },
  {
    id: "3",
    title: "Organizar mi cuarto",
    description: "Ordenar la ropa, hacer la cama y limpiar el escritorio",
    category: "chores",
    difficulty: "medium",
    reward: 8.00,
    timeEstimate: 25,
    isCompleted: true,
    isApproved: false,
    completedDate: "2024-01-14",
    assignedBy: "tutor@demo.com",
    assignedTo: "nino@demo.com",
    createdAt: "2024-01-07",
    notes: "La cama no está bien hecha y hay ropa en el suelo"
  },
     {
     id: "4",
     title: "¡Importante!: Ayudar a mamá con las compras",
     description: "Acompañar a mamá al supermercado y ayudar con las bolsas",
    category: "bonus",
    difficulty: "easy",
    reward: 15.00,
    timeEstimate: 60,
    isCompleted: false,
    isApproved: null,
    dueDate: "2024-01-17",
    isFirstDibs: true,
    assignedBy: "tutor@demo.com",
    assignedTo: "nino@demo.com",
    createdAt: "2024-01-12"
  },
     {
     id: "5",
     title: "Leer 20 páginas del libro",
     description: "Continuar con la lectura del libro 'El Principito'",
     category: "education",
     difficulty: "easy",
     reward: 6.00,
     timeEstimate: 40,
     isCompleted: false,
     isApproved: null,
     assignedBy: "tutor@demo.com",
     assignedTo: "nino@demo.com",
     createdAt: "2024-01-09"
   },
   {
     id: "6",
     title: "Hacer la tarea de ciencias",
     description: "Completar el experimento de plantas y escribir el reporte",
     category: "education",
     difficulty: "medium",
     reward: 12.00,
     timeEstimate: 45,
     isCompleted: true,
     isApproved: null,
     completedDate: "2024-01-16",
     assignedBy: "tutor@demo.com",
     assignedTo: "nino@demo.com",
     createdAt: "2024-01-13"
   }
];

const categoryIcons = {
  chores: Home,
  education: BookOpen,
  social: Users,
  bonus: Gift
};

const categoryColors = {
  chores: "bg-blue-100 text-blue-700",
  education: "bg-green-100 text-green-700",
  social: "bg-purple-100 text-purple-700",
  bonus: "bg-yellow-100 text-yellow-700"
};

const difficultyColors = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700"
};

interface ParentTasksSystemProps {
  user: any;
}

export function ParentTasksSystem({ user }: ParentTasksSystemProps) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [children, setChildren] = useState<ChildInfo[]>(mockChildren);
  const [activeTab, setActiveTab] = useState<'assigned' | 'pending' | 'completed' | 'rejected'>('assigned');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'chores' as const,
    difficulty: 'easy' as const,
    reward: 5.00,
    timeEstimate: 15,
    dueDate: '',
    assignedTo: '',
    isFirstDibs: false
  });

  const assignedTasks = tasks.filter(task => !task.isCompleted);
  const pendingTasks = tasks.filter(task => task.isCompleted && task.isApproved === null);
  const completedTasks = tasks.filter(task => task.isCompleted && task.isApproved === true);
  const rejectedTasks = tasks.filter(task => task.isCompleted && task.isApproved === false);

  const totalEarningsThisWeek = completedTasks.reduce((sum, task) => sum + task.reward, 0);
  const tasksCompletedThisWeek = completedTasks.length;
  const tasksPendingApproval = pendingTasks.length;

  const handleCreateTask = () => {
    // Validaciones básicas
    if (!newTask.title.trim()) {
      alert('Por favor ingresa un título para la tarea');
      return;
    }
    if (!newTask.description.trim()) {
      alert('Por favor ingresa una descripción para la tarea');
      return;
    }
    if (!newTask.assignedTo) {
      alert('Por favor selecciona a quién asignar la tarea');
      return;
    }
    if (newTask.reward <= 0) {
      alert('La recompensa debe ser mayor a $0');
      return;
    }
    if (newTask.timeEstimate <= 0) {
      alert('El tiempo estimado debe ser mayor a 0 minutos');
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      isCompleted: false,
      isApproved: null,
      assignedBy: user.email,
      createdAt: new Date().toISOString().split('T')[0]
    };
    
    setTasks([...tasks, task]);
    setNewTask({
      title: '',
      description: '',
      category: 'chores',
      difficulty: 'easy',
      reward: 5.00,
      timeEstimate: 15,
      dueDate: '',
      assignedTo: '',
      isFirstDibs: false
    });
    setIsCreateDialogOpen(false);
  };

  const handleApproveTask = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { ...task, isApproved: true, approvalDate: new Date().toISOString().split('T')[0] }
        : task
    ));
  };

  const handleRejectTask = (taskId: string, notes: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { ...task, isApproved: false, notes }
        : task
    ));
    setRejectNotes('');
    setIsRejectDialogOpen(false);
  };

  const handleReassignTask = (taskId: string, notes: string) => {
    const originalTask = tasks.find(task => task.id === taskId);
    if (!originalTask) return;

    // Crear una nueva tarea basada en la original pero con el comentario de rechazo
    const newReassignedTask: Task = {
      ...originalTask,
      id: Date.now().toString(),
      isCompleted: false,
      isApproved: null,
      completedDate: undefined,
      approvalDate: undefined,
      createdAt: new Date().toISOString().split('T')[0],
      notes: notes ? `Reasignada - Motivo anterior: ${notes}` : 'Reasignada'
    };

    setTasks([...tasks, newReassignedTask]);
    setReassignNotes('');
    setIsReassignDialogOpen(false);
  };

  const openRejectDialog = (task: Task) => {
    setSelectedTask(task);
    setIsRejectDialogOpen(true);
  };

  const openReassignDialog = (task: Task) => {
    setSelectedTask(task);
    setReassignNotes(task.notes || '');
    setIsReassignDialogOpen(true);
  };

  const handleEditTask = () => {
    if (!selectedTask) return;
    
    setTasks(tasks.map(task => 
      task.id === selectedTask.id 
        ? { ...selectedTask, ...newTask }
        : task
    ));
    setIsEditDialogOpen(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setNewTask({
      title: task.title,
      description: task.description,
      category: task.category,
      difficulty: task.difficulty,
      reward: task.reward,
      timeEstimate: task.timeEstimate,
      dueDate: task.dueDate || '',
      assignedTo: task.assignedTo,
      isFirstDibs: task.isFirstDibs || false
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (task: Task) => {
    setSelectedTask(task);
    setIsViewDialogOpen(true);
  };

  const renderTask = (task: Task, showActions: boolean = false) => {
    const CategoryIcon = categoryIcons[task.category];
    
    return (
      <Card key={task.id} className={`relative ${task.isFirstDibs ? 'border-yellow-300 bg-yellow-50' : ''}`}>
        {task.isFirstDibs && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center">
                         <Zap className="h-3 w-3 mr-1" />
             ¡Importante!
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg flex items-center space-x-2">
                <CategoryIcon className="h-5 w-5" />
                <span>{task.title}</span>
                {task.isCompleted && (
                  <CheckCircle className={`h-5 w-5 ${
                    task.isApproved === true ? 'text-green-600' : 
                    task.isApproved === false ? 'text-red-600' : 
                    'text-yellow-600'
                  }`} />
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge className={categoryColors[task.category]}>
                  {task.category === 'chores' ? 'Tareas del hogar' :
                   task.category === 'education' ? 'Educación' :
                   task.category === 'social' ? 'Social' : 'Bonus'}
                </Badge>
                <Badge className={difficultyColors[task.difficulty]}>
                  {task.difficulty === 'easy' ? 'Fácil' :
                   task.difficulty === 'medium' ? 'Medio' : 'Difícil'}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600 flex items-center">
                <DollarSign className="h-5 w-5" />
                {task.reward.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {task.timeEstimate} min
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            {task.description}
          </CardDescription>
          
          <div className="space-y-2 mb-4">
            <div className="text-sm text-muted-foreground">
              <strong>Asignada a:</strong> {children.find(c => c.email === task.assignedTo)?.name || task.assignedTo}
            </div>
            {task.dueDate && (
              <div className="text-sm text-muted-foreground">
                <strong>Fecha límite:</strong> {new Date(task.dueDate).toLocaleDateString('es-ES')}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <strong>Creada:</strong> {new Date(task.createdAt).toLocaleDateString('es-ES')}
            </div>
          </div>

                     {task.isCompleted && (
             <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
               <div className="text-sm">
                 <strong>Completada el:</strong> {task.completedDate ? new Date(task.completedDate).toLocaleDateString('es-ES') : 'N/A'}
               </div>
               {task.photoEvidence && (
                 <div className="mt-3">
                   <div className="text-sm font-medium mb-2 flex items-center">
                     <Image className="h-4 w-4 mr-1" />
                     Evidencia fotográfica:
                   </div>
                   <div className="relative">
                     <img 
                       src={task.photoEvidence} 
                       alt="Evidencia de tarea completada"
                       className="w-full h-32 object-cover rounded-lg border"
                     />
                   </div>
                 </div>
               )}
               {task.isApproved === true && task.approvalDate && (
                 <div className="text-sm text-green-600">
                   <strong>Aprobada el:</strong> {new Date(task.approvalDate).toLocaleDateString('es-ES')}
                 </div>
               )}
               {task.isApproved === false && task.notes && (
                 <div className="text-sm text-red-600">
                   <strong>Rechazada:</strong> {task.notes}
                 </div>
               )}
               {task.isApproved === null && (
                 <div className="text-sm text-yellow-600">
                   <strong>Estado:</strong> Esperando tu aprobación
                 </div>
               )}
             </div>
           )}

          {showActions && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openViewDialog(task)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              {!task.isCompleted && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openEditDialog(task)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </>
              )}
                             {task.isCompleted && task.isApproved === null && (
                 <div className="flex space-x-2">
                   <Button 
                     size="sm"
                     onClick={() => handleApproveTask(task.id)}
                     className="bg-green-600 hover:bg-green-700"
                   >
                     <Check className="h-4 w-4 mr-1" />
                     Aprobar
                   </Button>
                   <Button 
                     variant="destructive" 
                     size="sm"
                     onClick={() => openRejectDialog(task)}
                   >
                     <X className="h-4 w-4 mr-1" />
                     Rechazar
                   </Button>
                 </div>
               )}
               {task.isCompleted && task.isApproved === false && (
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={() => openReassignDialog(task)}
                   className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                 >
                   <RefreshCw className="h-4 w-4 mr-1" />
                   Reasignar
                 </Button>
               )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${totalEarningsThisWeek.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Ganado esta semana</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {tasksCompletedThisWeek}
                </div>
                <div className="text-sm text-muted-foreground">Tareas completadas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {tasksPendingApproval}
                </div>
                <div className="text-sm text-muted-foreground">Pendientes de aprobación</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {assignedTasks.length}
                </div>
                <div className="text-sm text-muted-foreground">Tareas asignadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header con botón de crear tarea */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Tareas</h2>
          <p className="text-muted-foreground">
            Asigna tareas y supervisa el progreso de los niños
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Tarea</DialogTitle>
              <DialogDescription>
                Asigna una nueva tarea para que el niño la complete
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título de la tarea</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Ej: Lavar los platos"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Asignar a</Label>
                  <Select value={newTask.assignedTo} onValueChange={(value) => setNewTask({...newTask, assignedTo: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar niño" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((child) => (
                        <SelectItem key={child.id} value={child.email}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Describe detalladamente qué debe hacer el niño..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={newTask.category} onValueChange={(value: any) => setNewTask({...newTask, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chores">Tareas del hogar</SelectItem>
                      <SelectItem value="education">Educación</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Dificultad</Label>
                  <Select value={newTask.difficulty} onValueChange={(value: any) => setNewTask({...newTask, difficulty: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Fácil</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="hard">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeEstimate">Tiempo estimado (min)</Label>
                  <Input
                    id="timeEstimate"
                    type="number"
                    value={newTask.timeEstimate}
                    onChange={(e) => setNewTask({...newTask, timeEstimate: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reward">Recompensa ($)</Label>
                  <Input
                    id="reward"
                    type="number"
                    step="0.01"
                    value={newTask.reward}
                    onChange={(e) => setNewTask({...newTask, reward: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fecha límite</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isFirstDibs"
                  checked={newTask.isFirstDibs}
                  onChange={(e) => setNewTask({...newTask, isFirstDibs: e.target.checked})}
                />
                                 <Label htmlFor="isFirstDibs">¡Importante! (prioridad alta)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTask}>
                Crear Tarea
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Task Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assigned">
            Asignadas ({assignedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendientes ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completadas ({completedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rechazadas ({rejectedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="space-y-4">
          <h3 className="text-lg font-semibold">Tareas Asignadas</h3>
          {assignedTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedTasks.map(task => renderTask(task, true))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No hay tareas asignadas</p>
                <p className="text-sm text-muted-foreground">Crea una nueva tarea para comenzar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <h3 className="text-lg font-semibold">Esperando Aprobación</h3>
          {pendingTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTasks.map(task => renderTask(task, true))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No hay tareas esperando aprobación</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <h3 className="text-lg font-semibold">Tareas Completadas</h3>
          {completedTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedTasks.map(task => renderTask(task, true))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Aún no hay tareas completadas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <h3 className="text-lg font-semibold">Tareas Rechazadas</h3>
          {rejectedTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejectedTasks.map(task => renderTask(task, true))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <X className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No hay tareas rechazadas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para editar tarea */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la tarea
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título de la tarea</Label>
                <Input
                  id="edit-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-assignedTo">Asignar a</Label>
                <Select value={newTask.assignedTo} onValueChange={(value) => setNewTask({...newTask, assignedTo: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.email}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select value={newTask.category} onValueChange={(value: any) => setNewTask({...newTask, category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chores">Tareas del hogar</SelectItem>
                    <SelectItem value="education">Educación</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-difficulty">Dificultad</Label>
                <Select value={newTask.difficulty} onValueChange={(value: any) => setNewTask({...newTask, difficulty: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Medio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-timeEstimate">Tiempo estimado (min)</Label>
                <Input
                  id="edit-timeEstimate"
                  type="number"
                  value={newTask.timeEstimate}
                  onChange={(e) => setNewTask({...newTask, timeEstimate: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-reward">Recompensa ($)</Label>
                <Input
                  id="edit-reward"
                  type="number"
                  step="0.01"
                  value={newTask.reward}
                  onChange={(e) => setNewTask({...newTask, reward: parseFloat(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dueDate">Fecha límite</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isFirstDibs"
                checked={newTask.isFirstDibs}
                onChange={(e) => setNewTask({...newTask, isFirstDibs: e.target.checked})}
              />
                               <Label htmlFor="edit-isFirstDibs">¡Importante! (prioridad alta)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditTask}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver detalles de tarea */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalles de la Tarea</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                <p className="text-muted-foreground">{selectedTask.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Categoría:</strong> {selectedTask.category}
                </div>
                <div>
                  <strong>Dificultad:</strong> {selectedTask.difficulty}
                </div>
                <div>
                  <strong>Recompensa:</strong> ${selectedTask.reward.toFixed(2)}
                </div>
                <div>
                  <strong>Tiempo estimado:</strong> {selectedTask.timeEstimate} min
                </div>
                <div>
                  <strong>Asignada a:</strong> {children.find(c => c.email === selectedTask.assignedTo)?.name || selectedTask.assignedTo}
                </div>
                <div>
                  <strong>Creada:</strong> {new Date(selectedTask.createdAt).toLocaleDateString('es-ES')}
                </div>
                {selectedTask.dueDate && (
                  <div>
                    <strong>Fecha límite:</strong> {new Date(selectedTask.dueDate).toLocaleDateString('es-ES')}
                  </div>
                )}
                                 {selectedTask.isFirstDibs && (
                   <div>
                     <strong>Tipo:</strong> ¡Importante!
                   </div>
                 )}
              </div>
              {selectedTask.isCompleted && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Estado de Completado</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Completada el:</strong> {selectedTask.completedDate ? new Date(selectedTask.completedDate).toLocaleDateString('es-ES') : 'N/A'}
                    </div>
                    {selectedTask.isApproved === true && selectedTask.approvalDate && (
                      <div className="text-green-600">
                        <strong>Aprobada el:</strong> {new Date(selectedTask.approvalDate).toLocaleDateString('es-ES')}
                      </div>
                    )}
                    {selectedTask.isApproved === false && selectedTask.notes && (
                      <div className="text-red-600">
                        <strong>Rechazada:</strong> {selectedTask.notes}
                      </div>
                    )}
                    {selectedTask.isApproved === null && (
                      <div className="text-yellow-600">
                        <strong>Estado:</strong> Esperando aprobación
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
                     </DialogFooter>
         </DialogContent>
       </Dialog>

               {/* Dialog para rechazar tarea */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Rechazar Tarea</DialogTitle>
              <DialogDescription>
                Proporciona un motivo para rechazar esta tarea. El niño podrá ver este comentario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reject-notes">Motivo del rechazo</Label>
                <Textarea
                  id="reject-notes"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explica por qué se rechaza la tarea..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (rejectNotes.trim()) {
                    handleRejectTask(selectedTask?.id || '', rejectNotes);
                  } else {
                    alert('Por favor ingresa un motivo para el rechazo');
                  }
                }}
              >
                Rechazar Tarea
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para reasignar tarea */}
        <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Reasignar Tarea</DialogTitle>
              <DialogDescription>
                Esta tarea será reasignada al niño. Puedes agregar un comentario explicando por qué se reasigna.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedTask && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Detalles de la tarea original</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Título:</strong> {selectedTask.title}</div>
                    <div><strong>Categoría:</strong> {selectedTask.category}</div>
                    <div><strong>Recompensa:</strong> ${selectedTask.reward.toFixed(2)}</div>
                    {selectedTask.notes && (
                      <div className="text-red-600">
                        <strong>Motivo del rechazo anterior:</strong> {selectedTask.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reassign-notes">Comentario para la reasignación (opcional)</Label>
                <Textarea
                  id="reassign-notes"
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="Explica por qué se reasigna la tarea o proporciona instrucciones adicionales..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  handleReassignTask(selectedTask?.id || '', reassignNotes);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reasignar Tarea
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
