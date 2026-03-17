import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  BookOpen,
  Clock,
  Star,
  TrendingUp,
  Calendar,
  Target
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProgressChartsProps {
  childData: any;
  selectedPeriod: string;
}

export function ProgressCharts({ childData, selectedPeriod }: ProgressChartsProps) {
  const { t } = useTranslation('dashboard');
  // Datos para el gráfico de línea según el período seleccionado
  const getChartData = () => {
    switch (selectedPeriod) {
      case "day":
        // Datos por horas del día
        return [
          { hour: '8:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '9:00', lecciones: 1, minutos: 15, puntos: 25 },
          { hour: '10:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '11:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '12:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '13:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '14:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '15:00', lecciones: 1, minutos: 30, puntos: 50 },
          { hour: '16:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '17:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '18:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '19:00', lecciones: 0, minutos: 0, puntos: 0 },
          { hour: '20:00', lecciones: 0, minutos: 0, puntos: 0 }
        ];
      case "week":
        // Datos por días de la semana (mantener el actual)
        return [
          { day: t('charts.days.mon'), lecciones: 2, minutos: 45, puntos: 75 },
          { day: t('charts.days.tue'), lecciones: 1, minutos: 30, puntos: 50 },
          { day: t('charts.days.wed'), lecciones: 3, minutos: 60, puntos: 100 },
          { day: t('charts.days.thu'), lecciones: 0, minutos: 0, puntos: 0 },
          { day: t('charts.days.fri'), lecciones: 2, minutos: 40, puntos: 65 },
          { day: t('charts.days.sat'), lecciones: 1, minutos: 25, puntos: 40 },
          { day: t('charts.days.sun'), lecciones: 2, minutos: 35, puntos: 55 }
        ];
      case "month":
        // Datos por días del mes (números)
        return [
          { day: '1', lecciones: 2, minutos: 45, puntos: 75 },
          { day: '2', lecciones: 1, minutos: 30, puntos: 50 },
          { day: '3', lecciones: 3, minutos: 60, puntos: 100 },
          { day: '4', lecciones: 0, minutos: 0, puntos: 0 },
          { day: '5', lecciones: 2, minutos: 40, puntos: 65 },
          { day: '6', lecciones: 1, minutos: 25, puntos: 40 },
          { day: '7', lecciones: 2, minutos: 35, puntos: 55 },
          { day: '8', lecciones: 3, minutos: 50, puntos: 80 },
          { day: '9', lecciones: 1, minutos: 20, puntos: 35 },
          { day: '10', lecciones: 2, minutos: 45, puntos: 70 },
          { day: '11', lecciones: 0, minutos: 0, puntos: 0 },
          { day: '12', lecciones: 1, minutos: 30, puntos: 45 },
          { day: '13', lecciones: 2, minutos: 40, puntos: 65 },
          { day: '14', lecciones: 3, minutos: 55, puntos: 85 },
          { day: '15', lecciones: 1, minutos: 25, puntos: 40 },
          { day: '16', lecciones: 2, minutos: 35, puntos: 55 },
          { day: '17', lecciones: 0, minutos: 0, puntos: 0 },
          { day: '18', lecciones: 1, minutos: 30, puntos: 50 },
          { day: '19', lecciones: 2, minutos: 45, puntos: 70 },
          { day: '20', lecciones: 3, minutos: 60, puntos: 90 },
          { day: '21', lecciones: 1, minutos: 25, puntos: 40 },
          { day: '22', lecciones: 2, minutos: 40, puntos: 65 },
          { day: '23', lecciones: 0, minutos: 0, puntos: 0 },
          { day: '24', lecciones: 1, minutos: 30, puntos: 50 },
          { day: '25', lecciones: 2, minutos: 45, puntos: 70 },
          { day: '26', lecciones: 3, minutos: 55, puntos: 85 },
          { day: '27', lecciones: 1, minutos: 25, puntos: 40 },
          { day: '28', lecciones: 2, minutos: 35, puntos: 55 },
          { day: '29', lecciones: 0, minutos: 0, puntos: 0 },
          { day: '30', lecciones: 1, minutos: 30, puntos: 50 }
        ];
      case "year":
        // Datos por meses del año (nombres)
        return [
          { mes: 'Enero', lecciones: 15, minutos: 320, puntos: 750 },
          { mes: 'Febrero', lecciones: 18, minutos: 380, puntos: 850 },
          { mes: 'Marzo', lecciones: 12, minutos: 250, puntos: 600 },
          { mes: 'Abril', lecciones: 20, minutos: 420, puntos: 950 },
          { mes: 'Mayo', lecciones: 16, minutos: 340, puntos: 780 },
          { mes: 'Junio', lecciones: 22, minutos: 460, puntos: 1050 },
          { mes: 'Julio', lecciones: 14, minutos: 300, puntos: 700 },
          { mes: 'Agosto', lecciones: 19, minutos: 400, puntos: 900 },
          { mes: 'Septiembre', lecciones: 17, minutos: 360, puntos: 820 },
          { mes: 'Octubre', lecciones: 21, minutos: 440, puntos: 980 },
          { mes: 'Noviembre', lecciones: 13, minutos: 280, puntos: 650 },
          { mes: 'Diciembre', lecciones: 25, minutos: 520, puntos: 1200 }
        ];
      default:
        return [];
    }
  };

  // Datos para el gráfico de barras (comparación mensual) - mantener para todos los períodos
  const monthlyData = [
    { mes: 'Ene', lecciones: 15, minutos: 320, puntos: 750 },
    { mes: 'Feb', lecciones: 18, minutos: 380, puntos: 850 },
    { mes: 'Mar', lecciones: 12, minutos: 250, puntos: 600 },
    { mes: 'Abr', lecciones: 20, minutos: 420, puntos: 950 },
    { mes: 'May', lecciones: 16, minutos: 340, puntos: 780 },
    { mes: 'Jun', lecciones: 22, minutos: 460, puntos: 1050 }
  ];

  // Datos para el gráfico de pastel (distribución de logros)
  const achievementsData = [
    { name: 'Completados', value: childData?.achievements_unlocked || 8, color: '#10b981' },
    { name: 'Pendientes', value: (childData?.total_achievements || 12) - (childData?.achievements_unlocked || 8), color: '#e5e7eb' }
  ];

  // Datos para el gráfico de progreso de metas
  const goalsData = [
    { meta: 'Semanal', completado: childData?.weekly_progress || 4, total: childData?.weekly_goal || 5, color: '#3b82f6' },
    { meta: 'Mensual', completado: childData?.monthly_progress || 15, total: childData?.monthly_goal || 20, color: '#10b981' },
    { meta: 'Anual', completado: childData?.yearly_progress || 15, total: childData?.yearly_goal || 100, color: '#f59e0b' }
  ];

  const chartData = getChartData();
  const xAxisKey = selectedPeriod === "day" ? "hour" : selectedPeriod === "week" ? "day" : selectedPeriod === "month" ? "day" : "mes";

  return (
    <div className="space-y-6">
      {/* Gráfico de progreso según el período */}
      <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-800 dark:text-slate-100">
              {selectedPeriod === "day" ? "Actividad Diaria" :
                selectedPeriod === "week" ? "Progreso Semanal" :
                  selectedPeriod === "month" ? "Progreso Mensual" :
                    "Progreso Anual"}
            </span>
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            {selectedPeriod === "day" ? "Actividad por horas del día" :
              selectedPeriod === "week" ? "Actividad diaria de esta semana" :
                selectedPeriod === "month" ? "Actividad por días del mes" :
                  "Actividad por meses del año"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
              <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                itemStyle={{ color: '#1e293b' }}
              />
              <Line
                type="monotone"
                dataKey="lecciones"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                name="Lecciones"
              />
              <Line
                type="monotone"
                dataKey="minutos"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                name="Minutos"
              />
              <Line
                type="monotone"
                dataKey="puntos"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                name="Puntos"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </GlassPanel>

      {/* Gráficos de comparación mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-slate-100">Lecciones por Mes</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Comparación de lecciones completadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="lecciones" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-slate-800 dark:text-slate-100">Minutos de Estudio</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Tiempo dedicado al aprendizaje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="minutos" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </GlassPanel>
      </div>

      {/* Gráficos de logros y metas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-slate-800 dark:text-slate-100">Distribución de Logros</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Logros desbloqueados vs pendientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={achievementsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {achievementsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center space-x-6 mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-slate-600 dark:text-slate-300">Completados: {childData?.achievements_unlocked || 8}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-300 dark:bg-slate-700 rounded-full"></div>
                <span className="text-sm text-slate-600 dark:text-slate-300">Pendientes: {(childData?.total_achievements || 12) - (childData?.achievements_unlocked || 8)}</span>
              </div>
            </div>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-slate-800 dark:text-slate-100">Progreso de Metas</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Estado actual de las metas establecidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goalsData.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{goal.meta}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {goal.completado} de {goal.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(goal.completado / goal.total) * 100}%`,
                        backgroundColor: goal.color
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round((goal.completado / goal.total) * 100)}% completado
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </GlassPanel>
      </div>
    </div>
  );
}
