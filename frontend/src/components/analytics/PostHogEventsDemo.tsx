import { useState, useEffect } from 'react'
import { usePostHog } from '@/hooks/usePostHog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Eye, Clock, User, BarChart3, Activity, AlertCircle } from 'lucide-react'

interface PostHogEvent {
  event: string
  timestamp: string
  properties: Record<string, any>
}

interface PostHogEventsDemoProps {
  showDemo?: boolean
}

export const PostHogEventsDemo = ({ showDemo = false }: PostHogEventsDemoProps) => {
  const [isVisible, setIsVisible] = useState(showDemo)
  const [events, setEvents] = useState<PostHogEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const { trackEvent } = usePostHog()

  // Simular eventos de PostHog para demostración
  useEffect(() => {
    if (!isVisible) return

    const simulateEvent = () => {
      const eventTypes = [
        'user_page_time_start',
        'user_page_time_update', 
        'user_page_time_final',
        'user_engagement_by_type',
        'sidebar_page_analytics',
        'user_session_metrics'
      ]

      const pages = [
        { name: 'Inicio', path: '/dashboard' },
        { name: 'Lecciones', path: '/lecciones' },
        { name: 'Mis Ahorros', path: '/savings' },
        { name: 'Tiendita', path: '/store' },
        { name: 'Banca Digital', path: '/growth' }
      ]

      const userTypes = ['tutor', 'child', 'sponsor']
      
      const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      const randomPage = pages[Math.floor(Math.random() * pages.length)]
      const randomUserType = userTypes[Math.floor(Math.random() * userTypes.length)]

      const newEvent: PostHogEvent = {
        event: randomEvent,
        timestamp: new Date().toISOString(),
        properties: {
          page: randomPage.path,
          page_name: randomPage.name,
          user_type: randomUserType,
          user_id: `user_${Math.random().toString(36).substr(2, 9)}`,
          duration_minutes: Math.round(Math.random() * 10 * 100) / 100,
          session_duration: Math.round(Math.random() * 30 * 100) / 100,
          is_active: Math.random() > 0.3,
          engagement_level: ['Muy Bajo', 'Bajo', 'Medio', 'Alto', 'Muy Alto'][Math.floor(Math.random() * 5)]
        }
      }

      setEvents(prev => [newEvent, ...prev.slice(0, 19)]) // Mantener solo los últimos 20 eventos
      setIsConnected(true)
    }

    // Simular eventos cada 3-8 segundos
    const interval = setInterval(simulateEvent, Math.random() * 5000 + 3000)
    
    return () => clearInterval(interval)
  }, [isVisible])

  const getEventColor = (event: string) => {
    switch (event) {
      case 'user_page_time_start': return 'bg-green-100 text-green-800'
      case 'user_page_time_update': return 'bg-blue-100 text-blue-800'
      case 'user_page_time_final': return 'bg-red-100 text-red-800'
      case 'user_engagement_by_type': return 'bg-purple-100 text-purple-800'
      case 'sidebar_page_analytics': return 'bg-orange-100 text-orange-800'
      case 'user_session_metrics': return 'bg-cyan-100 text-cyan-800'
      default: return 'bg-gray-100 text-gray-800'
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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const sendTestEvent = () => {
    trackEvent('test_user_analytics', {
      test: true,
      timestamp: new Date().toISOString(),
      user_type: 'demo',
      page: '/demo',
      page_name: 'Demo Page'
    })
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 max-h-96">
      <Card className="bg-white/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              PostHog Events Demo
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Eventos simulados que se envían a PostHog
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Botón de prueba */}
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestEvent}
            className="w-full text-xs"
          >
            <Activity className="w-3 h-3 mr-1" />
            Enviar Evento de Prueba
          </Button>

          {/* Lista de eventos */}
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {events.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">
                  <AlertCircle className="w-4 h-4 mx-auto mb-2" />
                  Esperando eventos...
                </div>
              ) : (
                events.map((event, index) => (
                  <div key={index} className="border rounded-lg p-2 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={`text-xs ${getEventColor(event.event)}`}>
                        {event.event}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <Badge className={`text-xs ${getUserTypeColor(event.properties.user_type)}`}>
                          {getUserTypeLabel(event.properties.user_type)}
                        </Badge>
                        <span className="text-muted-foreground">
                          {event.properties.user_id}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Eye className="w-3 h-3" />
                        <span className="font-medium">{event.properties.page_name}</span>
                        <span className="text-muted-foreground">({event.properties.page})</span>
                      </div>
                      
                      {event.properties.duration_minutes && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>Tiempo: {event.properties.duration_minutes} min</span>
                        </div>
                      )}
                      
                      {event.properties.engagement_level && (
                        <div className="text-xs">
                          Engagement: <span className="font-medium">{event.properties.engagement_level}</span>
                        </div>
                      )}
                      
                      {event.properties.is_active !== undefined && (
                        <div className="text-xs">
                          Estado: <span className={event.properties.is_active ? 'text-green-600' : 'text-red-600'}>
                            {event.properties.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Estadísticas */}
          <div className="pt-2 border-t space-y-1">
            <div className="text-xs text-muted-foreground">
              Eventos simulados: <span className="font-mono">{events.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Estado: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
