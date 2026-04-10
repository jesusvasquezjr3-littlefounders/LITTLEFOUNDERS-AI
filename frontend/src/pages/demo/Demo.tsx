import { useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { useSound } from "@/contexts/SoundContext";

export default function Demo() {
    const playerRef = useRef<any>(null);
    const { playBGM, stopBGM } = useSound();

    useEffect(() => {
        // Play the same background music used in lessons for consistency
        playBGM('/sounds/edu/background.mp3', { volume: 0.2 });

        return () => {
            // Stop BGM with a fade out when leaving the demo page
            stopBGM({ fade: true, fadeDuration: 1000 });
        };
    }, [playBGM, stopBGM]);

    return (
        <DemoDashboardLayout noPadding>
            {/*
              Fixed full-viewport player at z-10.
              Uses the CSS "cover" technique: the inner box is always at least
              100vw wide AND at least 100vh tall, then centered and clipped.
              This guarantees zero edge borders regardless of screen aspect ratio.
            */}
            <div className="fixed inset-0 w-screen h-screen z-10 overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-900/20 dark:to-slate-900">
                {/* Video removed. Leave blank as requested. */}
            </div>
        </DemoDashboardLayout>
    );
}

