import { usePageTimeTrackingSafe } from '@/hooks/usePageTimeTrackingSafe'
import { useScrollTrackingSafe } from '@/hooks/useScrollTrackingSafe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Mouse, Scroll, Eye } from 'lucide-react'

// Componente demo para mostrar estadísticas de tiempo en tiempo real
// Solo se muestra en modo desarrollo
export const TimeAnalyticsDemo = () => {
  const pageStats = usePageTimeTrackingSafe().getSessionStats()
  const scrollStats = useScrollTrackingSafe()

  // Solo mostrar en desarrollo
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Analytics en Vivo
            <Badge variant="secondary" className="text-xs">DEV</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Tiempo en página actual */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>Página actual:</span>
            </div>
            <span className="font-mono">
              {Math.round(pageStats.currentPageDuration / 1000)}s
            </span>
          </div>

          {/* Tiempo de sesión */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>Sesión total:</span>
            </div>
            <span className="font-mono">
              {pageStats.sessionDurationMinutes}min
            </span>
          </div>

          {/* Páginas visitadas */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Mouse className="w-3 h-3" />
              <span>Páginas:</span>
            </div>
            <span className="font-mono">{pageStats.pagesVisited}</span>
          </div>

          {/* Scroll depth */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Scroll className="w-3 h-3" />
              <span>Scroll:</span>
            </div>
            <span className="font-mono">{scrollStats.scrollDepth}%</span>
          </div>

          {/* Estado de actividad */}
          <div className="flex items-center justify-between text-sm">
            <span>Activo:</span>
            <Badge 
              variant={pageStats.isActive ? "default" : "secondary"}
              className="text-xs"
            >
              {pageStats.isActive ? "Sí" : "No"}
            </Badge>
          </div>

          {/* Interacción */}
          <div className="flex items-center justify-between text-sm">
            <span>Interactuó:</span>
            <Badge 
              variant={scrollStats.hasInteracted ? "default" : "secondary"}
              className="text-xs"
            >
              {scrollStats.hasInteracted ? "Sí" : "No"}
            </Badge>
          </div>

          {/* Página actual */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="truncate">
              <strong>Página:</strong> {pageStats.currentPage}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
