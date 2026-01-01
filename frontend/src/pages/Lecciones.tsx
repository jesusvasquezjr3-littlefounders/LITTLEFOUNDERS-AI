import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import LessonPlayer from "@/components/lessons_framework/LessonPlayer"; // Use the framework player which has the path
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Calendar,
  RefreshCw,
  Trophy,
  Star
} from "lucide-react";

interface AgeRange {
  id: string;
  label: string;
  description: string;
  icon: any;
}

const Lecciones = () => {
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>("8-10");
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calcular edad del usuario automáticamente y cargar progreso
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Obtener usuario del localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.error('No user found in localStorage');
          setIsLoading(false);
          return;
        }

        const user = JSON.parse(userStr);

        // Verificar que el usuario tenga fecha de nacimiento
        if (user.birth_date) {
          const birthDate = new Date(user.birth_date);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();

          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          setUserAge(age);

          // Determinar rango de edad apropiado
          let ageRange = "8-10";
          if (age >= 0 && age <= 10) {
            ageRange = "8-10";
          } else if (age >= 11 && age <= 13) {
            ageRange = "11-13";
          } else if (age >= 14) {
            ageRange = "14-16";
          }
          setSelectedAgeRange(ageRange);
          console.log(`✅ Edad calculada: ${age} años → Rango: ${ageRange}`);
        }

        // Cargar progreso del usuario desde el backend
        try {
          const progressResponse = await fetch(
            `http://localhost:8000/lecciones/progress/${user.id}?requester_id=${user.id}`
          );

          if (progressResponse.ok) {
            const progressData = await progressResponse.json();

            // Formatear progreso para el componente
            const formattedProgress = progressData.progress.map((p: any) => ({
              lessonId: p.lesson_id?.toString(),
              score: p.progress || 0,
              completed: p.completed || false,
              completedAt: p.completed_at ? new Date(p.completed_at) : new Date(),
              timeSpent: p.time_spent || 0,
              progressData: p
            }));

            setUserProgress(formattedProgress);
          }
        } catch (progressError) {
          console.error('Error al cargar progreso:', progressError);
          setUserProgress([]);
        }

      } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const ageRanges: AgeRange[] = [
    {
      id: "8-10",
      label: "8-10 años",
      description: "Exploradores Financieros - Conceptos básicos y actividades interactivas",
      icon: Calendar
    },
    {
      id: "11-13",
      label: "11-13 años",
      description: "Administradores Junior - Conceptos intermedios y planificación",
      icon: Calendar
    },
    {
      id: "14-16",
      label: "14-16 años",
      description: "Financieros Avanzados - Planificación, crédito, inversiones y vida independiente",
      icon: Calendar
    }
  ];

  const handleProgressUpdate = async (progress: any) => {
    try {
      setUserProgress(prev => {
        const filtered = prev.filter(p => p.lessonId !== progress.lessonId);
        return [...filtered, progress];
      });

      const userStr = localStorage.getItem('user');
      if (!userStr) return;

      const user = JSON.parse(userStr);

      if (progress.completed) {
        const completeResponse = await fetch(
          `http://localhost:8000/lecciones/complete?user_id=${user.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lesson_id: parseInt(progress.lessonId),
              time_spent: Math.round(progress.timeSpent / 1000 / 60)
            }),
          }
        );

        if (completeResponse.ok) {
          const result = await completeResponse.json();
          const updatedUser = {
            ...user,
            lessons_completed: (user.lessons_completed || 0) + 1,
            points_earned: (user.points_earned || 0) + (result.points_earned || 0),
            minutes_studied: (user.minutes_studied || 0) + Math.round(progress.timeSpent / 1000 / 60)
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } else {
        await fetch(
          `http://localhost:8000/lecciones/progress/update?user_id=${user.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lesson_id: parseInt(progress.lessonId),
              progress: progress.score,
              time_spent: Math.round(progress.timeSpent / 1000 / 60)
            }),
          }
        );
      }
    } catch (error) {
      console.error('Error al actualizar progreso:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mis Lecciones</h1>

            <p className="text-gray-600 mt-2">Aprende sobre finanzas y gana recompensas</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Optional header items */}
          </div>
        </div>

        {/* Age Information & Progress */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Tu Nivel de Lecciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-600">Calculando tu edad...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Calendar className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tu edad</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userAge !== null ? `${userAge} años` : 'No disponible'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Badge className="text-sm px-4 py-2 bg-primary">
                      {ageRanges.find(r => r.id === selectedAgeRange)?.label}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-6 h-6 text-yellow-600" />
                        <span className="text-lg font-medium">Progreso General</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">
                        {userProgress.length > 0
                          ? Math.round((userProgress.filter(p => p.completed).length / (userProgress.filter(p => !p.completed).length + userProgress.filter(p => p.completed).length || 10)) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress
                      value={userProgress.length > 0 ? (userProgress.filter(p => p.completed).length / 10) * 100 : 0}
                      className="h-3"
                    />
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-green-600">
                          {userProgress.filter(p => p.completed).length}
                        </div>
                        <div className="text-gray-600">Completadas</div>
                      </div>
                      <div>
                        <div className="font-bold text-yellow-600">
                          {userProgress.reduce((total, p) => total + (p.score || 0), 0)}
                        </div>
                        <div className="text-gray-600">Puntos Totales</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">
                          {Math.round(userProgress.reduce((sum, l) => sum + (l.timeSpent || 0), 0) / 1000 / 60)}
                        </div>
                        <div className="text-gray-600">Minutos Aprendiendo</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <LessonPlayer
            ageRange={selectedAgeRange}
            onExit={() => { }} // No 'exit' really needed in the main view unless it goes back to a home
            userProgress={userProgress}
            onProgressUpdate={handleProgressUpdate}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Lecciones;
