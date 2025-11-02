import { useState, useEffect } from 'react'
import { usePageAnalytics } from './PageAnalyticsTracker'
import { useTimeAnalytics } from './TimeAnalyticsTracker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PostHogAnalyticsDemoProps {
  showDemo?: boolean
}

export const PostHogAnalyticsDemo = ({ showDemo = false }: PostHogAnalyticsDemoProps) => {
  const [isVisible, setIsVisible] = useState(showDemo)
  const pageAnalytics = usePageAnalytics()
  const timeAnalytics = useTimeAnalytics()

  const [topPages, setTopPages] = useState<any[]>([])
  const [averageTimes, setAverageTimes] = useState<Record<string, number>>({})
  const [overallStats, setOverallStats] = useState<any>(null)
  const [timeStats, setTimeStats] = useState<any>(null)

  useEffect(() => {
    const loadAnalytics = () => {
      setTopPages(pageAnalytics.getTopPages(10))
      setAverageTimes(pageAnalytics.getAverageTimeByPage())
      setOverallStats(pageAnalytics.getOverallStats())
      setTimeStats(timeAnalytics.getOverallTimeStats())
    }

    loadAnalytics()
    
    // Recargar datos cada 5 segundos
    const interval = setInterval(loadAnalytics, 5000)
    
    return () => clearInterval(interval)
  }, [pageAnalytics, timeAnalytics])

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.round(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
        >
          📊 Analytics Demo
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh]">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">PostHog Analytics Demo</CardTitle>
              <CardDescription>
                Datos locales - Ve analytics completos en PostHog
              </CardDescription>
            </div>
            <Button 
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="pages" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pages">Páginas</TabsTrigger>
              <TabsTrigger value="times">Tiempos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pages" className="space-y-3">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {topPages.length > 0 ? (
                    topPages.map((page, index) => (
                      <div key={page.page} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <div>
                            <div className="font-medium text-sm">
                              {page.page === '/' ? 'Welcome' : page.page}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {page.visitCount} visitas
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatTime(page.averageTime)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            promedio
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No hay datos de páginas aún
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {overallStats && (
                <div className="mt-4 p-3 bg-muted/30 rounded">
                  <h4 className="font-medium text-sm mb-2">Estadísticas Generales</h4>
                  <div className="text-xs space-y-1">
                    <div>Total páginas: {overallStats.totalPages}</div>
                    <div>Total visitas: {overallStats.totalVisits}</div>
                    <div>Tiempo promedio: {formatTime(overallStats.averageTime)}</div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="times" className="space-y-3">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {Object.keys(averageTimes).length > 0 ? (
                    Object.entries(averageTimes)
                      .sort(([,a], [,b]) => b - a)
                      .map(([page, time], index) => (
                        <div key={page} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            <div className="font-medium text-sm">
                              {page === '/' ? 'Welcome' : page}
                            </div>
                          </div>
                          <div className="text-sm font-medium">
                            {formatTime(time)}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No hay datos de tiempo aún
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {timeStats && (
                <div className="mt-4 p-3 bg-muted/30 rounded">
                  <h4 className="font-medium text-sm mb-2">Análisis de Tiempo</h4>
                  <div className="text-xs space-y-1">
                    <div>Tiempo promedio general: {formatTime(timeStats.overallAverageTime)}</div>
                    {timeStats.mostEngagingPage && (
                      <div>
                        Página más engaging: {timeStats.mostEngagingPage.page}
                        <br />
                        <span className="text-muted-foreground">
                          ({formatTime(timeStats.mostEngagingPage.averageTime)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
              📈 Cómo ver en PostHog
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <div>1. Ve a tu dashboard de PostHog</div>
              <div>2. Busca eventos: <code>page_visit_detailed</code>, <code>page_time_analytics</code></div>
              <div>3. Crea insights con estos eventos</div>
              <div>4. Analiza tendencias de páginas más visitadas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
