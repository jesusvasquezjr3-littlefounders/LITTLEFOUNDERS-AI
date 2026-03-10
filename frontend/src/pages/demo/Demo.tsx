import { useRef } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DemoShowreelPlayer } from "@/components/demo/DemoShowreelPlayer";
import { DemoTimeline } from "@/components/demo/DemoTimeline";

export default function Demo() {
    const playerRef = useRef<any>(null);

    return (
        <DemoDashboardLayout noPadding>
            {/*
              Fixed full-viewport player at z-10.
              Uses the CSS "cover" technique: the inner box is always at least
              100vw wide AND at least 100vh tall, then centered and clipped.
              This guarantees zero edge borders regardless of screen aspect ratio.
            */}
            <div className="fixed inset-0 w-screen h-screen z-10 overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-900/20 dark:to-slate-900">
                {/* Cover box: always fills viewport edge-to-edge, may overflow on one axis */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        /* Fill width first; height = width * 9/16 */
                        width: "100vw",
                        height: "calc(100vw * 9 / 16)",
                        /* But also ensure it fills height if screen is taller than 16:9 */
                        minHeight: "100vh",
                        minWidth: "calc(100vh * 16 / 9)",
                    }}
                >
                    <DemoShowreelPlayer playerRef={playerRef} />
                </div>
            </div>

            {/* Video-style timeline — above the fixed player layer */}
            <DemoTimeline playerRef={playerRef} />
        </DemoDashboardLayout>
    );
}

