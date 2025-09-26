import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Mouse, Scroll, Eye } from 'lucide-react'

// Componente demo simple para mostrar estadísticas básicas de tiempo
// Solo se muestra en modo desarrollo y no depende de useLocation
export const SimpleTimeDemo = () => {
  const [startTime] = useState(Date.now())
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [scrollDepth, setScrollDepth] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Actualizar tiempo cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Tracking de scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = Math.round((scrollTop / documentHeight) * 100)
      setScrollDepth(Math.min(scrollPercent, 100))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Tracking de interacciones
  useEffect(() => {
    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true)
      }
    }

    const events = ['click', 'keydown', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction)
      })
    }
  }, [hasInteracted])

  // Solo mostrar en desarrollo
  if (!import.meta.env.DEV) {
    return null
  }

  const sessionDuration = Math.round((currentTime - startTime) / 1000)

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Analytics Simple
            <Badge variant="secondary" className="text-xs">DEV</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Tiempo de sesión */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>Sesión:</span>
            </div>
            <span className="font-mono">
              {Math.floor(sessionDuration / 60)}m {sessionDuration % 60}s
            </span>
          </div>

          {/* Scroll depth */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Scroll className="w-3 h-3" />
              <span>Scroll:</span>
            </div>
            <span className="font-mono">{scrollDepth}%</span>
          </div>

          {/* Estado de interacción */}
          <div className="flex items-center justify-between text-sm">
            <span>Interactuó:</span>
            <Badge 
              variant={hasInteracted ? "default" : "secondary"}
              className="text-xs"
            >
              {hasInteracted ? "Sí" : "No"}
            </Badge>
          </div>

          {/* Página actual */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="truncate">
              <strong>Página:</strong> {window.location.pathname}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
