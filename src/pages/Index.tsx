import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CustomerAnalytics } from "@/components/dashboard/CustomerAnalytics";
import { 
  DollarSign, 
  Users, 
  Package, 
  UserCheck, 
  Activity,
  Zap,
  Timer,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Operations Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your startup's key metrics and performance indicators
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1">
              Live Data
            </Badge>
            <Button>
              <Activity className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Monthly Recurring Revenue"
            value="$20,000"
            change={16.2}
            changeLabel="vs last month"
            target="$25,000"
            targetProgress={80}
            variant="revenue"
            icon={DollarSign}
          />
          <KPICard
            title="Active Customers"
            value="2,847"
            change={12.4}
            changeLabel="vs last month"
            target="3,000"
            targetProgress={94.9}
            variant="customers"
            icon={Users}
          />
          <KPICard
            title="Product Adoption"
            value="78.5%"
            change={5.8}
            changeLabel="vs last month"
            target="85%"
            targetProgress={92.4}
            variant="product"
            icon={Package}
          />
          <KPICard
            title="Team Velocity"
            value="42 pts"
            change={-2.1}
            changeLabel="vs last sprint"
            target="45 pts"
            targetProgress={93.3}
            variant="team"
            icon={UserCheck}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart />
          
          {/* Quick Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>Quick Metrics</span>
              </CardTitle>
              <CardDescription>Key performance indicators at a glance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-revenue-light rounded-lg">
                <div>
                  <div className="font-medium">Customer LTV</div>
                  <div className="text-sm text-muted-foreground">Lifetime Value</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-revenue">$2,340</div>
                  <div className="text-xs text-revenue">+8.2%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-customers-light rounded-lg">
                <div>
                  <div className="font-medium">CAC Payback</div>
                  <div className="text-sm text-muted-foreground">Customer Acquisition Cost</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-customers">8.2 mo</div>
                  <div className="text-xs text-customers">-0.5 mo</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-product-light rounded-lg">
                <div>
                  <div className="font-medium">Feature Usage</div>
                  <div className="text-sm text-muted-foreground">Core features</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-product">92%</div>
                  <div className="text-xs text-product">+3.1%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-team-light rounded-lg">
                <div>
                  <div className="font-medium">Burn Rate</div>
                  <div className="text-sm text-muted-foreground">Monthly spend</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-team">$45K</div>
                  <div className="text-xs text-team">18mo runway</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Analytics */}
        <CustomerAnalytics />

        {/* Bottom Row - Alerts & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Timer className="h-5 w-5 text-destructive" />
                <span>Critical Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="w-2 h-2 bg-destructive rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Churn Rate Spike</div>
                  <div className="text-sm text-muted-foreground">
                    Customer churn increased by 2% this week. Review customer satisfaction metrics.
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-team/10 border border-team/20 rounded-lg">
                <div className="w-2 h-2 bg-team rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Server Performance</div>
                  <div className="text-sm text-muted-foreground">
                    API response times are 15% slower than usual. Check infrastructure.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Growth Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-revenue/10 border border-revenue/20 rounded-lg">
                <div className="w-2 h-2 bg-revenue rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Revenue Milestone</div>
                  <div className="text-sm text-muted-foreground">
                    You're 80% of the way to your $25K MRR goal. Keep up the momentum!
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-customers/10 border border-customers/20 rounded-lg">
                <div className="w-2 h-2 bg-customers rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Customer Segment Growth</div>
                  <div className="text-sm text-muted-foreground">
                    Enterprise customers are growing 23% faster than other segments.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
