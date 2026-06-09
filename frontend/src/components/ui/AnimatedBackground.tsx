import { Star, Sparkles, Zap, Heart, Coins } from "lucide-react";

export function AnimatedBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Floating Shapes - Coins/Circles */}
            <div
                className="absolute top-20 left-10 w-16 h-16 bg-indigo-400 rounded-full opacity-10 animate-bounce"
                style={{ animationDelay: '0s', animationDuration: '3s' }}
            ></div>
            <div
                className="absolute top-40 right-20 w-12 h-12 bg-green-400 rounded-full opacity-10 animate-bounce"
                style={{ animationDelay: '1s', animationDuration: '4s' }}
            ></div>
            <div
                className="absolute bottom-32 left-1/4 w-20 h-20 bg-blue-400 rounded-full opacity-10 animate-bounce"
                style={{ animationDelay: '2s', animationDuration: '5s' }}
            ></div>
            <div
                className="absolute top-1/3 right-1/3 w-14 h-14 bg-pink-400 rounded-full opacity-10 animate-bounce"
                style={{ animationDelay: '1.5s', animationDuration: '4.5s' }}
            ></div>
            <div
                className="absolute bottom-20 right-1/4 w-18 h-18 bg-purple-400 rounded-full opacity-10 animate-bounce"
                style={{ animationDelay: '0.5s', animationDuration: '3.5s' }}
            ></div>

            {/* Floating Icons */}
            <Star
                className="absolute top-1/4 right-1/4 w-8 h-8 text-indigo-300 opacity-20 animate-pulse"
                style={{ animationDelay: '0s' }}
            />
            <Star
                className="absolute bottom-1/3 left-1/3 w-6 h-6 text-pink-300 opacity-20 animate-pulse"
                style={{ animationDelay: '1s' }}
            />
            <Sparkles
                className="absolute top-1/3 left-1/4 w-10 h-10 text-purple-300 opacity-20 animate-pulse"
                style={{ animationDelay: '2s' }}
            />
            <Sparkles
                className="absolute bottom-1/4 right-1/3 w-8 h-8 text-cyan-300 opacity-20 animate-pulse"
                style={{ animationDelay: '1.5s' }}
            />
            <Zap
                className="absolute top-1/2 left-1/5 w-9 h-9 text-violet-300 opacity-20 animate-pulse"
                style={{ animationDelay: '0.5s' }}
            />
            <Heart
                className="absolute top-2/3 right-1/5 w-7 h-7 text-rose-300 opacity-20 animate-pulse"
                style={{ animationDelay: '1.8s' }}
            />

            {/* Gradient Orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-400/20 dark:from-purple-600/10 dark:to-pink-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 dark:from-blue-600/10 dark:to-cyan-600/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-indigo-400/10 to-violet-400/10 dark:from-indigo-600/5 dark:to-violet-600/5 rounded-full blur-3xl"></div>
        </div>
    );
}
