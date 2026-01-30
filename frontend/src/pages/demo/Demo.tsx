import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent } from "@/components/ui/card";

export default function Demo() {
    const currentStreak = 5;

    const stats = [
        {
            title: "Lecciones Completadas",
            value: 1,
            lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie",
            color: "text-blue-600",
            bgColor: "",
            description: "¡Sigue así!",
            size: "150px"
        },
        {
            title: "Minutos Estudiados",
            value: 15,
            lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie",
            color: "text-green-600",
            bgColor: "",
            description: "Tiempo bien invertido",
            size: "150px"
        },
        {
            title: "Puntos Ganados",
            value: 50,
            lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie",
            color: "text-yellow-600",
            bgColor: "",
            description: "¡Eres un experto!",
            size: "150px"
        },
        {
            title: "Racha Actual",
            value: currentStreak,
            lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie",
            color: "text-purple-600",
            bgColor: "",
            description: "¡Días seguidos!",
            size: "100px"
        }
    ];

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Welcome Header */}
                <div className="text-center space-y-2 pt-4">
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        ¡Hola, Pequeño Fundador! 👋
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        ¡Bienvenido a tu panel de Little Founders!
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <Card key={index} className={`border-0 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all overflow-hidden relative shadow-sm hover:shadow-md ${stat.value === 0 ? 'grayscale opacity-70' : ''}`}>
                            <CardContent className="p-4 md:p-6">
                                <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                                    <div className={`p-2 rounded-full ${stat.bgColor} mb-2 h-[170px] flex items-center justify-center`}>
                                        {/* @ts-ignore */}
                                        <dotlottie-wc
                                            src={stat.lottieSrc}
                                            // @ts-ignore
                                            style={{ width: stat.size || '100px', height: stat.size || '100px' }}
                                            autoplay
                                            loop
                                        ></dotlottie-wc>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                        <p className="text-3xl font-bold my-1 text-gray-800 dark:text-gray-100">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
