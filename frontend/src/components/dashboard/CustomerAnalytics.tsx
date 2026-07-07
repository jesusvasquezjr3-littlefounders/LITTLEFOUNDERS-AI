import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, UserMinus, Filter } from "lucide-react";

// Datos de adquisición de nuevos usuarios (¡cómo llegan tus nuevos amigos a la plataforma!)
const acquisitionData = [
  { month: "Ene", organic: 45, paid: 32, referral: 18, direct: 25 },
  { month: "Feb", organic: 52, paid: 38, referral: 22, direct: 28 },
  { month: "Mar", organic: 48, paid: 45, referral: 25, direct: 32 },
  { month: "Abr", organic: 61, paid: 42, referral: 28, direct: 35 },
  { month: "May", organic: 58, paid: 48, referral: 32, direct: 38 },
  { month: "Jun", organic: 65, paid: 55, referral: 35, direct: 42 },
];

// Análisis de bajas de usuarios según tipo de perfil
const churnData = [
  { segment: "Avanzado", value: 2.1, color: "hsl(var(--customers))" },
  { segment: "Intermedio", value: 4.8, color: "hsl(var(--product))" },
  { segment: "Principiante", value: 8.2, color: "hsl(var(--team))" },
  { segment: "Prueba gratuita", value: 15.6, color: "hsl(var(--muted-foreground))" },
];

// Tooltip personalizado en español
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{label}</p>
        <div className="space-y-1 mt-2">
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value} usuarios`}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function CustomerAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Adquisición de usuarios */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-customers" />
                <span>Nuevos usuarios</span>
              </CardTitle>
              <CardDescription>
                ¿De dónde vienen los nuevos miembros de tu mundo Littlefounders? Aquí puedes ver los canales (como recomendaciones de amigos, búsquedas o invitaciones) por los que se unieron.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acquisitionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="organic" fill="hsl(var(--customers))" name="Orgánico" stackId="a" />
                <Bar dataKey="paid" fill="hsl(var(--product))" name="Publicidad" stackId="a" />
                <Bar dataKey="referral" fill="hsl(var(--team))" name="Invitación de amigos" stackId="a" />
                <Bar dataKey="direct" fill="hsl(var(--revenue))" name="Enlace directo" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="corp-number-lg text-customers">342</div>
              <div className="corp-caption">Este mes</div>
            </div>
            <div className="text-center">
              <div className="corp-number-lg text-primary">+23%</div>
              <div className="corp-caption">vs mes anterior</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análisis de bajas (churn) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <UserMinus className="h-5 w-5 text-destructive" />
                <span>Análisis de bajas</span>
              </CardTitle>
              <CardDescription>
                ¿Cuántos usuarios dejan la app? Observa las bajas según el tipo de perfil y aprende cómo retener más amigos en tu proyecto.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Vista mensual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={churnData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {churnData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Tasa de baja']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-2 mt-4 pt-4 border-t border-border">
            {churnData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="corp-body-sm">{item.segment}</span>
                </div>
                <span className="corp-body-sm font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Métricas de salud de los usuarios */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-customers" />
            <span>Métricas de usuarios</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-customers-light rounded-lg">
              <div className="corp-number-lg text-customers">2,847</div>
              <div className="corp-body-sm">Usuarios totales</div>
              <div className="corp-caption text-customers mt-1">+12% este mes</div>
            </div>
            <div className="text-center p-4 bg-product-light rounded-lg">
              <div className="corp-number-lg text-product">4.2%</div>
              <div className="corp-body-sm">Churn mensual</div>
              <div className="corp-caption text-destructive mt-1">+0.3% de aumento</div>
            </div>
            <div className="text-center p-4 bg-revenue-light rounded-lg">
              <div className="corp-number-lg text-revenue">$89</div>
              <div className="corp-body-sm">Ingreso promedio por usuario</div>
              <div className="corp-caption text-revenue mt-1">+5% este mes</div>
            </div>
            <div className="text-center p-4 bg-team-light rounded-lg">
              <div className="corp-number-lg text-team">94%</div>
              <div className="corp-body-sm">Satisfacción de usuarios</div>
              <div className="corp-caption text-team mt-1">Estable</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}