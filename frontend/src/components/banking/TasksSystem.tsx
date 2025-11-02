import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  Camera,
  Image,
  X
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
  photoEvidence?: string; // URL de la foto como evidencia
}

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
    dueDate: "2024-01-16"
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
    approvalDate: "2024-01-15"
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
    completedDate: "2024-01-14"
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
    isFirstDibs: true,
    dueDate: "2024-01-17"
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
     isApproved: null
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
     completedDate: "2024-01-16"
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

export function TasksSystem() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'completed' | 'pending'>('available');
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [selectedTaskForPhoto, setSelectedTaskForPhoto] = useState<Task | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Cargar tareas del backend
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setIsLoading(true);
        
        // Obtener usuario del localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.error('No user found in localStorage');
          setTasks(mockTasks); // Fallback a datos mock
          return;
        }
        
        const user = JSON.parse(userStr);
        
        // Cargar tareas desde el backend
        const response = await fetch(`http://localhost:8000/tasks/available/${user.id}`);
        
        if (!response.ok) {
          throw new Error('Error loading tasks');
        }
        
        const data = await response.json();
        
        // Formatear tareas para el componente
        const formattedTasks: Task[] = data.tasks.map((t: any) => ({
          id: t.id.toString(),
          title: t.title,
          description: t.description,
          category: t.category,
          difficulty: t.difficulty,
          reward: t.reward,
          timeEstimate: t.time_estimate || 30,
          isCompleted: t.is_completed,
          isApproved: t.is_approved,
          completedDate: t.completed_date,
          isFirstDibs: t.is_first_dibs,
          photoEvidence: t.photo_evidence
        }));
        
        setTasks(formattedTasks);
        console.log('✅ Tareas cargadas:', formattedTasks.length);
        
      } catch (error) {
        console.error('Error al cargar tareas:', error);
        // Fallback a datos mock en caso de error
        setTasks(mockTasks);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTasks();
  }, []); // Solo cargar una vez al montar el componente

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskForPhoto(task);
      setIsPhotoDialogOpen(true);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTaskWithPhoto = () => {
    if (!selectedTaskForPhoto) return;

    // En un entorno real, aquí subirías la foto al servidor
    // Por ahora, usamos la preview como URL (si existe)
    const photoUrl = photoPreview || undefined;

    setTasks(tasks.map(task => 
      task.id === selectedTaskForPhoto.id 
        ? { 
            ...task, 
            isCompleted: true, 
            completedDate: new Date().toISOString().split('T')[0],
            photoEvidence: photoUrl
          }
        : task
    ));

    // Limpiar el estado
    setPhotoFile(null);
    setPhotoPreview('');
    setSelectedTaskForPhoto(null);
    setIsPhotoDialogOpen(false);
  };

  const handleCancelPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setSelectedTaskForPhoto(null);
    setIsPhotoDialogOpen(false);
  };

  const availableTasks = tasks.filter(task => !task.isCompleted);
  const completedTasks = tasks.filter(task => task.isCompleted && task.isApproved === true);
  const pendingTasks = tasks.filter(task => task.isCompleted && task.isApproved === null);

  const totalEarningsThisWeek = completedTasks.reduce((sum, task) => sum + task.reward, 0);
  const tasksCompletedThisWeek = completedTasks.length;

  const renderTask = (task: Task, showCompleteButton: boolean = false) => {
    const CategoryIcon = categoryIcons[task.category];
    const isReassigned = task.isCompleted && task.isApproved === false;
    
    return (
      <Card key={task.id} className={`relative ${
        task.isFirstDibs ? 'border-yellow-300 bg-yellow-50' : 
        isReassigned ? 'border-blue-300 bg-blue-50' : ''
      }`}>
        {task.isFirstDibs && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center">
                         <Zap className="h-3 w-3 mr-1" />
             ¡Importante!
          </div>
        )}
        {isReassigned && (
          <div className="absolute -top-2 -right-2 bg-blue-400 text-blue-800 text-xs font-bold px-2 py-1 rounded-full flex items-center">
            <RefreshCw className="h-3 w-3 mr-1" />
            Reasignada
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
                    task.isApproved === false ? 'text-blue-600' : 
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
          
          {task.dueDate && (
            <div className="text-sm text-muted-foreground mb-3">
              <strong>Fecha límite:</strong> {new Date(task.dueDate).toLocaleDateString('es-ES')}
            </div>
          )}

                     {task.isCompleted && (
             <div className="space-y-2 mb-4">
               <div className="text-sm">
                 <strong>Completada el:</strong> {task.completedDate ? new Date(task.completedDate).toLocaleDateString('es-ES') : 'N/A'}
               </div>
                               {task.photoEvidence && (
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-2 flex items-center">
                      <Image className="h-4 w-4 mr-1" />
                      Evidencia fotográfica (opcional):
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
               {task.isApproved === false && (
                 <div className="text-sm text-blue-600">
                   <strong>Estado:</strong> Tarea reasignada
                 </div>
               )}
               {task.isApproved === null && (
                 <div className="text-sm text-yellow-600">
                   <strong>Estado:</strong> Esperando aprobación de los padres
                 </div>
               )}
             </div>
           )}

          {showCompleteButton && !task.isCompleted && (
            <Button 
              onClick={() => handleCompleteTask(task.id)}
              className="w-full"
              size="sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como Completada
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {availableTasks.length}
                </div>
                <div className="text-sm text-muted-foreground">Tareas disponibles</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress This Week */}
      <Card>
        <CardHeader>
          <CardTitle>Progreso de la Semana</CardTitle>
          <CardDescription>Meta: completar 5 tareas esta semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{tasksCompletedThisWeek} de 5 tareas</span>
              <span>{Math.round((tasksCompletedThisWeek / 5) * 100)}%</span>
            </div>
            <Progress value={(tasksCompletedThisWeek / 5) * 100} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Task Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'available' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('available')}
        >
          Disponibles ({availableTasks.length})
        </Button>
        <Button
          variant={activeTab === 'pending' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pending')}
        >
          Pendientes ({pendingTasks.length})
        </Button>
        <Button
          variant={activeTab === 'completed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('completed')}
        >
          Completadas ({completedTasks.length})
        </Button>
      </div>

      {/* Task Lists */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="text-center py-8">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Cargando tareas...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTab === 'available' && (
              <>
                <h3 className="text-lg font-semibold">Tareas Disponibles</h3>
                {availableTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTasks.map(task => renderTask(task, true))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">¡No hay tareas disponibles ahora mismo!</p>
                  <p className="text-sm text-muted-foreground">Revisa más tarde para nuevas oportunidades.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          <>
            <h3 className="text-lg font-semibold">Esperando Aprobación</h3>
            {pendingTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingTasks.map(task => renderTask(task))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay tareas esperando aprobación</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <h3 className="text-lg font-semibold">Tareas Completadas</h3>
            {completedTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedTasks.map(task => renderTask(task))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aún no has completado ninguna tarea</p>
                  <p className="text-sm text-muted-foreground">¡Comienza completando las tareas disponibles!</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
          </>
        )}
      </div>

       {/* Modal para subir foto de evidencia */}
       <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
         <DialogContent className="sm:max-w-[500px]">
           <DialogHeader>
             <DialogTitle className="flex items-center">
               <Camera className="h-5 w-5 mr-2" />
               Agregar evidencia fotográfica
             </DialogTitle>
                           <DialogDescription>
                Opcionalmente, puedes tomar una foto o subir una imagen para demostrar que completaste la tarea "{selectedTaskForPhoto?.title}"
              </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4 py-4">
                           <div className="space-y-2">
                <Label htmlFor="photo-upload">Seleccionar foto (opcional)</Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceptados: JPG, PNG, GIF. Tamaño máximo: 5MB. La foto es opcional.
                </p>
              </div>

             {photoPreview && (
               <div className="space-y-2">
                 <Label>Vista previa:</Label>
                 <div className="relative">
                   <img 
                     src={photoPreview} 
                     alt="Vista previa"
                     className="w-full h-48 object-cover rounded-lg border"
                   />
                   <Button
                     variant="outline"
                     size="sm"
                     className="absolute top-2 right-2"
                     onClick={() => {
                       setPhotoFile(null);
                       setPhotoPreview('');
                     }}
                   >
                     <X className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
             )}
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={handleCancelPhoto}>
               Cancelar
             </Button>
                           <Button 
                onClick={handleSubmitTaskWithPhoto}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar Tarea
              </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }




