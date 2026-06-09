import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { GlassPanel } from "@/components/ui/GlassPanel";

interface UniversalDashboardProps {
    user: any;
}

export function UniversalDashboard({ user }: UniversalDashboardProps) {
    const { t } = useTranslation('dashboard');

    const stats = [
        {
            title: t('stats.lessons_completed'),
            value: user?.lessons_completed || 0,
            lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie",
            color: "text-blue-600",
            bgColor: "",
            description: t('stats.keep_going'),
            size: "150px"
        },
        {
            title: t('stats.minutes_studied'),
            value: user?.minutes_studied || 0,
            lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie",
            color: "text-green-600",
            bgColor: "",
            description: t('stats.time_well_spent'),
            size: "150px"
        },
        {
            title: t('stats.points_earned'),
            value: user?.points_earned || 0,
            lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie",
            color: "text-indigo-600",
            bgColor: "",
            description: t('stats.expert'),
            size: "150px"
        },
        {
            title: t('stats.current_streak'),
            value: user?.current_streak || 0,
            lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie",
            color: "text-purple-600",
            bgColor: "",
            description: t('stats.days_in_row'),
            size: "100px"
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Premium Welcome Header */}
            <GlassPanel variant="gradient" gradient="indigo" className="relative mb-8 p-6 overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-5 relative z-10">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                            {t('welcome', { name: user?.name?.split(' ')[0] || t('default_name') })} 👋
                        </h1>
                        <p className="text-base text-slate-600 dark:text-slate-300 font-medium max-w-2xl leading-relaxed">
                            {t('welcome_subtitle')}
                        </p>
                    </div>
                </div>
            </GlassPanel>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <GlassPanel key={index} variant="default" className={`liquid-glass-subtle overflow-hidden relative hover:scale-[1.02] transition-all duration-300 ${stat.value === 0 ? 'grayscale opacity-70' : ''}`}>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                                <div className={`p-2 rounded-full mb-2 h-[170px] flex items-center justify-center`}>
                                    {/* @ts-ignore */}
                                    <dotlottie-wc
                                        src={stat.lottieSrc}
                                        // @ts-ignore
                                        style={{ width: stat.size || '100px', height: stat.size || '100px' }}
                                        autoplay
                                        loop
                                    ></dotlottie-wc>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-500/80 uppercase tracking-wider">{stat.title}</p>
                                    <p className="text-4xl font-black text-slate-800 dark:text-white">{stat.value}</p>
                                    <p className="text-xs font-semibold text-slate-500">{stat.description}</p>
                                </div>
                            </div>
                        </CardContent>
                    </GlassPanel>
                ))}
            </div>


        </div >
    );
}
