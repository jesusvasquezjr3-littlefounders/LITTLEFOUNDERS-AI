import React from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { LemonadeGame } from "@/components/games/LemonadeGame";

export function DemoLemonadeStand() {
    return (
        <DemoDashboardLayout>
            <div className="w-full h-full">
                <LemonadeGame />
            </div>
        </DemoDashboardLayout>
    );
}
