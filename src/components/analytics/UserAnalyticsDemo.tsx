import { useState, useEffect } from 'react'
import { useUserPageTimeStats } from './UserPageTimeTrackerComponent'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, User, BarChart3, Eye, Activity } from 'lucide-react'

interface UserAnalyticsDemoProps {
  showDemo?: boolean
}

export const UserAnalyticsDemo = ({ showDemo = false }: UserAnalyticsDemoProps) => {
  const [isVisible, setIsVisible] = useState(showDemo)
  const [refreshKey, setRefreshKey] = useState(0)
  const stats = useUserPageTimeStats()

  // Auto-refresh cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!isVisible) return null

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'tutor': return 'bg-blue-100 text-blue-800'
      case 'child': return 'bg-green-100 text-green-800'
      case 'sponsor': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'tutor': return 'Tutor'
      case 'child': return 'Niño'
      case 'sponsor': return 'Patrocinador'
      default: return 'Desconocido'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-white/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics de Usuario
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <CardDescription className="text-xs">
            Tiempo por página por tipo de usuario
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Información del usuario */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">{stats.userId}</div>
              <Badge className={`text-xs ${getUserTypeColor(stats.userType)}`}>
                {getUserTypeLabel(stats.userType)}
              </Badge>
            </div>
          </div>

          {/* Página actual */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">{stats.currentPageName}</div>
                <div className="text-xs text-muted-foreground">{stats.currentPage}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                Tiempo actual: <span className="font-mono">{formatTime(stats.currentPageDuration)}</span>
              </div>
            </div>
          </div>

          {/* Estado de actividad */}
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${stats.isActive ? 'text-green-500' : 'text-red-500'}`} />
            <div className="text-sm">
              {stats.isActive ? 'Activo' : 'Inactivo'}
            </div>
          </div>

          {/* Estadísticas de sesión */}
          <div className="pt-2 border-t space-y-1">
            <div className="text-xs text-muted-foreground">
              Duración de sesión: <span className="font-mono">{formatTime(stats.sessionDuration)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Páginas visitadas: <span className="font-mono">{stats.pagesVisited}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tiempo promedio: <span className="font-mono">{formatTime(stats.averagePageTime)}</span>
            </div>
          </div>

          {/* Botón de refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="w-full text-xs"
          >
            Actualizar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
