import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
    children: React.ReactNode;
    show?: boolean;
    className?: string;
    position?: 'top' | 'bottom' | 'top-left' | 'top-right';
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Modern speech bubble component matching the LittleFounders design system.
 * Features: Pill-shaped, soft shadow, smooth pointer, responsive.
 */
export function SpeechBubble({
    children,
    show = true,
    className,
    position = 'top',
    size = 'md'
}: SpeechBubbleProps) {
    const sizeClasses = {
        sm: "px-4 py-2 text-sm max-w-[200px]",
        md: "px-6 py-3 text-base md:text-lg max-w-[280px] md:max-w-[320px]",
        lg: "px-8 py-4 text-lg md:text-xl max-w-[350px] md:max-w-[400px]"
    };

    const positionClasses = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-4",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-4",
        'top-left': "bottom-full left-0 mb-4",
        'top-right': "bottom-full right-0 mb-4"
    };

    const tailPositionClasses = {
        top: "left-1/2 -translate-x-1/2 -bottom-2",
        bottom: "left-1/2 -translate-x-1/2 -top-2 rotate-180",
        'top-left': "left-8 -bottom-2",
        'top-right': "right-8 -bottom-2"
    };

    return (
        <div
            className={cn(
                "absolute z-20 transition-all duration-300 ease-out",
                positionClasses[position],
                show ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none",
                className
            )}
        >
            {/* Main Bubble */}
            <div className={cn(
                "relative bg-white rounded-full shadow-lg",
                "font-bold text-slate-700 text-center leading-snug",
                sizeClasses[size]
            )}>
                {children}

                {/* Tail/Pointer - Smooth curved tail pointing down */}
                <svg
                    className={cn(
                        "absolute w-6 h-3",
                        tailPositionClasses[position]
                    )}
                    viewBox="0 0 24 12"
                    fill="none"
                >
                    <path
                        d="M0 0C4 0 8 8 12 12C16 8 20 0 24 0H0Z"
                        fill="white"
                    />
                </svg>
            </div>
        </div>
    );
}
