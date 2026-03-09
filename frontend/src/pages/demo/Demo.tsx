import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DemoShowreelPlayer } from "@/components/demo/DemoShowreelPlayer";

/**
 * Demo page — the main presentation card of LittleFounders.
 *
 * Modified to provide a true edge-to-edge integrated look.
 * We remove padding/margins and let the player bleed entirely
 * into the dashboard background. No boxes, no framing. 
 */
export default function Demo() {
    return (
        <DemoDashboardLayout>
            {/* 
              Absolute positioning ensures it takes the entire available area 
              of the dashboard content without pushing scrollbars. 
            */}
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <DemoShowreelPlayer />
            </div>

            {/* Empty Spacer to allow scrolling if needed for other demo content later, 
                though currently it acts as a full-screen app area */}
            <div className="relative z-10 w-full min-h-[calc(100vh-80px)] pointer-events-none" />
        </DemoDashboardLayout>
    );
}
