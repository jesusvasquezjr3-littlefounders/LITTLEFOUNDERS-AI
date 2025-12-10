import React from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LemonadeGame } from "@/components/games/LemonadeGame";

export default function LemonadeStand() {
  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <LemonadeGame />
      </div>
    </DashboardLayout>
  );
}