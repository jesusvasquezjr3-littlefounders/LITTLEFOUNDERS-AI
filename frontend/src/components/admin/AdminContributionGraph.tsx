import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { subDays, eachDayOfInterval, format, getDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface AdminContributionGraphProps {
    data: Array<{
        date: string;
        [key: string]: string | number;
    }>;
}

export const AdminContributionGraph: React.FC<AdminContributionGraphProps> = ({ data }) => {
    const { t, i18n } = useTranslation(['admin']);
    const locale = i18n.language.startsWith('es') ? es : enUS;

    // Process data for the last 365 days
    const calendarData = useMemo(() => {
        const today = new Date();
        const startDate = subDays(today, 364); // 52 weeks * 7 = 364

        // Generate all dates in the interval
        const days = eachDayOfInterval({ start: startDate, end: today });

        // Calculate padding for the first week to align days correctly
        const startDayOfWeek = getDay(startDate);
        const padding = Array(startDayOfWeek).fill(null);

        // Map activity data for quick lookup
        const activityMap = new Map<string, any>();

        data.forEach(entry => {
            const dateStr = entry.date;
            let total = 0;
            const breakdown: Record<string, number> = {};

            Object.entries(entry).forEach(([key, value]) => {
                if (key !== 'date' && typeof value === 'number') {
                    total += value;
                    breakdown[key] = value;
                }
            });

            activityMap.set(dateStr, { total, breakdown });
        });

        const mappedDays = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const activity = activityMap.get(dateStr) || { total: 0, breakdown: {} };
            return {
                date: day,
                dateStr,
                ...activity,
            };
        });

        return [...padding, ...mappedDays];
    }, [data]);

    // Determine color intensity
    const getColor = (count: number) => {
        if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
        if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
        if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700';
        if (count <= 10) return 'bg-emerald-500 dark:bg-emerald-600';
        return 'bg-emerald-700 dark:bg-emerald-400';
    };

    const months = useMemo(() => {
        const labels: { label: string; weekIndex: number }[] = [];
        let currentMonth = -1;

        calendarData.forEach((day, index) => {
            if (!day) return;

            const month = day.date.getMonth();
            if (month !== currentMonth) {
                const weekIndex = Math.floor(index / 7);
                // Only add if we haven't added this month recently (e.g. skip if same week index)
                // But months usually start on different weeks, so unique is likely fine.
                labels.push({
                    label: format(day.date, 'MMM', { locale }),
                    weekIndex
                });
                currentMonth = month;
            }
        });
        return labels;
    }, [calendarData, locale]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {t('dashboard.activityGraph.title')}
                </CardTitle>
                <p className="corp-body-sm">
                    {t('dashboard.activityGraph.subtitle')}
                </p>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto pb-4">
                    <div className="min-w-[800px]">
                        {/* Month Labels */}
                        <div className="flex mb-2 corp-caption relative h-5">
                            {months.map((m, i) => (
                                <span
                                    key={i}
                                    style={{ left: `${(m.weekIndex / 53) * 100}%` }}
                                    className="absolute"
                                >
                                    {m.label}
                                </span>
                            ))}
                        </div>

                        {/* The Grid */}
                        <div className="grid grid-rows-7 grid-flow-col gap-1 h-[140px]">
                            {calendarData.map((day, i) => {
                                if (!day) return <div key={`pad-${i}`} className="w-3 h-3" />;

                                return (
                                    <TooltipProvider key={day.dateStr}>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <div
                                                    className={cn(
                                                        "w-3 h-3 rounded-[2px] transition-colors hover:ring-2 hover:ring-offset-1 hover:ring-offset-background hover:ring-slate-400",
                                                        getColor(day.total)
                                                    )}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="corp-caption">
                                                    <p className="font-semibold mb-1">
                                                        {format(day.date, 'PPPP', { locale })}
                                                    </p>
                                                    <p>
                                                        {day.total} {t('dashboard.activityGraph.contributions')}
                                                    </p>
                                                    {day.total > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-border">
                                                            {Object.entries(day.breakdown).map(([user, count]) => (
                                                                <div key={user} className="flex justify-between gap-4">
                                                                    <span>{user}:</span>
                                                                    <span>{count as number}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex items-center justify-end gap-2 corp-caption">
                            <span>{t('dashboard.activityGraph.less')}</span>
                            <div className="w-3 h-3 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-500 dark:bg-emerald-600" />
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-700 dark:bg-emerald-400" />
                            <span>{t('dashboard.activityGraph.more')}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
