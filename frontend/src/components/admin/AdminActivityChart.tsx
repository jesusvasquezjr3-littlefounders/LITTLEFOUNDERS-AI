import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, parseISO, eachDayOfInterval, eachMonthOfInterval, endOfMonth, isSameMonth } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface AdminActivityChartProps {
    data: Array<{
        date: string;
        [key: string]: string | number;
    }>;
}

type TimeRange = 'week' | 'month' | 'year';

const COLORS = [
    '#10b981', // emerald-500
    '#3b82f6', // blue-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f43f5e', // rose-500
    '#6366f1', // indigo-500
];

export const AdminActivityChart: React.FC<AdminActivityChartProps> = ({ data }) => {
    const { t, i18n } = useTranslation(['admin']);
    const locale = i18n.language.startsWith('es') ? es : enUS;
    const [range, setRange] = useState<TimeRange>('month');

    // Extract all user names first
    const users = useMemo(() => {
        const userSet = new Set<string>();
        data.forEach(entry => {
            Object.keys(entry).forEach(key => {
                if (key !== 'date') userSet.add(key);
            });
        });
        return Array.from(userSet);
    }, [data]);

    // Process data based on selected range
    const chartData = useMemo(() => {
        const today = new Date();
        let startDate: Date;
        let intervalDays: Date[];
        let dateFormat = 'dd MMM';

        if (range === 'year') {
            const startDateYear = subDays(today, 364);
            const months = eachMonthOfInterval({ start: startDateYear, end: today });

            return months.map(monthStart => {
                const entriesInMonth = data.filter(d => {
                    const date = parseISO(d.date);
                    return isSameMonth(date, monthStart) && date >= startDateYear && date <= today;
                });

                const entry: any = {
                    name: format(monthStart, 'MMM', { locale }),
                    fullDate: format(monthStart, 'MMMM yyyy', { locale }),
                };

                // Initialize user counts
                users.forEach(user => { entry[user] = 0; });

                entriesInMonth.forEach(d => {
                    Object.entries(d).forEach(([key, val]) => {
                        if (key !== 'date' && typeof val === 'number') {
                            entry[key] = (entry[key] || 0) + val;
                        }
                    });
                });

                return entry;
            });
        }

        // For week and month
        if (range === 'week') {
            startDate = subDays(today, 6);
            intervalDays = eachDayOfInterval({ start: startDate, end: today });
            dateFormat = 'EEE';
        } else { // month
            startDate = subDays(today, 29);
            intervalDays = eachDayOfInterval({ start: startDate, end: today });
            dateFormat = 'dd MMM';
        }

        const activityMap = new Map<string, any>();
        data.forEach(entry => activityMap.set(entry.date, entry));

        return intervalDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dataEntry = activityMap.get(dateStr) || {};

            const result: any = {
                name: format(day, dateFormat, { locale }),
                fullDate: format(day, 'PPPP', { locale }),
            };

            // Fill user data, default to 0
            users.forEach(user => {
                result[user] = typeof dataEntry[user] === 'number' ? dataEntry[user] : 0;
            });

            return result;
        });

    }, [data, range, locale, users]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {t('dashboard.activityChart.title')}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {t('dashboard.activityChart.subtitle')}
                    </p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                    <Button
                        variant={range === 'week' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRange('week')}
                        className="h-8 px-3 text-xs"
                    >
                        {t('dashboard.activityChart.week')}
                    </Button>
                    <Button
                        variant={range === 'month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRange('month')}
                        className="h-8 px-3 text-xs"
                    >
                        {t('dashboard.activityChart.month')}
                    </Button>
                    <Button
                        variant={range === 'year' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRange('year')}
                        className="h-8 px-3 text-xs"
                    >
                        {t('dashboard.activityChart.year')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                {users.map((user, index) => (
                                    <linearGradient key={user} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-slate-700" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    color: '#1f2937'
                                }}
                                itemStyle={{ padding: 0 }}
                                cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            {users.map((user, index) => (
                                <Area
                                    key={user}
                                    type="monotone"
                                    dataKey={user}
                                    stackId="1" // Enable stacking
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill={`url(#color-${index})`}
                                    animationDuration={1000}
                                    name={user}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
