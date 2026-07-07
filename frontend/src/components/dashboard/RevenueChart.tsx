import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp } from "lucide-react";

const revenueData = [
  { month: "Ene", mrr: 8500, arr: 102000, previous: 7800 },
  { month: "Feb", mrr: 9200, arr: 110400, previous: 8100 },
  { month: "Mar", mrr: 9800, arr: 117600, previous: 8500 },
  { month: "Abr", mrr: 10500, arr: 126000, previous: 9200 },
  { month: "May", mrr: 11200, arr: 134400, previous: 9800 },
  { month: "Jun", mrr: 12000, arr: 144000, previous: 10500 },
  { month: "Jul", mrr: 13500, arr: 162000, previous: 11200 },
  { month: "Ago", mrr: 14200, arr: 170400, previous: 12000 },
  { month: "Sep", mrr: 15800, arr: 189600, previous: 13500 },
  { month: "Oct", mrr: 17200, arr: 206400, previous: 14200 },
  { month: "Nov", mrr: 18500, arr: 222000, previous: 15800 },
  { month: "Dic", mrr: 20000, arr: 240000, previous: 17200 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{`${label} 2024`}</p>
        <div className="space-y-1 mt-2">
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: $${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueChart() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-revenue" />
              <span>Crecimiento de Ingresos</span>
            </CardTitle>
            <CardDescription>
              ¡Descubre cómo han crecido tus ingresos mes a mes! <br />
              Observa el crecimiento de los ingresos mensuales y anuales usando los conceptos que has aprendido en Littlefounders.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Últimos 12 meses
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--revenue))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--revenue))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="previousGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="previous"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                fill="url(#previousGradient)"
                strokeDasharray="5 5"
                name="Año anterior"
              />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke="hsl(var(--revenue))"
                strokeWidth={3}
                fill="url(#mrrGradient)"
                name="Ingresos Mensuales (MRR)"
              />
              <Line
                type="monotone"
                dataKey="arr"
                stroke="hsl(var(--revenue))"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                name="Ingresos Anuales (ARR)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Métricas de ingresos */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <div className="corp-number-lg text-revenue">$20K</div>
            <div className="corp-body-sm">MRR actual</div>
          </div>
          <div className="text-center">
            <div className="corp-number-lg text-revenue">$240K</div>
            <div className="corp-body-sm">Proyección anual (ARR)</div>
          </div>
          <div className="text-center">
            <div className="corp-number-lg text-primary">16.2%</div>
            <div className="corp-body-sm">Tasa de crecimiento</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}